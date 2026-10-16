import { describe, expect, it } from "vitest";
import { acknowledgeCloudSnapshot, cloudHydration, readCloudSnapshot, writeCloudSnapshot } from "./cloud-cache";
import type { ProjectBundle } from "./project-store";

function storage() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}
const bundle = (ids: string[]) => ({ version: 1, activeId: ids[0] ?? null, order: ids, projects: Object.fromEntries(ids.map(id => [id, { id }])) }) as ProjectBundle;

describe("cloud snapshot revision provenance", () => {
  it("keeps stale-tab edits attached to r1 after another tab deletes at r2", () => {
    const cache = storage();
    writeCloudSnapshot(cache, "alice", { bundle: bundle(["kept"]), revision: "1", writer: "A" });
    acknowledgeCloudSnapshot(cache, "alice", "A", "1", "2");
    writeCloudSnapshot(cache, "alice", { bundle: bundle(["kept", "deleted"]), revision: "1", writer: "B" });
    const reloaded = readCloudSnapshot(cache, "alice")!;
    expect(reloaded.revision).toBe("1");
    expect(reloaded.revision).not.toBe("2"); // hydration must prefer server r2
    expect(reloaded.bundle.order).toContain("deleted"); // stale edits remain recoverable
    const hydrated = cloudHydration(reloaded.bundle, reloaded.revision, bundle(["kept"]), "2");
    expect(hydrated.changedRemotely).toBe(true);
    expect(hydrated.bundle.order).toEqual(["kept"]);
  });
  it("cannot promote another tab's stale cache when a response arrives late", () => {
    const cache = storage();
    writeCloudSnapshot(cache, "alice", { bundle: bundle(["old"]), revision: "1", writer: "B" });
    acknowledgeCloudSnapshot(cache, "alice", "A", "1", "2");
    expect(readCloudSnapshot(cache, "alice")?.revision).toBe("1");
  });
  it("preserves pending local deletions and edits when the server base has not changed", () => {
    const local = bundle(["kept", "new"]);
    const hydrated = cloudHydration(local, "1", bundle(["kept", "deleted"]), "1");
    expect(hydrated).toEqual({ bundle: local, changedRemotely: false });
  });
  it("rebases only this writer's newer pending edits and ignores obsolete acknowledgements", () => {
    const cache = storage();
    writeCloudSnapshot(cache, "alice", { bundle: bundle(["newer"]), revision: "1", writer: "A" });
    acknowledgeCloudSnapshot(cache, "alice", "A", "1", "2");
    expect(readCloudSnapshot(cache, "alice")).toEqual({ bundle: bundle(["newer"]), revision: "2", writer: "A" });
    acknowledgeCloudSnapshot(cache, "alice", "A", "1", "3");
    expect(readCloudSnapshot(cache, "alice")?.revision).toBe("2");
    expect(readCloudSnapshot(cache, "bob")).toBeNull();
  });
  it("does not trust old independent revision markers or malformed snapshots", () => {
    const cache = storage();
    cache.setItem("base-revision", "2");
    expect(readCloudSnapshot(cache, "alice")).toBeNull();
    for (const raw of ["{", "null", "{}", JSON.stringify({ bundle: bundle(["x"]), writer: "A" }),
      JSON.stringify({ bundle: { ...bundle(["x"]), order: ["missing"] }, revision: "1", writer: "A" })]) {
      cache.setItem("alice", raw);
      expect(readCloudSnapshot(cache, "alice")).toBeNull();
    }
  });
});
