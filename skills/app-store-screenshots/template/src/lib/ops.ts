import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent } from "@sentry/nextjs";
import { after } from "next/server";
import { storageMode } from "./supabase/config";

// Operator signals for the hosted beta.
//
//   call site (access.ts, middleware.ts, api routes)
//        │  report(stage, error, ctx, level)
//        ▼
//   scrub ctx to an allow-list ──► one console line (always; Vercel logs)
//        │
//        ├─ local mode / no Sentry client / same event < 1 min ago ──► stop
//        ▼
//   Sentry capture (tags only, no request data) ──► after(flush) when a request scope exists
//
// report() is void and never throws: a broken alert path must not turn a
// handled 4xx/5xx into a crash. Never pass emails, tokens, bodies or headers;
// exception messages are replaced by the stage name before they leave.

export type OpsContext = { kind?: string; code?: unknown; userId?: string; requestId?: string | null };
type Level = "error" | "warning";

const SAFE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = ["cookie", "authorization", "x-screenova-owner"];

/** Accept only short code-like tokens (PostgREST, SQLSTATE, OpenAI codes). */
export function safeCode(code: unknown): string | undefined {
  return typeof code === "string" && SAFE_TOKEN.test(code) ? code : undefined;
}

export function scrubContext(stage: string, ctx: OpsContext = {}): Record<string, string> {
  const out: Record<string, string> = { stage: SAFE_TOKEN.test(stage) ? stage : "invalid_stage" };
  if (ctx.kind && SAFE_TOKEN.test(ctx.kind)) out.kind = ctx.kind;
  const code = safeCode(ctx.code);
  if (code) out.code = code;
  if (ctx.userId && UUID.test(ctx.userId)) out.userId = ctx.userId;
  if (ctx.requestId && SAFE_TOKEN.test(ctx.requestId)) out.requestId = ctx.requestId;
  return out;
}

/**
 * Sentry beforeSend for every event, including ones the SDK captures on its own
 * (uncaught errors, rejections): drop request payloads, credential headers,
 * query strings and breadcrumbs, and replace exception messages with the stage.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const stage = typeof event.tags?.stage === "string" && SAFE_TOKEN.test(event.tags.stage) ? event.tags.stage : "redacted";
  for (const exception of event.exception?.values ?? []) exception.value = stage;
  delete event.breadcrumbs;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (typeof event.request.url === "string") event.request.url = event.request.url.split("?")[0];
    const headers = event.request.headers;
    if (headers) for (const name of Object.keys(headers)) if (PRIVATE_HEADERS.includes(name.toLowerCase())) delete headers[name];
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}

// At most one Sentry event per stage+kind+code per window per server instance.
// The alert rule emails on every event, so an outage that fails thousands of
// requests must not become thousands of emails or burn the event quota. Every
// occurrence still writes its console line to Vercel logs.
//   "minute" (default): outages, re-alert while they last.
//   "day" (UTC): planned limits (OpenAI quota, shared beta pool) that can last
//   for days; one alert per day is the signal, the rest is noise.
export type ReportWindow = "minute" | "day";
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const lastSent = new Map<string, number>();

function throttled(tags: Record<string, string>, window: ReportWindow): boolean {
  const key = `${window}|${tags.stage}|${tags.kind ?? "-"}|${tags.code ?? "-"}`;
  const now = Date.now();
  const previous = lastSent.get(key);
  const repeat = window === "day"
    ? previous !== undefined && Math.floor(previous / DAY_MS) === Math.floor(now / DAY_MS)
    : previous !== undefined && now - previous < MINUTE_MS;
  if (repeat) return true;
  lastSent.set(key, now);
  return false;
}

function cloudReporting(): boolean {
  try {
    return storageMode() !== "local" && Boolean(Sentry.getClient());
  } catch {
    return false;
  }
}

/**
 * Exception messages can carry user content (model output built from deck
 * text, provider bodies, SQL values). Keep the error's type and stack frames for
 * grouping and debugging; replace the message with the stage name.
 */
export function redactedError(error: unknown, stage: string): Error {
  const name = error instanceof Error && SAFE_TOKEN.test(error.name) ? error.name : "Error";
  const safe = new Error(stage);
  safe.name = name;
  if (error instanceof Error && typeof error.stack === "string") {
    const frames = error.stack.split("\n").filter((line) => /^\s+at /.test(line));
    safe.stack = [`${name}: ${stage}`, ...frames].join("\n");
  }
  return safe;
}

export function report(stage: string, error?: unknown, ctx: OpsContext = {}, level: Level = "error", window: ReportWindow = "minute"): void {
  try {
    const tags = scrubContext(stage, ctx);
    (level === "warning" ? console.warn : console.error)("screenova_ops", tags);
    if (!cloudReporting() || throttled(tags, window)) return;
    const { userId, requestId, ...rest } = tags;
    const options = {
      level,
      tags: rest,
      extra: requestId ? { requestId } : undefined,
      user: userId ? { id: userId } : undefined,
      fingerprint: ["screenova", tags.stage, tags.kind ?? "-", tags.code ?? "-"],
    };
    if (error === undefined) Sentry.captureMessage(`screenova ${tags.stage}`, options);
    else Sentry.captureException(redactedError(error, tags.stage), options);
    // Serverless functions can freeze right after the response; flush once the
    // response has been sent so early-return error paths still deliver.
    try {
      after(() => Sentry.flush(2000));
    } catch {
      // Outside a request scope (tests, scripts) or on a runtime without after().
    }
  } catch {
    // Reporting must never throw.
  }
}

/** Vercel's per-request id, safe to log and to quote in support emails. */
export function requestIdOf(req?: Request): string | null {
  return req?.headers.get("x-vercel-id") ?? null;
}
