import { promises as fs } from "node:fs";
import path from "node:path";

// Production's public-file index does not include uploads made after startup.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;
  if (!asset.length || asset.some((part) => !/^[a-zA-Z0-9._-]+$/.test(part) || part === "." || part === "..")) {
    return new Response("Not found", { status: 404 });
  }
  const extension = path.extname(asset[asset.length - 1]).toLowerCase();
  const mime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
  if (!mime[extension]) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "screenshots", ...asset));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": mime[extension],
        "cache-control": ["uploaded", "generated-ai"].includes(asset[0]) ? "public, max-age=31536000, immutable" : "no-cache",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
