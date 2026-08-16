import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeLookupResult, parseAppStoreUrl } from "@/lib/app-store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LOOKUP_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_SCREENSHOTS = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const requestSchema = z.object({
  url: z.string().trim().min(8).max(500),
  device: z.enum(["iphone", "ipad", "android"]).optional(),
});

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const URL_EXT: Record<string, string> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  webp: "webp",
};

/** Download an image into the public dir; returns the public path or null. */
async function downloadImage(url: string, absFile: string): Promise<string | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) return null;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const urlMatch = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  const ext = MIME_EXT[contentType] || URL_EXT[(urlMatch?.[1] || "").toLowerCase()];
  if (!ext) return null;
  const target = `${absFile}.${ext}`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return `${path.basename(absFile)}.${ext}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON request." }, { status: 400 });
  }

  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { ok: false, error: "Enter an App Store link first." },
      { status: 400 },
    );
  }
  const link = parseAppStoreUrl(validation.data.url);
  if (!link) {
    return NextResponse.json(
      { ok: false, error: "That doesn't look like an App Store link." },
      { status: 400 },
    );
  }
  const device = validation.data.device || "iphone";

  const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(link.appId)}&country=${encodeURIComponent(link.country)}`;
  let app;
  try {
    const response = await fetch(lookupUrl, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `The App Store lookup failed (HTTP ${response.status}).` },
        { status: 502 },
      );
    }
    app = normalizeLookupResult((await response.json()) as unknown, link);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The App Store lookup failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
  if (!app) {
    return NextResponse.json({ ok: false, error: "No app found for that link." }, { status: 404 });
  }

  // The appId is digits-only, so the directory name is safe by construction.
  const publicDir = `/screenshots/app-store/${link.appId}`;
  const absDir = path.join(process.cwd(), "public", ...publicDir.split("/").filter(Boolean));

  let iconPath = "";
  if (app.artworkUrl512) {
    const filename = await downloadImage(app.artworkUrl512, path.join(absDir, "icon"));
    if (filename) iconPath = `${publicDir}/${filename}`;
  }

  const preferred = device === "ipad" ? app.ipadScreenshotUrls : app.screenshotUrls;
  const fallback = device === "ipad" ? app.screenshotUrls : app.ipadScreenshotUrls;
  const sources = [...new Set([...preferred, ...fallback])].slice(0, MAX_SCREENSHOTS);

  const screenshots: Array<{ name: string; path: string }> = [];
  let skipped = 0;
  for (let index = 0; index < sources.length; index += 1) {
    const filename = await downloadImage(sources[index], path.join(absDir, `screen-${index + 1}`));
    if (!filename) {
      skipped += 1;
      continue;
    }
    screenshots.push({ name: `Screen ${index + 1}`, path: `${publicDir}/${filename}` });
  }

  if (!screenshots.length) {
    return NextResponse.json(
      { ok: false, error: "Could not download the app's screenshots." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, app, iconPath, screenshots, skipped });
}
