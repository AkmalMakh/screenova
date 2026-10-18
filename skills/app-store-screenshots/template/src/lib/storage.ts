"use client";
import { accountScope, apiFetch, scopedKey } from "./account-scope";
import { cloudPayloadTooLarge, WORKSPACE_TOO_LARGE } from "./cloud-payload";
import { acknowledgeCloudSnapshot, cloudHydration, readCloudSnapshot, writeCloudSnapshot } from "./cloud-cache";
import { backgroundFillSchema, frameStyleSchema, headlineStyleSchema } from "./slide-appearance";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteDesignMessages, migrateLegacyDesignChat } from "./chat-storage";
import {
  isHeadlineFontFamily,
  LAYOUT_LABEL,
  LEGACY_STORAGE_KEY,
  PROJECTS_FILE_VERSION,
  PROJECTS_INDEX_KEY,
  PROJECT_SCHEMA_VERSION,
  projectStorageKey,
} from "./constants";
import { isDecorationIconName } from "./decoration-icon-names";
import { cleanAwardBadge } from "./award-badge";
import { DEFAULT_PROJECT } from "./defaults";
import { coerceLocalized, normalizeProjectCopy } from "./locale";
import {
  createProjectState,
  deleteProjectFromBundle,
  duplicateProjectState,
  mergeBundles,
  parseIndex,
  parseProjectFile,
  resolveActiveId,
  sanitizeProject,
  type LoadedProjectFile,
  type ProjectBundle,
  type ProjectIndex,
} from "./project-store";
import type {
  DecorationElement,
  Device,
  ElementTransform,
  ProjectMeta,
  ProjectState,
  Slide,
  TextElement,
  Theme,
  VisualAsset,
} from "./types";

const HISTORY_LIMIT = 50;
// Coalesce rapid edits (typing, slider drags) into a single undo step.
const COALESCE_MS = 500;
// Debounce file/localStorage writes — frequent enough to feel instant, infrequent enough not to thrash disk.
const SAVE_DEBOUNCE_MS = 600;

function cleanTransform(value: unknown): ElementTransform | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<ElementTransform>;
  const required = [raw.x, raw.y, raw.width, raw.height];
  if (!required.every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  return {
    x: raw.x!,
    y: raw.y!,
    width: Math.max(1, raw.width!),
    height: Math.max(1, raw.height!),
    ...(typeof raw.rotation === "number" && Number.isFinite(raw.rotation)
      ? { rotation: raw.rotation }
      : {}),
    ...(typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex)
      ? { zIndex: raw.zIndex }
      : {}),
  };
}

function cleanTextElement(value: unknown): TextElement | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<TextElement>;
  if (typeof raw.id !== "string" || !raw.id.trim()) return undefined;
  const transform = cleanTransform(raw.transform);
  if (!transform) return undefined;
  return {
    id: raw.id,
    text: coerceLocalized(raw.text as unknown),
    transform,
    ...(typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)
      ? { fontSize: raw.fontSize }
      : {}),
    ...(typeof raw.fontWeight === "number" && Number.isFinite(raw.fontWeight)
      ? { fontWeight: raw.fontWeight }
      : {}),
    ...(typeof raw.color === "string" ? { color: raw.color } : {}),
    ...(raw.align === "left" || raw.align === "center" || raw.align === "right"
      ? { align: raw.align }
      : {}),
  };
}

function cleanDecoration(value: unknown): DecorationElement | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<DecorationElement>;
  if (typeof raw.id !== "string" || !raw.id.trim()) return undefined;
  if (
    raw.kind !== "ellipse" &&
    raw.kind !== "rounded-rectangle" &&
    raw.kind !== "line" &&
    raw.kind !== "icon-tile" &&
    raw.kind !== "award-badge"
  ) {
    return undefined;
  }
  const transform = cleanTransform(raw.transform);
  if (!transform || !raw.fill || !Array.isArray(raw.fill.colors)) return undefined;
  const colors = raw.fill.colors.filter(
    (color): color is string => typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color),
  );
  if (!colors.length) return undefined;
  return {
    id: raw.id,
    kind: raw.kind,
    ...(raw.kind === "award-badge" ? { badge: cleanAwardBadge(raw.badge) } : {}),
    transform,
    fill: {
      type: raw.fill.type === "linear-gradient" ? "linear-gradient" : "solid",
      colors: colors.slice(0, 3),
      ...(typeof raw.fill.angle === "number" && Number.isFinite(raw.fill.angle)
        ? { angle: Math.max(0, Math.min(360, raw.fill.angle)) }
        : {}),
    },
    opacity:
      typeof raw.opacity === "number" && Number.isFinite(raw.opacity)
        ? Math.max(0.05, Math.min(1, raw.opacity))
        : 1,
    ...(typeof raw.borderRadius === "number" && Number.isFinite(raw.borderRadius)
      ? { borderRadius: Math.max(0, raw.borderRadius) }
      : {}),
    ...(typeof raw.blur === "number" && Number.isFinite(raw.blur)
      ? { blur: Math.max(0, Math.min(80, raw.blur)) }
      : {}),
    // Drop an unknown icon key rather than the whole decoration; the renderer
    // falls back to a default glyph.
    ...(isDecorationIconName(raw.iconName) ? { iconName: raw.iconName } : {}),
    ...(typeof raw.iconColor === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.iconColor)
      ? { iconColor: raw.iconColor }
      : {}),
  };
}

function cleanVisualAsset(value: unknown): VisualAsset | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<VisualAsset>;
  if (typeof raw.src !== "string" || !raw.src.trim()) return undefined;
  return {
    src: raw.src,
    prompt: typeof raw.prompt === "string" ? raw.prompt.slice(0, 1_200) : "Generated visual",
    opacity:
      typeof raw.opacity === "number" && Number.isFinite(raw.opacity)
        ? Math.max(0.05, Math.min(1, raw.opacity))
        : 0.65,
  };
}

function cleanTheme(value: unknown): Theme | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<Theme>;
  const colors = [raw.bg, raw.bgAlt, raw.fg, raw.fgAlt, raw.accent, raw.muted];
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    !colors.every((color) => typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color))
  ) {
    return undefined;
  }
  return raw as Theme;
}

function cleanThemesByDevice(value: unknown): ProjectState["customThemesByDevice"] {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value)
    .map(([device, theme]) => [device, cleanTheme(theme)] as const)
    .filter((entry): entry is readonly [string, Theme] => !!entry[1]);
  return entries.length
    ? (Object.fromEntries(entries) as ProjectState["customThemesByDevice"])
    : undefined;
}

// Migrate older projects into the current schema while keeping legacy decks
// visually stable until they explicitly opt into connected canvas.
function migrateSlide(slide: Slide): Slide {
  const transforms = slide.transforms
    ? Object.fromEntries(
        Object.entries(slide.transforms)
          .map(([id, transform]) => [id, cleanTransform(transform)])
          .filter((entry): entry is [string, ElementTransform] => !!entry[1]),
      )
    : undefined;
  const textElements = Array.isArray(slide.textElements)
    ? slide.textElements.map(cleanTextElement).filter((t): t is TextElement => !!t)
    : undefined;
  const decorations = Array.isArray(slide.decorations)
    ? slide.decorations.map(cleanDecoration).filter((item): item is DecorationElement => !!item)
    : undefined;

  return {
    ...slide,
    // Layouts can disappear between app versions (e.g. a removed experiment);
    // clamp unknown values so old projects still render sensibly.
    layout: slide.layout in LAYOUT_LABEL ? slide.layout : "device-bottom",
    label: coerceLocalized(slide.label as unknown),
    headline: coerceLocalized(slide.headline as unknown),
    headlineFontFamily: isHeadlineFontFamily(slide.headlineFontFamily)
      ? slide.headlineFontFamily
      : undefined,
    ...(transforms && Object.keys(transforms).length > 0 ? { transforms } : { transforms: undefined }),
    ...(textElements && textElements.length > 0 ? { textElements } : { textElements: undefined }),
    ...(decorations && decorations.length > 0 ? { decorations } : { decorations: undefined }),
    backgroundFill: backgroundFillSchema.safeParse(slide.backgroundFill).data,
    frameStyle: frameStyleSchema.safeParse(slide.frameStyle).data,
    headlineStyle: headlineStyleSchema.safeParse(slide.headlineStyle).data,
    backgroundStyle: slide.backgroundStyle === "plain" ? "plain" : undefined,
    visualAsset: cleanVisualAsset(slide.visualAsset),
    canvasOffset: cleanCanvasOffset(slide.canvasOffset),
  };
}

// Workspace position must be finite; a zero offset is stored as absence.
function cleanCanvasOffset(
  offset: Slide["canvasOffset"],
): Slide["canvasOffset"] {
  if (!offset || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return undefined;
  if (offset.x === 0 && offset.y === 0) return undefined;
  return { x: offset.x, y: offset.y };
}

export function mergeWithDefaults(parsed: Partial<ProjectState>): ProjectState {
  const connectedCanvas =
    typeof parsed.connectedCanvas === "boolean"
      ? parsed.connectedCanvas
      : false;
  const themeId =
    typeof parsed.themeId === "string" && parsed.themeId.trim()
      ? parsed.themeId
      : DEFAULT_PROJECT.themeId;
  const slidesByDevice = parsed.slidesByDevice
    ? Object.fromEntries(
        Object.entries(parsed.slidesByDevice).map(([device, slides]) => [
          device,
          Array.isArray(slides) ? slides.map((slide) => migrateSlide(slide as Slide)) : [],
        ]),
      )
    : {};
  const merged: ProjectState = {
    ...DEFAULT_PROJECT,
    ...parsed,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    themeId,
    customTheme: cleanTheme(parsed.customTheme),
    customThemesByDevice: cleanThemesByDevice(parsed.customThemesByDevice),
    connectedCanvas,
    slidesByDevice: {
      ...DEFAULT_PROJECT.slidesByDevice,
      ...slidesByDevice,
    } as ProjectState["slidesByDevice"],
  };
  // Clamp the active locale into the project's locale list so a stale
  // `locale` (e.g. from a project that dropped languages) doesn't show blank.
  if (!merged.locales || merged.locales.length === 0) {
    merged.locales = [...DEFAULT_PROJECT.locales];
  }
  if (!merged.locales.includes(merged.locale)) {
    merged.locale = merged.locales[0];
  }
  return merged;
}

// ---------- Multi-project localStorage I/O ----------

function loadIndexFromLocalStorage(): ProjectIndex | null {
  if (typeof window === "undefined") return null;
  try {
    return parseIndex(window.localStorage.getItem(scopedKey(PROJECTS_INDEX_KEY)));
  } catch {
    return null;
  }
}

function saveIndexToLocalStorage(index: ProjectIndex): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: true };
  try {
    window.localStorage.setItem(scopedKey(PROJECTS_INDEX_KEY), JSON.stringify(index));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function loadProjectFromLocalStorage(id: string): ProjectState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(projectStorageKey(id));
    if (!raw) return null;
    return sanitizeProject(JSON.parse(raw) as Partial<ProjectState>, id);
  } catch {
    return null;
  }
}

function saveProjectToLocalStorage(state: ProjectState): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: true };
  try {
    window.localStorage.setItem(projectStorageKey(state.id || ""), JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function saveAllToLocalStorage(bundle: ProjectBundle): { ok: true } | { ok: false; error: string } {
  if (accountScope() && typeof window !== "undefined") {
    try {
      writeCloudSnapshot(window.localStorage, scopedKey("workspace-snapshot"), {
        bundle, revision: fileRevision ?? null, writer: cacheWriter(),
      });
      return { ok: true };
    } catch (error) { return { ok: false, error: String(error) }; }
  }
  const indexResult = saveIndexToLocalStorage({
    version: PROJECTS_FILE_VERSION,
    activeId: bundle.activeId,
    order: bundle.order,
  });
  let error: string | null = indexResult.ok ? null : indexResult.error;
  for (const [id, project] of Object.entries(bundle.projects)) {
    // Keep the id in state aligned with its storage key.
    const result = saveProjectToLocalStorage(project.id === id ? project : { ...project, id });
    if (!result.ok && !error) error = result.error;
  }
  return error ? { ok: false, error } : { ok: true };
}

// Write the index and per-project keys. `missingOnly` skips keys that already
// exist locally so a defensive file-merge can't clobber fresher local edits.
function rebuildLocalStorage(bundle: ProjectBundle, missingOnly: boolean) {
  if (typeof window === "undefined") return;
  if (accountScope()) { saveAllToLocalStorage(bundle); return; }
  saveIndexToLocalStorage({
    version: PROJECTS_FILE_VERSION,
    activeId: bundle.activeId,
    order: bundle.order,
  });
  for (const [id, project] of Object.entries(bundle.projects)) {
    if (missingOnly && loadProjectFromLocalStorage(id)) continue;
    saveProjectToLocalStorage(project.id === id ? project : { ...project, id });
  }
}

// First run: build the multi-project index. Migrates the legacy
// single-project key into a real project when present. A fresh default
// project is deliberately NOT seeded here: if a bundle file exists, its
// projects are the source of truth for a new browser, and seeding early
// would leave a stray "New project" behind. The hydration effect seeds one
// only when neither localStorage nor the file has anything.
function bootstrapLocal(): { bundle: ProjectBundle; migratedLegacyId: string | null; revision?: string | null } {
  if (typeof window === "undefined") {
    return {
      bundle: { version: PROJECTS_FILE_VERSION, activeId: null, order: [], projects: {} },
      migratedLegacyId: null,
    };
  }

  if (accountScope()) {
    const snapshot = readCloudSnapshot(window.localStorage, scopedKey("workspace-snapshot"));
    if (snapshot) return { bundle: snapshot.bundle, revision: snapshot.revision, migratedLegacyId: null };
    // Preserve old per-project caches below, but never trust their independent
    // revision marker. Hydration keeps them as recovery data, not server truth.
  }

  const existingIndex = loadIndexFromLocalStorage();
  if (existingIndex) {
    const projects: Record<string, ProjectState> = {};
    for (const id of existingIndex.order) {
      const stored = loadProjectFromLocalStorage(id);
      if (stored) projects[id] = stored;
    }
    const order = existingIndex.order.filter((id) => projects[id]);
    const bundle: ProjectBundle = {
      version: PROJECTS_FILE_VERSION,
      activeId: existingIndex.activeId && projects[existingIndex.activeId] ? existingIndex.activeId : order[0] ?? null,
      order,
      projects,
    };
    return { bundle, migratedLegacyId: null };
  }

  let legacy: Partial<ProjectState> | null = null;
  try {
    const raw = window.localStorage.getItem(scopedKey(LEGACY_STORAGE_KEY));
    if (raw) legacy = JSON.parse(raw) as Partial<ProjectState>;
  } catch {
    legacy = null;
  }
  if (legacy && typeof legacy === "object") {
    const project = sanitizeProject(legacy);
    const id = project.id || "";
    saveProjectToLocalStorage(project);
    const index: ProjectIndex = { version: PROJECTS_FILE_VERSION, activeId: id, order: [id] };
    saveIndexToLocalStorage(index);
    try {
      window.localStorage.removeItem(scopedKey(LEGACY_STORAGE_KEY));
    } catch {
      // Harmless: once the index exists the legacy key is ignored.
    }
    return { bundle: { ...index, projects: { [id]: project } }, migratedLegacyId: id };
  }

  return {
    bundle: { version: PROJECTS_FILE_VERSION, activeId: null, order: [], projects: {} },
    migratedLegacyId: null,
  };
}

// Create a default project only when nothing else exists (no local cache,
// no file) so the editor always has exactly one project to work with.
function seedFreshProject(): ProjectBundle {
  const project = createProjectState();
  const id = project.id || "";
  saveProjectToLocalStorage(project);
  const index: ProjectIndex = { version: PROJECTS_FILE_VERSION, activeId: id, order: [id] };
  saveIndexToLocalStorage(index);
  return { ...index, projects: { [id]: project } };
}

// ---------- File I/O (git-tracked bundle mirror) ----------

let fileRevision: string | undefined;
let snapshotWriter: string | undefined;
function cacheWriter() { return snapshotWriter ??= crypto.randomUUID(); }
let pendingFileSave: Promise<unknown> = Promise.resolve();

async function loadFromFile(): Promise<
  LoadedProjectFile | { ok: false; error: string }
> {
  if (typeof window === "undefined") return { ok: false, error: "Window is not available" };
  try {
    // Wait for the previous route's flush before hydrating its successor.
    await pendingFileSave;
    const resp = await apiFetch("/api/project", { cache: "no-store" });
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
    const json = (await resp.json()) as { ok: boolean; state: unknown; revision?: string };
    if (!json.ok) return { ok: false, error: "Project response was not ok" };
    fileRevision = json.revision;
    if (!json.state) return { kind: "none" };
    return parseProjectFile(
      typeof json.state === "string" ? json.state : JSON.stringify(json.state),
    );
  } catch {
    return { ok: false, error: "Project file could not be loaded" };
  }
}

function wrapLegacyFile(state: Partial<ProjectState>, preferredId?: string): ProjectBundle {
  const project = sanitizeProject(state, preferredId);
  const id = project.id || "";
  return { version: PROJECTS_FILE_VERSION, activeId: id, order: [id], projects: { [id]: project } };
}

function saveToFile(bundle: ProjectBundle): Promise<{ ok: true } | { ok: false; error: string }> {
  const save = pendingFileSave.then(() => writeToFile(bundle));
  pendingFileSave = save.then(() => undefined, () => undefined);
  return save;
}

async function writeToFile(bundle: ProjectBundle): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === "undefined") return { ok: true };
  try {
    const owner = accountScope();
    const previousRevision = fileRevision ?? null;
    const body = JSON.stringify(bundle);
    if (accountScope() && cloudPayloadTooLarge(body)) return { ok: false, error: WORKSPACE_TOO_LARGE };
    const resp = await apiFetch("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json", ...(fileRevision ? { "if-match": fileRevision } : {}) },
      body,
    });
    const json = (await resp.json()) as { ok: boolean; error?: string; revision?: string };
    if (!resp.ok || !json.ok) return { ok: false, error: json.error || `HTTP ${resp.status}` };
    fileRevision = json.revision;
    if (owner && accountScope() === owner && fileRevision) {
      try { acknowledgeCloudSnapshot(window.localStorage, scopedKey("workspace-snapshot"), cacheWriter(), previousRevision, fileRevision); } catch { /* Cache optional. */ }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type Updater = ProjectState | ((prev: ProjectState) => ProjectState);

function applyUpdater(updater: Updater, prev: ProjectState): ProjectState {
  return typeof updater === "function" ? updater(prev) : updater;
}

export function useProject() {
  const [bundle, _setBundle] = useState<ProjectBundle>({
    version: PROJECTS_FILE_VERSION,
    activeId: null,
    order: [],
    projects: {},
  });
  const [hydrated, setHydrated] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History stacks live in refs — they don't drive any rendered UI, so
  // mutating them never needs to re-render.
  const pastRef = useRef<ProjectState[]>([]);
  const futureRef = useRef<ProjectState[]>([]);
  const lastPushAt = useRef(0);
  // Set once the user performs a structural op (create/switch/duplicate/delete)
  // so a slow file fetch can't clobber their explicit action.
  const touchedRef = useRef(false);
  // Mirror of the latest bundle so the unmount flush below never reads stale state.
  const latestBundleRef = useRef<ProjectBundle>({
    version: PROJECTS_FILE_VERSION,
    activeId: null,
    order: [],
    projects: {},
  });
  latestBundleRef.current = bundle;
  const canFlushRef = useRef(false);
  canFlushRef.current = hydrated && fileReady;

  // Flush pending writes on unmount: the autosave is debounced, and a page
  // navigation (e.g. home page → editor right after importing a project)
  // clears the timer before it fires. Persisting the latest bundle here keeps
  // every created/patched project alive across routes.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      const current = latestBundleRef.current;
      if (!current.order.length || !canFlushRef.current) return;
      saveAllToLocalStorage(current);
      void saveToFile(current);
    };
  }, []);

  // Hydrate: localStorage first (instant paint), then the git-tracked file
  // overwrites where present. The file is the canonical mirror of localStorage.
  useEffect(() => {
    let cancelled = false;
    const local = bootstrapLocal();
    const cachedRevision = local.revision ?? null;
    // Preserve provenance if the first network read fails. Offline edits must
    // still be compared against their original cloud revision on reconnect.
    if (accountScope()) fileRevision = cachedRevision ?? undefined;
    _setBundle(local.bundle);
    if (local.migratedLegacyId) migrateLegacyDesignChat(local.migratedLegacyId);

    void (async () => {
      const fromFile = await loadFromFile();
      if (cancelled) return;
      if ("ok" in fromFile) {
        // File endpoint unavailable — seed a default project if local had
        // nothing, otherwise keep working from the local cache.
        if (!Object.keys(local.bundle.projects).length) {
          _setBundle(seedFreshProject());
        }
        setFileReady(false);
        setSaveError(fromFile.error);
      } else if (fromFile.kind === "none") {
        // No file yet — seed a fresh default if local had nothing;
        // autosave will create the file.
        if (!Object.keys(local.bundle.projects).length) {
          _setBundle(seedFreshProject());
        }
        setFileReady(true);
      } else {
        const fileBundle =
          fromFile.kind === "legacy"
            ? wrapLegacyFile(fromFile.state, local.migratedLegacyId ?? undefined)
            : fromFile.bundle;
        // A different cloud revision may contain deletions from another device.
        // Do not resurrect deleted projects from a stale browser cache.
        const cloud = accountScope() ? cloudHydration(local.bundle, cachedRevision, fileBundle, fileRevision) : null;
        const changedRemotely = cloud?.changedRemotely;
        if (changedRemotely && local.bundle.order.length) {
          try { window.localStorage.setItem(scopedKey("recovery-workspace"), JSON.stringify(local.bundle)); } catch { /* Preserve server state even if browser quota is full. */ }
        }
        const merged = cloud?.bundle ?? mergeBundles(local.bundle, fileBundle);
        // Never zero projects: an empty projects object in the file is
        // treated like a missing file.
        const finalBundle = Object.keys(merged.projects).length ? merged : seedFreshProject();
        rebuildLocalStorage(finalBundle, touchedRef.current);
        if (!touchedRef.current) _setBundle(finalBundle);
        setFileReady(true);
      }
      pastRef.current = [];
      futureRef.current = [];
      lastPushAt.current = 0;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced autosave of the whole bundle to localStorage and the file.
  useEffect(() => {
    if (!hydrated) return;
    // Cache edits immediately, including during a server outage or refresh.
    const localResult = saveAllToLocalStorage(bundle);
    if (!fileReady) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveToFile(bundle).then((fileResult) => {
        if (fileResult.ok && localResult.ok) {
          setSavedAt(Date.now());
          setSaveError(null);
        } else if (!fileResult.ok && !localResult.ok) {
          setSaveError(fileResult.error);
        } else if (!fileResult.ok) {
          // Local cache succeeded but file save failed — work isn't git-portable yet.
          setSavedAt(Date.now());
          setSaveError(`${accountScope() ? "Cloud" : "File"} save failed: ${fileResult.error}`);
        } else {
          setSavedAt(Date.now());
          setSaveError(localResult.ok ? null : localResult.error);
        }
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [bundle, hydrated, fileReady]);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    lastPushAt.current = 0;
  }, []);

  const setState = useCallback((updater: Updater, options?: { coalesce?: boolean }) => {
    _setBundle((prevBundle) => {
      const id = resolveActiveId(prevBundle);
      if (!id) return prevBundle;
      const prev = prevBundle.projects[id] ?? DEFAULT_PROJECT;
      const updated = applyUpdater(updater, prev);
      if (updated === prev) return prevBundle;
      const next = normalizeProjectCopy(updated);
      const now = Date.now();
      const structuralChange = prev.device !== next.device || prev.locale !== next.locale ||
        Object.keys(next.slidesByDevice).some((device) => {
          const key = device as Device;
          return (prev.slidesByDevice[key] || []).map((slide) => slide.id).join("\n") !==
            (next.slidesByDevice[key] || []).map((slide) => slide.id).join("\n");
        });
      if (structuralChange || options?.coalesce === false || now - lastPushAt.current > COALESCE_MS) {
        pastRef.current.push(prev);
        if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      }
      futureRef.current.length = 0;
      lastPushAt.current = structuralChange || options?.coalesce === false ? 0 : now;
      return {
        ...prevBundle,
        projects: {
          ...prevBundle.projects,
          [id]: { ...next, updatedAt: now },
        },
      };
    });
  }, []);

  const undo = useCallback(() => {
    _setBundle((cur) => {
      const id = resolveActiveId(cur);
      if (!id) return cur;
      const prev = pastRef.current.pop();
      if (prev === undefined) return cur;
      futureRef.current.push(cur.projects[id] ?? DEFAULT_PROJECT);
      // Reset coalescing so the next edit after an undo creates a fresh history entry.
      lastPushAt.current = 0;
      return { ...cur, projects: { ...cur.projects, [id]: { ...prev, updatedAt: Date.now() } } };
    });
  }, []);

  const redo = useCallback(() => {
    _setBundle((cur) => {
      const id = resolveActiveId(cur);
      if (!id) return cur;
      const next = futureRef.current.pop();
      if (next === undefined) return cur;
      pastRef.current.push(cur.projects[id] ?? DEFAULT_PROJECT);
      lastPushAt.current = 0;
      return { ...cur, projects: { ...cur.projects, [id]: { ...next, updatedAt: Date.now() } } };
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...DEFAULT_PROJECT,
      id: prev.id,
      name: prev.name,
      updatedAt: Date.now(),
    }));
  }, [setState]);

  const resetDevice = useCallback((device: Device) => {
    setState((prev) => ({
      ...prev,
      slidesByDevice: {
        ...prev.slidesByDevice,
        [device]: DEFAULT_PROJECT.slidesByDevice[device],
      },
    }));
  }, [setState]);

  // ---------- Structural project operations ----------
  // Side effects inside the functional updaters are deliberate: they're
  // idempotent writes, and they guarantee the index + affected keys hit
  // localStorage before a potential instant refresh (React runs updaters
  // before paint; StrictMode double-invocation writes identical values).

  const createProject = useCallback(
    (name?: string, locales?: string[]): ProjectState => {
      const created = createProjectState(name, locales);
      const id = created.id || "";
      _setBundle((prev) => {
        const next: ProjectBundle = {
          ...prev,
          activeId: id,
          order: [...prev.order, id],
          projects: { ...prev.projects, [id]: created },
        };
        saveAllToLocalStorage(next);
        return next;
      });
      clearHistory();
      touchedRef.current = true;
      return created;
    },
    [clearHistory],
  );

  const switchProject = useCallback((id: string) => {
    _setBundle((prev) => {
      if (prev.activeId === id || !prev.projects[id]) return prev;
      const next = { ...prev, activeId: id };
      saveAllToLocalStorage(next);
      return next;
    });
    clearHistory();
    touchedRef.current = true;
  }, [clearHistory]);

  const renameProject = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    _setBundle((prev) => {
      const project = prev.projects[id];
      if (!project || project.name === trimmed) return prev;
      const next = { ...project, name: trimmed, updatedAt: Date.now() };
      const nextBundle = { ...prev, projects: { ...prev.projects, [id]: next } };
      saveAllToLocalStorage(nextBundle);
      return nextBundle;
    });
  }, []);

  const duplicateProject = useCallback((id: string) => {
    _setBundle((prev) => {
      const src = prev.projects[id];
      if (!src) return prev;
      const copy = duplicateProjectState(src);
      const copyId = copy.id || "";
      const idx = prev.order.indexOf(id);
      const order =
        idx === -1
          ? [...prev.order, copyId]
          : [...prev.order.slice(0, idx + 1), copyId, ...prev.order.slice(idx + 1)];
      const next = {
        ...prev,
        activeId: copyId,
        order,
        projects: { ...prev.projects, [copyId]: copy },
      };
      saveAllToLocalStorage(next);
      return next;
    });
    clearHistory();
    touchedRef.current = true;
  }, [clearHistory]);

  const deleteProject = useCallback((id: string) => {
    _setBundle((prev) => {
      const next = deleteProjectFromBundle(prev, id);
      try {
        window.localStorage.removeItem(projectStorageKey(id));
      } catch {
        // Ignore — the bundle is authoritative.
      }
      deleteDesignMessages(id);
      saveAllToLocalStorage(next);
      return next;
    });
    clearHistory();
    touchedRef.current = true;
  }, [clearHistory]);

  const state = (bundle.activeId && bundle.projects[bundle.activeId]) || DEFAULT_PROJECT;

  const projects = useMemo<ProjectMeta[]>(
    () =>
      bundle.order
        .filter((id) => bundle.projects[id])
        .map((id) => {
          const project = bundle.projects[id];
          return {
            id,
            name: project.name || "Project",
            updatedAt: project.updatedAt || 0,
          };
        }),
    [bundle],
  );

  return {
    state,
    setState,
    hydrated,
    savedAt,
    saveError,
    reset,
    resetDevice,
    undo,
    redo,
    projects,
    /** Full project states by id, for previews (Studio recent projects). */
    projectStates: bundle.projects,
    activeProjectId: bundle.activeId,
    createProject,
    switchProject,
    renameProject,
    duplicateProject,
    deleteProject,
  };
}
