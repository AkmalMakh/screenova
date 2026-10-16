"use client";

import { accountScope, apiFetch } from "./account-scope";
import { browserSupabase } from "./supabase/browser";

export type UploadOptions = {
  targetPath?: string; seedFromPath?: string; seedPaths?: string[];
  seedSources?: Array<{ sourcePath: string; targetPath: string }>;
};

// Only small metadata crosses the application server in cloud mode. Image bytes
// go straight to private Storage, protected by the signed-in user's RLS policies.
export async function uploadDataUrl(dataUrl: string, options: UploadOptions = {}): Promise<string | null> {
  const owner = accountScope();
  let cleanup: (() => Promise<unknown>) | undefined;
  try {
    let payload: Record<string, unknown> = { dataUrl, ...options };
    if (owner) {
      if (dataUrl.length > 11_200_000) return null;
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
      if (!match) return null;
      const binary = atob(match[2]);
      if (!binary.length || binary.length > 8 * 1024 * 1024) return null;
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const key = `${owner}/_uploads/${crypto.randomUUID()}.${match[1] === "jpeg" ? "jpg" : match[1]}`;
      const storage = browserSupabase().storage.from("project-assets");
      const { error } = await storage.upload(key, bytes, { contentType: `image/${match[1]}`, upsert: false });
      if (error) return null;
      cleanup = () => storage.remove([key]);
      if (accountScope() !== owner) return null;
      payload = { sourcePath: `/api/assets/${key}`, ...options };
    }
    const response = await apiFetch("/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok || accountScope() !== owner) return null;
    const result = await response.json() as { ok?: boolean; path?: string };
    return result.ok && result.path ? result.path : null;
  } catch {
    return null;
  } finally {
    // Also remove abandoned uploads when finalization fails. The server removes
    // completed staging objects, so a disconnected browser is harmless there.
    await cleanup?.().catch(() => undefined);
  }
}
