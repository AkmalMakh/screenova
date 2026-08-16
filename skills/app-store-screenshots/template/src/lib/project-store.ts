import { PROJECTS_FILE_VERSION } from "./constants";
import { DEFAULT_PROJECT, pid } from "./defaults";
import { cloneProject } from "./design";
// Safe circular import: mergeWithDefaults is a hoisted function declaration and
// is only invoked at runtime (inside sanitizeProject), never at module init.
import { mergeWithDefaults } from "./storage";
import { localizeStarterDeck } from "./starter-copy";
import type { ProjectState } from "./types";

const LOCALE_CODE = /^[a-z]{2,8}(-[A-Za-z]{2,8})?$/;

// Clamp a requested locale list into a valid project locale list.
export function clampLocales(locales: string[] | undefined): string[] {
  if (!Array.isArray(locales)) return ["en"];
  const next = [...new Set(locales.filter((code) => typeof code === "string" && LOCALE_CODE.test(code)))];
  return next.length ? next : ["en"];
}

// Multi-project bundle: the localStorage index mirrors the git-tracked file
// so a fresh browser can reconstruct everything from the file alone.

export type ProjectIndex = {
  version: typeof PROJECTS_FILE_VERSION;
  activeId: string | null;
  order: string[];
};

export type ProjectBundle = {
  version: typeof PROJECTS_FILE_VERSION;
  activeId: string | null;
  order: string[];
  projects: Record<string, ProjectState>;
};

export type LoadedProjectFile =
  | { kind: "bundle"; bundle: ProjectBundle }
  | { kind: "legacy"; state: Partial<ProjectState> }
  | { kind: "none" };

/** Assign stable identity fields without clobbering existing ones. Idempotent. */
export function ensureProjectMeta(state: ProjectState, preferredId?: string): ProjectState {
  const name =
    state.name && state.name.trim()
      ? state.name
      : state.appName.trim()
        ? state.appName.trim()
        : "My first project";
  return {
    ...state,
    id: state.id || preferredId || pid(),
    name,
    updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : Date.now(),
  };
}

/** Per-project sanitation: merge over defaults, then attach identity fields. */
export function sanitizeProject(raw: Partial<ProjectState>, preferredId?: string): ProjectState {
  return ensureProjectMeta(mergeWithDefaults(raw), preferredId);
}

export function parseProjectFile(raw: string | null): LoadedProjectFile {
  if (!raw) return { kind: "none" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "none" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { kind: "none" };
  const candidate = parsed as Partial<ProjectBundle>;
  if (candidate.projects && typeof candidate.projects === "object" && !Array.isArray(candidate.projects)) {
    const projects: Record<string, ProjectState> = {};
    for (const [id, state] of Object.entries(candidate.projects)) {
      if (state && typeof state === "object") projects[id] = sanitizeProject(state as Partial<ProjectState>);
    }
    const order = Array.isArray(candidate.order)
      ? [...new Set([...candidate.order, ...Object.keys(projects)])].filter((id) => projects[id])
      : Object.keys(projects);
    const bundle: ProjectBundle = {
      version: PROJECTS_FILE_VERSION,
      activeId: candidate.activeId ?? null,
      order,
      projects,
    };
    return { kind: "bundle", bundle };
  }
  return { kind: "legacy", state: candidate as Partial<ProjectState> };
}

export function parseIndex(raw: string | null): ProjectIndex | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const index = parsed as Partial<ProjectIndex>;
    if (!Array.isArray(index.order)) return null;
    return {
      version: PROJECTS_FILE_VERSION,
      activeId: typeof index.activeId === "string" ? index.activeId : null,
      order: index.order.filter((id): id is string => typeof id === "string"),
    };
  } catch {
    return null;
  }
}

export function createProjectState(name?: string, locales?: string[]): ProjectState {
  const projectLocales = clampLocales(locales);
  const localizedDecks = Object.fromEntries(
    Object.entries(cloneProject(DEFAULT_PROJECT).slidesByDevice).map(([device, deck]) => [
      device,
      localizeStarterDeck(deck, projectLocales),
    ]),
  ) as ProjectState["slidesByDevice"];
  return ensureProjectMeta({
    ...cloneProject(DEFAULT_PROJECT),
    name: name?.trim() || "New project",
    locales: projectLocales,
    locale: projectLocales[0],
    slidesByDevice: localizedDecks,
  });
}

export function duplicateProjectState(src: ProjectState, name?: string): ProjectState {
  const copy = cloneProject(src);
  copy.id = undefined;
  return ensureProjectMeta({ ...copy, name: name?.trim() || `${src.name || "Project"} copy` });
}

/**
 * Merge the local bundle with the file bundle. The file is canonical per
 * project (matches the "file wins" hydration rule); ids that exist only on
 * one side are kept, with local ordering preserved first.
 */
export function mergeBundles(local: ProjectBundle, file: ProjectBundle): ProjectBundle {
  const projects = { ...local.projects, ...file.projects };
  const order = [...new Set([...local.order, ...file.order])].filter((id) => projects[id]);
  return {
    version: PROJECTS_FILE_VERSION,
    activeId: file.activeId && projects[file.activeId] ? file.activeId : local.activeId,
    order,
    projects,
  };
}

export function resolveActiveId(bundle: ProjectBundle): string | null {
  if (bundle.activeId && bundle.projects[bundle.activeId]) return bundle.activeId;
  const first = bundle.order.find((id) => bundle.projects[id]);
  return first ?? null;
}

/** Remove a project. The bundle never ends up empty — the last project is replaced by a fresh default. */
export function deleteProjectFromBundle(bundle: ProjectBundle, id: string): ProjectBundle {
  const projects = { ...bundle.projects };
  delete projects[id];
  const order = bundle.order.filter((entry) => entry !== id);
  if (!order.length || !Object.keys(projects).length) {
    const fresh = createProjectState();
    return {
      version: PROJECTS_FILE_VERSION,
      activeId: fresh.id ?? null,
      order: fresh.id ? [fresh.id] : [],
      projects: fresh.id ? { [fresh.id]: fresh } : {},
    };
  }
  return {
    version: PROJECTS_FILE_VERSION,
    activeId: bundle.activeId === id || !projects[bundle.activeId ?? ""] ? (order[0] ?? null) : bundle.activeId,
    order,
    projects,
  };
}
