import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";
import { ASSET_BUCKET, assetKey } from "@/lib/supabase/assets";

export const dynamic = "force-dynamic";
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
    const ext = asset.at(-1)?.split(".").at(-1);
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
    // Stream the private response instead of exceeding Vercel's buffered body limit.
    return new Response(data.stream(), { headers: { ...privateHeaders, "content-type": mime, "x-content-type-options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404, headers: privateHeaders }); }
}
