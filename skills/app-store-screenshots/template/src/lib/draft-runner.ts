"use client";

import { useSyncExternalStore } from "react";
import { announceCreditsChanged } from "@/components/auth/credits-badge";
import { apiFetch } from "./account-scope";
import { DRAFT_STREAM_TYPE, splitLines, type DraftEvent } from "./deck-stream";
import { setImage } from "./image-cache";
import type { SlideAnalysis } from "./import-slides";
import type { DeckSuggestion } from "./suggest-deck";
import type { Device, Theme, ThemeId } from "./types";
import { uploadImage } from "./upload-client";

// A first draft runs here, outside any page, so it keeps going when the home
// page hands off to the editor. The editor subscribes and paints each screen
// as it arrives: screenshots as they upload, then designs as Claude writes them.

export type DraftAttachment = { name: string; path?: string; dataUrl?: string };

export type DraftRequest = {
  projectId: string;
  device: Device;
  locales: string[];
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  attachments: DraftAttachment[];
  styleReferences?: Array<{ name: string; url: string; screenshotUrls?: string[] }>;
  /** Name the project after the app name the model proposes. */
  nameFromDraft?: boolean;
  /** More devices to design: each takes the drafted design when it finishes. */
  extraDevices?: Device[];
};

export type DraftJob = {
  request: DraftRequest;
  /** Identifies one run, so a retry's events never mix with the old run's. */
  run: number;
  status: "uploading" | "designing" | "done" | "error";
  /** Screens the deck will have; the server confirms it when drafting starts. */
  total: number;
  /** Screenshot path per attachment, "" until its upload finishes. */
  paths: string[];
  slides: Array<SlideAnalysis | undefined>;
  theme?: { appName?: string; themeId?: ThemeId; customTheme?: Theme };
  deck?: DeckSuggestion;
  error?: string;
};

const UPLOAD_CONCURRENCY = 4;
const jobs = new Map<string, DraftJob>();
const listeners = new Set<() => void>();
let runs = 0;

function notify() {
  for (const listener of listeners) listener();
}

// Each change stores a new object, so React sees a new snapshot. Updates from
// a run that was replaced (a retry) or cleared are dropped.
function update(projectId: string, run: number, patch: (job: DraftJob) => Partial<DraftJob>) {
  const job = jobs.get(projectId);
  if (!job || job.run !== run) return;
  jobs.set(projectId, { ...job, ...patch(job) });
  notify();
}

export function getDraft(projectId: string | null | undefined): DraftJob | undefined {
  return projectId ? jobs.get(projectId) : undefined;
}

export function useDraft(projectId: string | null | undefined): DraftJob | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getDraft(projectId),
    () => undefined,
  );
}

/** Starts a first draft for a project the caller just created. */
export function startDraft(request: DraftRequest, expectedCount: number) {
  runs += 1;
  const job: DraftJob = {
    request,
    run: runs,
    status: "uploading",
    total: expectedCount,
    paths: request.attachments.map((attachment) => attachment.path ?? ""),
    slides: [],
  };
  jobs.set(request.projectId, job);
  notify();
  void execute(job);
}

/** Runs a failed draft again, reusing screenshots that already uploaded. */
export function retryDraft(projectId: string) {
  const job = jobs.get(projectId);
  if (!job || job.status !== "error") return;
  const attachments = job.request.attachments.map((attachment, index) =>
    job.paths[index] ? { name: attachment.name, path: job.paths[index] } : attachment,
  );
  startDraft({ ...job.request, attachments }, job.total);
}

/** Forgets a finished or failed draft once the editor has applied it. */
export function clearDraft(projectId: string) {
  if (jobs.delete(projectId)) notify();
}

async function execute(job: DraftJob) {
  const { projectId } = job.request;
  try {
    const paths = await uploadAll(job);
    update(projectId, job.run, () => ({ status: "designing", paths }));
    await design(job, paths);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The draft failed.";
    update(projectId, job.run, () => ({ status: "error", error: message }));
  } finally {
    announceCreditsChanged();
  }
}

async function uploadAll(job: DraftJob): Promise<string[]> {
  const { attachments, projectId } = job.request;
  const paths = [...job.paths];
  let next = 0;
  async function worker() {
    while (next < attachments.length) {
      const index = next;
      next += 1;
      const attachment = attachments[index];
      if (paths[index] || !attachment.dataUrl) continue;
      const { path, error } = await uploadImage(attachment.dataUrl);
      if (!path) throw new Error(error ?? `Could not upload ${attachment.name}.`);
      // Paint the screenshot from memory instead of fetching it back.
      setImage(path, attachment.dataUrl);
      paths[index] = path;
      update(projectId, job.run, () => ({ paths: [...paths] }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, attachments.length) }, worker));
  return paths;
}

async function design(job: DraftJob, paths: string[]) {
  const { request } = job;
  const screenshots = request.attachments.map((attachment, index) => ({ name: attachment.name, path: paths[index] }));
  const response = await apiFetch("/api/design/suggest-deck", {
    method: "POST",
    headers: { "content-type": "application/json", accept: DRAFT_STREAM_TYPE },
    body: JSON.stringify({
      messages: request.messages,
      locales: request.locales,
      device: request.device,
      screenshots: screenshots.length ? screenshots : undefined,
      styleReferences: request.styleReferences?.length ? request.styleReferences : undefined,
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "The AI could not draft a template right now. Try again.");
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { lines, rest } = splitLines(buffer + value);
    buffer = rest;
    for (const line of lines) {
      let event: DraftEvent;
      try {
        event = JSON.parse(line) as DraftEvent;
      } catch {
        continue;
      }
      if (event.type === "error") throw new Error(event.error);
      update(request.projectId, job.run, (current) => applyDraftEvent(current, event));
      if (event.type === "done") finished = true;
    }
  }
  if (!finished) throw new Error("The draft stopped before it finished. Try again.");
}

/** What one stream event changes on a job. */
export function applyDraftEvent(job: DraftJob, event: DraftEvent): Partial<DraftJob> {
  switch (event.type) {
    case "start":
      return { total: event.count };
    case "theme":
      return { theme: { appName: event.appName, themeId: event.themeId, customTheme: event.customTheme } };
    case "slide": {
      const slides = [...job.slides];
      slides[event.index] = event.slide;
      return { slides };
    }
    case "retry":
      return { slides: [], theme: undefined };
    case "done":
      return { status: "done", deck: event.deck, total: event.deck.slides.length, slides: event.deck.slides };
    default:
      return {};
  }
}
