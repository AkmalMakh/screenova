import { getGalleryPost } from "@/lib/gallery-store";
import { GALLERY_PREVIEW_PREFIX } from "@/lib/gallery";

export const dynamic = "force-dynamic";

// Public preview image for a visible post. Outside /api on purpose: the
// middleware requires a session for /api, and the gallery is public.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const index = Number(n);
  if (!Number.isInteger(index) || index < 0) return new Response("Not found", { status: 404 });
  try {
    const post = await getGalleryPost(id);
    const dataUrl = post?.previews[index];
    if (!dataUrl?.startsWith(GALLERY_PREVIEW_PREFIX)) return new Response("Not found", { status: 404 });
    const bytes = Buffer.from(dataUrl.slice(GALLERY_PREVIEW_PREFIX.length), "base64");
    return new Response(bytes, {
      headers: {
        "content-type": "image/jpeg",
        // A post's previews never change; a hidden post stops being served
        // once this short shared-cache window passes.
        "cache-control": "public, max-age=300, s-maxage=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
}
