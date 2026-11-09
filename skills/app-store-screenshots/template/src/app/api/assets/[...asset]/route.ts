import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";
import { ASSET_BUCKET, assetKey } from "@/lib/supabase/assets";

export const dynamic = "force-dynamic";

// ?w= asks for a small preview (the "Your uploads" grid) instead of the
// full-size file, so a page of thumbnails doesn't download every original.
const MIN_PREVIEW = 64;
const MAX_PREVIEW = 640;
// Uploads are named by their content hash, so a preview of one never goes stale.
const CONTENT_ADDRESSED = /^[a-f0-9]{64}\.(png|jpe?g|webp)$/;

export async function GET(req: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  if (!access.client) return new Response("Not found", { status: 404 });
  const { asset } = await params;
  try {
    const key = assetKey(`/api/assets/${asset.join("/")}`, access.userId);
    if (asset[1] === "_uploads") throw new Error("Unvalidated upload");
    const { data, error } = await access.client.storage.from(ASSET_BUCKET).download(key);
    if (error || !data) throw new Error("Image unavailable");
    const width = Number(new URL(req.url).searchParams.get("w"));
    if (Number.isInteger(width) && width >= MIN_PREVIEW && width <= MAX_PREVIEW) {
      const { default: sharp } = await import("sharp");
      const preview = await sharp(Buffer.from(await data.arrayBuffer()), { failOn: "none", limitInputPixels: 64_000_000 })
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      const cache = CONTENT_ADDRESSED.test(asset.at(-1) ?? "") ? "private, max-age=86400" : privateHeaders["cache-control"];
      return new Response(new Uint8Array(preview), {
        headers: { ...privateHeaders, "cache-control": cache, "content-type": "image/webp", "x-content-type-options": "nosniff" },
      });
    }
    const ext = asset.at(-1)?.split(".").at(-1);
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
    // Stream the private response instead of exceeding Vercel's buffered body limit.
    return new Response(data.stream(), { headers: { ...privateHeaders, "content-type": mime, "x-content-type-options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404, headers: privateHeaders }); }
}
