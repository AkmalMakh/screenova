import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { authorizeRequest, type Access } from "@/lib/supabase/access";
import { ASSET_BUCKET, assetKey, readAsset, storeAsset } from "@/lib/supabase/assets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPLOAD_DIR_REL = path.join("public", "screenshots", "uploaded");
const PUBLIC_PREFIX = "/screenshots/uploaded";
const LOCALIZED_PREFIX = "/screenshots/localized/";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length || bytes.toString("base64").replace(/=+$/, "") !== m[2].replace(/=+$/, "")) return null;
  return { mime, bytes };
}

function localizedTarget(publicPath: string | undefined, ext: string): string | null {
  if (!publicPath || typeof publicPath !== "string") return null;
  if (!publicPath.startsWith(LOCALIZED_PREFIX)) return null;
  if (publicPath.includes("{locale}") || publicPath.includes("..")) return null;
  const normalized = path.posix.normalize(publicPath);
  if (normalized !== publicPath || !normalized.startsWith(LOCALIZED_PREFIX)) return null;
  const parsed = path.posix.parse(normalized);
  const safeName = parsed.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "screenshot";
  const safeExt = parsed.ext && /^\.(png|jpe?g|webp)$/i.test(parsed.ext) ? parsed.ext : `.${ext}`;
  return path.posix.join(parsed.dir, `${safeName}${safeExt.toLowerCase()}`);
}

function publicFilePath(publicPath: string | undefined): string | null {
  if (!publicPath || typeof publicPath !== "string") return null;
  if (!publicPath.startsWith("/screenshots/")) return null;
  if (publicPath.includes("{locale}") || publicPath.includes("..")) return null;
  const normalized = path.posix.normalize(publicPath);
  if (normalized !== publicPath || !normalized.startsWith("/screenshots/")) return null;
  return path.join(process.cwd(), "public", ...normalized.split("/").filter(Boolean));
}

// Localized paths retain their extension when a locale's screenshot is
// replaced. Encode to that extension instead of writing JPEG bytes into .png.
async function encodeForPath(bytes: Buffer, publicPath: string): Promise<Buffer> {
  const image = sharp(bytes, { limitInputPixels: 64_000_000 });
  const extension = path.posix.extname(publicPath).toLowerCase();
  if (extension === ".webp") return image.webp().toBuffer();
  if (extension === ".jpg" || extension === ".jpeg") return image.jpeg().toBuffer();
  return image.png().toBuffer();
}

export async function POST(req: Request) {
  const access = await authorizeRequest(req, "upload");
  if ("response" in access) return access.response;
  let body: UploadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }
  let stagingKey: string | undefined;
  if (body.sourcePath !== undefined) {
    try {
      if (!access.client || body.dataUrl !== undefined || typeof body.sourcePath !== "string") throw new Error();
      stagingKey = assetKey(body.sourcePath, access.userId);
      if (!new RegExp(`^${access.userId}/_uploads/[a-f0-9-]{36}\\.(png|jpg|webp)$`).test(stagingKey)) throw new Error();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid upload source." }, { status: 400 });
    }
  }
  try {
    return await finishUpload(body, access);
  } finally {
    if (stagingKey && access.client) {
      await access.client.storage.from(ASSET_BUCKET).remove([stagingKey]).catch(() => undefined);
    }
  }
}

type UploadBody = {
  dataUrl?: string; sourcePath?: string; targetPath?: string; seedFromPath?: string; seedPaths?: string[];
  seedSources?: Array<{ sourcePath: string; targetPath: string }>;
};

async function finishUpload(body: UploadBody, access: Access) {
  if (access.client) {
    try {
      const normalize = (value: string) => value.startsWith("/api/assets/")
        ? `/screenshots/${assetKey(value, access.userId).slice(access.userId.length + 1)}` : value;
      if (body.targetPath) body.targetPath = normalize(body.targetPath);
      if (Array.isArray(body.seedPaths)) body.seedPaths = body.seedPaths.map(normalize);
      if (Array.isArray(body.seedSources)) body.seedSources = body.seedSources.map(seed => ({ ...seed, targetPath: normalize(seed.targetPath) }));
    } catch { return NextResponse.json({ ok: false, error: "Invalid screenshot destination." }, { status: 400 }); }
  }
  if (!body.sourcePath && (!body.dataUrl || typeof body.dataUrl !== "string")) {
    return NextResponse.json({ ok: false, error: "Missing dataUrl" }, { status: 400 });
  }
  if (body.dataUrl && body.dataUrl.length > 11_200_000) {
    return NextResponse.json({ ok: false, error: "Image too large (>8MB)" }, { status: 413 });
  }
  let parsed: { mime: string; bytes: Buffer } | null;
  if (body.sourcePath) {
    try {
      const bytes = await readAsset(access, body.sourcePath);
      const extension = body.sourcePath.split(".").at(-1);
      parsed = { bytes, mime: extension === "jpg" ? "image/jpeg" : `image/${extension}` };
    } catch {
      return NextResponse.json({ ok: false, error: "Uploaded image unavailable. Please retry." }, { status: 400 });
    }
  } else {
    parsed = parseDataUrl(body.dataUrl!);
  }
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Unsupported data URL" }, { status: 400 });
  }
  const ext = MIME_EXT[parsed.mime];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: `Unsupported mime: ${parsed.mime}` },
      { status: 400 },
    );
  }
  if (parsed.bytes.byteLength > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Image too large (>8MB)" }, { status: 413 });
  }
  try {
    const metadata = await sharp(parsed.bytes, { limitInputPixels: 64_000_000 }).metadata();
    const expected = ext === "jpg" ? "jpeg" : ext;
    if (metadata.format !== expected || !metadata.width || !metadata.height) throw new Error("Invalid image");
  } catch {
    return NextResponse.json({ ok: false, error: "The file is not a valid PNG, JPEG, or WebP image." }, { status: 400 });
  }
  if (body.targetPath && !localizedTarget(body.targetPath, ext)) {
    return NextResponse.json({ ok: false, error: "Invalid screenshot destination." }, { status: 400 });
  }

  if (body.seedSources !== undefined && (!body.targetPath || !Array.isArray(body.seedSources) || body.seedSources.length > 12 ||
    body.seedSources.some(seed => !seed || typeof seed.sourcePath !== "string" ||
      !localizedTarget(seed.targetPath, ext) || seed.targetPath === body.targetPath))) {
    return NextResponse.json({ ok: false, error: "Invalid screenshot sources." }, { status: 400 });
  }

  // Copy every unaffected locale from its own old image, not from the active
  // locale. Fail the operation if any copy fails; keep the old project unchanged.
  if (body.seedSources?.length) {
    try {
      for (const seed of body.seedSources) {
        const bytes = await encodeForPath(await readAsset(access, seed.sourcePath), seed.targetPath);
        if (access.client) {
          const target = `/api/assets/${access.userId}/${seed.targetPath.slice("/screenshots/".length)}`;
          const mime = /\.jpe?g$/.test(target) ? "image/jpeg" : target.endsWith(".webp") ? "image/webp" : "image/png";
          await storeAsset(access, bytes, mime, target);
        } else {
          const target = publicFilePath(seed.targetPath)!;
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, bytes, { flag: "wx" });
        }
      }
    } catch { return NextResponse.json({ ok: false, error: "Other language images could not be preserved. Please retry." }, { status: 503 }); }
  }

  if (access.client) {
    try {
      // Preserve the existing per-locale pattern while namespacing every file.
      const cloudPath = (local: string) => `/api/assets/${access.userId}/${local.slice("/screenshots/".length)}`;
      const target = body.targetPath ? cloudPath(body.targetPath) : undefined;
      if (target && body.seedFromPath && Array.isArray(body.seedPaths)) {
        const original = await readAsset(access, body.seedFromPath);
        for (const seed of body.seedPaths.slice(0, 12)) {
          if (!localizedTarget(seed, ext) || seed === body.targetPath) continue;
          const destination = cloudPath(seed);
          let exists = false;
          try { await readAsset(access, destination); exists = true; } catch { /* Seed missing locale. */ }
          if (!exists) await storeAsset(access, await encodeForPath(original, seed), /\.jpe?g$/.test(seed) ? "image/jpeg" : seed.endsWith(".webp") ? "image/webp" : "image/png", destination);
        }
      }
      const bytes = target ? await encodeForPath(parsed.bytes, body.targetPath!) : parsed.bytes;
      const mime = target ? (target.endsWith(".jpg") || target.endsWith(".jpeg") ? "image/jpeg" : target.endsWith(".webp") ? "image/webp" : "image/png") : parsed.mime;
      return NextResponse.json({ ok: true, path: await storeAsset(access, bytes, mime, target) });
    } catch { return NextResponse.json({ ok: false, error: "Image could not be saved. Please retry." }, { status: 503 }); }
  }

  const hash = createHash("sha1").update(parsed.bytes).digest("hex").slice(0, 16);
  const filename = `${hash}.${ext}`;
  const targetPath = localizedTarget(body.targetPath, ext);
  const publicPath = targetPath || `${PUBLIC_PREFIX}/${filename}`;
  const relFile = targetPath
    ? path.join("public", ...targetPath.split("/").filter(Boolean))
    : path.join(UPLOAD_DIR_REL, filename);
  const absFile = path.join(process.cwd(), relFile);
  const absDir = path.dirname(absFile);

  try {
    await fs.mkdir(absDir, { recursive: true });
    if (targetPath && body.seedFromPath && Array.isArray(body.seedPaths)) {
      const seedFrom = publicFilePath(body.seedFromPath);
      if (seedFrom) {
        for (const rawSeedPath of body.seedPaths) {
          const seedPath = localizedTarget(rawSeedPath, ext);
          if (!seedPath || seedPath === targetPath) continue;
          const seedFile = publicFilePath(seedPath);
          if (!seedFile) continue;
          try {
            await fs.access(seedFile);
          } catch {
            try {
              await fs.mkdir(path.dirname(seedFile), { recursive: true });
              await fs.writeFile(seedFile, await encodeForPath(await fs.readFile(seedFrom), seedPath));
            } catch {
              // Seeding is best-effort; the active locale upload should still succeed.
            }
          }
        }
      }
    }
    if (targetPath) {
      await fs.writeFile(absFile, await encodeForPath(parsed.bytes, targetPath));
    } else {
      try {
        await fs.access(absFile);
      } catch {
        await fs.writeFile(absFile, parsed.bytes);
      }
    }
    return NextResponse.json({ ok: true, path: publicPath });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
