import { afterEach, describe, expect, it, vi } from "vitest";

// Execute the real useProject hook/effects without a DOM dependency. This
// models state/ref persistence, dependency changes and cleanup, not rendering.
const hooks = vi.hoisted(() => {
  type Effect = { deps?: unknown[]; cleanup?: () => void };
  const state = {
    cursor: 0, dirty: true, slots: [] as unknown[],
    effects: new Map<number, Effect>(), pending: [] as Array<() => void>,
  };
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  return {
    state,
    reset() { state.cursor = 0; state.dirty = true; state.slots = []; state.effects.clear(); state.pending = []; },
    unmount() { for (const effect of state.effects.values()) effect.cleanup?.(); state.effects.clear(); },
    useState<T>(initial: T) {
      const index = state.cursor++;
      if (!(index in state.slots)) state.slots[index] = initial;
      return [state.slots[index] as T, (update: T | ((old: T) => T)) => {
        const old = state.slots[index] as T;
        const next = typeof update === "function" ? (update as (old: T) => T)(old) : update;
        if (!Object.is(old, next)) { state.slots[index] = next; state.dirty = true; }
      }] as const;
    },
    useRef<T>(initial: T) {
      const index = state.cursor++;
      if (!(index in state.slots)) state.slots[index] = { current: initial };
      return state.slots[index] as { current: T };
    },
    useMemo<T>(factory: () => T, deps?: unknown[]) {
      const index = state.cursor++;
      const old = state.slots[index] as { value: T; deps?: unknown[] } | undefined;
      if (!old || !same(old.deps, deps)) state.slots[index] = { value: factory(), deps };
      return (state.slots[index] as { value: T }).value;
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = state.cursor++;
      const old = state.effects.get(index);
      if (old && same(old.deps, deps)) return;
      const next: Effect = { deps };
      state.effects.set(index, next);
      state.pending.push(() => { old?.cleanup?.(); next.cleanup = effect() || undefined; });
    },
  };
});
vi.mock("react", () => ({
  useState: hooks.useState, useRef: hooks.useRef, useMemo: hooks.useMemo,
  useEffect: hooks.useEffect,
  useCallback: <T>(callback: T, deps?: unknown[]) => hooks.useMemo(() => callback, deps),
}));

async function mountProject() {
  hooks.reset();
  const { useProject } = await import("./storage");
  let result: ReturnType<typeof useProject>;
  const flush = () => {
    for (let passes = 0; hooks.state.dirty; passes++) {
      if (passes > 30) throw new Error("Hook render did not settle");
      hooks.state.dirty = false;
      hooks.state.cursor = 0;
      result = useProject();
      const effects = hooks.state.pending.splice(0);
      effects.forEach(effect => effect());
    }
    return result!;
  };
  flush();
  await vi.waitFor(() => expect(flush().hydrated).toBe(true));
  return { current: flush, unmount: hooks.unmount };
}

afterEach(() => {
  hooks.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("cloud useProject hydration lifecycle", () => {
  it("retains the cached base revision through a failed GET, offline edit and fresh-document reconnect", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const entries = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    };
    vi.stubGlobal("window", { localStorage });
    const { createProjectState } = await import("./project-store");
    const project = createProjectState("Cached campaign");
    const id = project.id!;
    const original = { version: 1, activeId: id, order: [id], projects: { [id]: { ...project, appName: "Server original" } } };
    const cacheKey = "screenova:alice:workspace-snapshot";
    localStorage.setItem(cacheKey, JSON.stringify({ bundle: original, revision: "r1", writer: "previous-document" }));
    (await import("./account-scope")).setAccountScope("alice");
    const fetchMock = vi.fn().mockResolvedValue(new Response("Offline", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const offline = await mountProject();
    expect(offline.current().saveError).toBe("HTTP 503");
    expect(offline.current().state.appName).toBe("Server original");
    offline.current().setState(previous => ({ ...previous, appName: "Offline edit to keep" }));
    offline.current();
    const edited = JSON.parse(localStorage.getItem(cacheKey)!);
    expect(edited.revision).toBe("r1");
    expect(edited.bundle.projects[id].appName).toBe("Offline edit to keep");
    await vi.advanceTimersByTimeAsync(700);
    expect(fetchMock).toHaveBeenCalledTimes(1); // Failed hydration must never autosave.
    offline.unmount();

    // A real reload resets module-level fileRevision and writer identity while
    // browser storage survives. Reconnecting to the unchanged base keeps edits.
    vi.resetModules();
    (await import("./account-scope")).setAccountScope("alice");
    fetchMock.mockImplementation(async (_input, init) => init?.method === "POST"
      ? Response.json({ ok: true, revision: "r2" })
      : Response.json({ ok: true, state: original, revision: "r1" }));
    const online = await mountProject();
    expect(online.current().state.appName).toBe("Offline edit to keep");
    expect(localStorage.getItem("screenova:alice:recovery-workspace")).toBeNull();
    expect(JSON.parse(localStorage.getItem(cacheKey)!).revision).toBe("r1");
    await vi.advanceTimersByTimeAsync(700);
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][1].headers.get("if-match")).toBe("r1");
    expect(JSON.parse(posts[0][1].body).projects[id].appName).toBe("Offline edit to keep");
    expect(JSON.parse(localStorage.getItem(cacheKey)!).revision).toBe("r2");
  });
});
