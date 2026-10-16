import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Access, CloudAccess } from "./access";

export const ASSET_BUCKET = "project-assets";
export function assetKey(url: string, userId: string): string {
  const prefix = `/api/assets/${userId}/`;
  if (!url.startsWith(prefix)) throw new Error("Image does not belong to this account");
  const parts = url.slice("/api/assets/".length).split("/");
  if (parts.some(p => !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(p) || p.includes(".."))) throw new Error("Invalid image path");
  return parts.join("/");
}

export async function storeAsset(access: CloudAccess, bytes: Buffer, mime: string, target?: string) {
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  const key = target ? assetKey(target, access.userId) : `${access.userId}/${createHash("sha256").update(bytes).digest("hex")}.${ext}`;
  const { error } = await access.client.storage.from(ASSET_BUCKET).upload(key, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error("Image could not be saved to private storage");
  return `/api/assets/${key}`;
}

export async function readAsset(access: Access, url: string): Promise<Buffer> {
  if (access.client) {
    const key = assetKey(url, access.userId);
    const { data, error } = await access.client.storage.from(ASSET_BUCKET).download(key);
    if (error || !data) throw new Error("Private image unavailable");
    return Buffer.from(await data.arrayBuffer());
  }
  if (!/^\/screenshots\/[a-zA-Z0-9/_.-]+$/.test(url) || url.includes("..")) throw new Error("Invalid image path");
  return fs.readFile(path.join(process.cwd(), "public", url.slice(1)));
}
