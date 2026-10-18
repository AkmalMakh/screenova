"use client";

import { accountScope, apiFetch } from "./account-scope";
import { browserSupabase } from "./supabase/browser";

export type UploadOptions = {
  targetPath?: string; seedFromPath?: string; seedPaths?: string[];
  seedSources?: Array<{ sourcePath: string; targetPath: string }>;
};

export type UploadResult = { path: string; error?: undefined } | { path: null; error?: string };

/** Path only, for callers that show their own message on failure. */
export async function uploadDataUrl(dataUrl: string, options: UploadOptions = {}): Promise<string | null> {
  return (await uploadImage(dataUrl, options)).path;
}

// Only small metadata crosses the application server in cloud mode. Image bytes
// go straight to private Storage, protected by the signed-in user's RLS policies.
// On a refusal from our own API (daily cap, access, outage) the server's message
// is returned so the user sees why, not a generic "please retry".
export async function uploadImage(dataUrl: string, options: UploadOptions = {}): Promise<UploadResult> {
  const owner = accountScope();
  let cleanup: (() => Promise<unknown>) | undefined;
  try {
    let payload: Record<string, unknown> = { dataUrl, ...options };
    if (owner) {
      if (dataUrl.length > 11_200_000) return { path: null };
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
      if (!match) return { path: null };
      const binary = atob(match[2]);
      if (!binary.length || binary.length > 8 * 1024 * 1024) return { path: null };
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const key = `${owner}/_uploads/${crypto.randomUUID()}.${match[1] === "jpeg" ? "jpg" : match[1]}`;
      const storage = browserSupabase().storage.from("project-assets");
      const { error } = await storage.upload(key, bytes, { contentType: `image/${match[1]}`, upsert: false });
      if (error) return { path: null };
      cleanup = () => storage.remove([key]);
      if (accountScope() !== owner) return { path: null };
      payload = { sourcePath: `/api/assets/${key}`, ...options };
    }
    const response = await apiFetch("/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (accountScope() !== owner) return { path: null };
    const result = await response.json().catch(() => ({})) as { ok?: boolean; path?: string; error?: unknown };
    if (response.ok && result.ok && result.path) return { path: result.path };
    return { path: null, error: typeof result.error === "string" && result.error ? result.error : undefined };
  } catch {
    return { path: null };
  } finally {
    // Also remove abandoned uploads when finalization fails. The server removes
    // completed staging objects, so a disconnected browser is harmless there.
    await cleanup?.().catch(() => undefined);
  }
}
