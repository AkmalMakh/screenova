import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";
import { readAsset } from "@/lib/supabase/assets";

export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  if (!access.client) return new Response("Not found", { status: 404 });
  const { asset } = await params;
  try {
    const bytes = await readAsset(access, `/api/assets/${asset.join("/")}`);
    const ext = asset.at(-1)?.split(".").at(-1);
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
    return new Response(new Uint8Array(bytes), { headers: { ...privateHeaders, "content-type": mime, "x-content-type-options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404, headers: privateHeaders }); }
}
