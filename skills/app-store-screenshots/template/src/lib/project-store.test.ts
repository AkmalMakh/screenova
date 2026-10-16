import { describe, expect, it } from "vitest";
import {
  createProjectState,
  deleteProjectFromBundle,
  duplicateProjectState,
  ensureProjectMeta,
  mergeBundles,
  parseIndex,
  parseProjectFile,
  resolveActiveId,
  sanitizeProject,
  type ProjectBundle,
} from "./project-store";
import { PROJECTS_FILE_VERSION, projectStorageKey } from "./constants";
import type { ProjectState } from "./types";

function bundle(overrides: Partial<ProjectBundle> = {}): ProjectBundle {
  return {
    version: PROJECTS_FILE_VERSION,
    activeId: null,
    order: [],
    projects: {},
    ...overrides,
  };
}

const minimal = (id: string): ProjectState =>
  sanitizeProject({ appName: `App ${id}`, name: `Project ${id}` }, id);

describe("parseProjectFile", () => {
  it("recognizes a bundle", () => {
    const project = minimal("p1");
    const result = parseProjectFile(
      JSON.stringify({ activeId: "p1", order: ["p1"], projects: { p1: project } }),
    );
    expect(result.kind).toBe("bundle");
    if (result.kind === "bundle") {
      expect(result.bundle.projects["p1"]?.name).toBe("Project p1");
      expect(result.bundle.order).toEqual(["p1"]);
    }
  });

  it("tolerates a bundle missing version/activeId/order", () => {
    const project = minimal("p1");
    const result = parseProjectFile(JSON.stringify({ projects: { p1: project } }));
    expect(result.kind).toBe("bundle");
    if (result.kind === "bundle") {
      expect(result.bundle.activeId).toBeNull();
      expect(result.bundle.order).toEqual(["p1"]);
    }
  });

  it("treats a plain project object as legacy", () => {
    const result = parseProjectFile(JSON.stringify({ appName: "Legacy" }));
    expect(result).toEqual({ kind: "legacy", state: { appName: "Legacy" } });
  });

  it("treats null and garbage as none", () => {
    expect(parseProjectFile(null).kind).toBe("none");
    expect(parseProjectFile("not json").kind).toBe("none");
    expect(parseProjectFile(JSON.stringify([1, 2])).kind).toBe("none");
  });
});

describe("parseIndex", () => {
  it("parses a valid index and filters non-strings", () => {
    const index = parseIndex(JSON.stringify({ activeId: "p1", order: ["p1", 7, "p2"] }));
    expect(index).toEqual({ version: PROJECTS_FILE_VERSION, activeId: "p1", order: ["p1", "p2"] });
  });

  it("rejects malformed input", () => {
    expect(parseIndex(null)).toBeNull();
    expect(parseIndex("garbage")).toBeNull();
    expect(parseIndex(JSON.stringify({ activeId: "p1" }))).toBeNull();
  });
});

describe("ensureProjectMeta / sanitizeProject", () => {
  it("assigns id, name from appName, and updatedAt", () => {
    const state = sanitizeProject({ appName: "My Cool App" });
    expect(state.id).toMatch(/^p_/);
    expect(state.name).toBe("My Cool App");
    expect(typeof state.updatedAt).toBe("number");
  });

  it("falls back to a generic name when appName is empty", () => {
    const state = sanitizeProject({ appName: "  " });
    expect(state.name).toBe("My first project");
  });

  it("is idempotent and respects preferredId", () => {
    const first = ensureProjectMeta({ appName: "X" } as ProjectState, "p_preferred");
    expect(first.id).toBe("p_preferred");
    const second = ensureProjectMeta(first);
    expect(second).toEqual(first);
  });

  it("fills schema defaults through mergeWithDefaults", () => {
    const state = sanitizeProject({ appName: "X" });
    expect(state.schemaVersion).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(state.locales)).toBe(true);
    expect(state.slidesByDevice).toBeTruthy();
  });
});

describe("createProjectState / duplicateProjectState", () => {
  it("creates a default project with a name and meta", () => {
    const created = createProjectState("Launch");
    expect(created.name).toBe("Launch");
    expect(created.id).toMatch(/^p_/);
    expect(typeof created.updatedAt).toBe("number");
    expect(created.appName).toBe("My App");
  });

  it("duplicates with deep-cloned slides and a copy suffix", () => {
    const src = createProjectState("Original");
    const copy = duplicateProjectState(src);
    expect(copy.id).not.toBe(src.id);
    expect(copy.name).toBe("Original copy");
    expect(copy).not.toBe(src);
    expect(copy.slidesByDevice).not.toBe(src.slidesByDevice);
    expect(JSON.stringify(copy.slidesByDevice)).toBe(JSON.stringify(src.slidesByDevice));
  });
});

describe("mergeBundles", () => {
  it("recovers browser edits newer than the last completed file save", () => {
    const local = { ...minimal("p1"), updatedAt: 200, appName: "Unsaved edit" };
    const disk = { ...minimal("p1"), updatedAt: 100, appName: "Before edit" };
    expect(mergeBundles(
      bundle({ order: ["p1"], projects: { p1: local } }),
      bundle({ order: ["p1"], projects: { p1: disk } }),
    ).projects.p1.appName).toBe("Unsaved edit");
  });
  it("lets the file win per project id", () => {
    const localProject = { ...minimal("p1"), appName: "Local App" };
    const fileProject = { ...minimal("p1"), appName: "File App" };
    const merged = mergeBundles(
      bundle({ activeId: "p1", order: ["p1"], projects: { p1: localProject } }),
      bundle({ activeId: "p1", order: ["p1"], projects: { p1: fileProject } }),
    );
    expect(merged.projects["p1"]?.appName).toBe("File App");
  });

  it("unions ids with local order first and file activeId winning", () => {
    const merged = mergeBundles(
      bundle({
        activeId: "p1",
        order: ["p1", "p2"],
        projects: { p1: minimal("p1"), p2: minimal("p2") },
      }),
      bundle({
        activeId: "p3",
        order: ["p3"],
        projects: { p3: minimal("p3") },
      }),
    );
    expect(merged.order).toEqual(["p1", "p2", "p3"]);
    expect(merged.activeId).toBe("p3");
    expect(Object.keys(merged.projects).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("resolveActiveId", () => {
  it("returns a present activeId", () => {
    expect(resolveActiveId(bundle({ activeId: "p1", order: ["p1"], projects: { p1: minimal("p1") } }))).toBe("p1");
  });

  it("falls back to order[0] when activeId is stale or null", () => {
    expect(
      resolveActiveId(bundle({ activeId: "gone", order: ["p1"], projects: { p1: minimal("p1") } })),
    ).toBe("p1");
    expect(
      resolveActiveId(bundle({ activeId: null, order: ["p1"], projects: { p1: minimal("p1") } })),
    ).toBe("p1");
  });

  it("returns null for an empty bundle", () => {
    expect(resolveActiveId(bundle())).toBeNull();
  });
});

describe("deleteProjectFromBundle", () => {
  it("removes a non-active project and keeps the active one", () => {
    const next = deleteProjectFromBundle(
      bundle({
        activeId: "p1",
        order: ["p1", "p2"],
        projects: { p1: minimal("p1"), p2: minimal("p2") },
      }),
      "p2",
    );
    expect(next.order).toEqual(["p1"]);
    expect(next.activeId).toBe("p1");
    expect(next.projects["p2"]).toBeUndefined();
  });

  it("falls back to the next project when the active one is deleted", () => {
    const next = deleteProjectFromBundle(
      bundle({
        activeId: "p2",
        order: ["p1", "p2"],
        projects: { p1: minimal("p1"), p2: minimal("p2") },
      }),
      "p2",
    );
    expect(next.activeId).toBe("p1");
  });

  it("replaces the last project with a fresh default instead of an empty bundle", () => {
    const next = deleteProjectFromBundle(
      bundle({ activeId: "p1", order: ["p1"], projects: { p1: minimal("p1") } }),
      "p1",
    );
    expect(next.order).toHaveLength(1);
    expect(next.activeId).toBe(next.order[0]);
    expect(next.projects[next.order[0]]?.appName).toBe("My App");
    expect(next.projects[next.order[0]]?.id).toBe(next.order[0]);
  });
});

describe("projectStorageKey", () => {
  it("namespaces per-project keys", () => {
    expect(projectStorageKey("p1")).toBe("app-store-screenshots:project:v1:p1");
  });
});
