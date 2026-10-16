import type { ProjectBundle } from "./project-store";

export type CloudSnapshot = { bundle: ProjectBundle; revision: string | null; writer: string };
type Cache = Pick<Storage, "getItem" | "setItem">;

// One atomic entry keeps an edit snapshot attached to the revision it came from.
export function readCloudSnapshot(cache: Cache, key: string): CloudSnapshot | null {
  try {
    const value = JSON.parse(cache.getItem(key) || "null") as CloudSnapshot | null;
    const bundle = value?.bundle;
    if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.order) ||
      !bundle.projects || typeof bundle.projects !== "object" || Array.isArray(bundle.projects) ||
      (value.revision !== null && typeof value.revision !== "string") || typeof value.writer !== "string" ||
      bundle.order.some(id => typeof id !== "string" || !Object.hasOwn(bundle.projects, id)) ||
      bundle.order.length !== Object.keys(bundle.projects).length || new Set(bundle.order).size !== bundle.order.length ||
      (bundle.activeId !== null && !Object.hasOwn(bundle.projects, bundle.activeId))) return null;
    return value;
  } catch { return null; }
}

export function writeCloudSnapshot(cache: Cache, key: string, snapshot: CloudSnapshot) {
  cache.setItem(key, JSON.stringify(snapshot));
}

export function cloudHydration(local: ProjectBundle, cachedRevision: string | null, server: ProjectBundle, serverRevision: string | undefined) {
  const changedRemotely = cachedRevision === null || cachedRevision !== serverRevision;
  // Same-base local snapshots are complete, including pending deletions. A
  // union merge would resurrect those deletions even without another tab.
  return { bundle: changedRemotely ? server : local, changedRemotely };
}

export function acknowledgeCloudSnapshot(cache: Cache, key: string, writer: string, previous: string | null, revision: string) {
  const snapshot = readCloudSnapshot(cache, key);
  // An older tab's successful response must not rebase another tab's edits.
  if (snapshot?.writer === writer && snapshot.revision === previous) {
    writeCloudSnapshot(cache, key, { ...snapshot, revision });
  }
}
