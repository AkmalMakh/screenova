import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = Buffer.from(m[2], "base64");
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

export async function POST(req: Request) {
  let body: { dataUrl?: string; targetPath?: string; seedFromPath?: string; seedPaths?: string[] };
  try {
    body = (await req.json()) as { dataUrl?: string; targetPath?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.dataUrl || typeof body.dataUrl !== "string") {
    return NextResponse.json({ ok: false, error: "Missing dataUrl" }, { status: 400 });
  }
  const parsed = parseDataUrl(body.dataUrl);
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
              await fs.copyFile(seedFrom, seedFile);
            } catch {
              // Seeding is best-effort; the active locale upload should still succeed.
            }
          }
        }
      }
    }
    if (targetPath) {
      await fs.writeFile(absFile, parsed.bytes);
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
