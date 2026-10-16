// Per-document identity, installed before the editor mounts. Never an auth source.
let owner: string | null = null;
export function setAccountScope(id: string | null) { owner = id; }
export function accountScope() { return owner; }
export function scopedKey(key: string) { return owner ? `screenova:${owner}:${key}` : key; }
export function apiFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (owner) headers.set("x-screenova-owner", owner);
  return fetch(input, { ...init, headers });
}
