import { NextResponse } from "next/server";
import { galleryPublishSchema } from "@/lib/gallery";
import { listGalleryPosts, publishGalleryPost } from "@/lib/gallery-store";
import { report, requestIdOf } from "@/lib/ops";
import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

const MAX_BODY = 3_800_000; // under Vercel's 4.5 MB request limit

// Newest public posts, for the Studio's gallery row. Public card data only.
export async function GET(req: Request) {
  try {
    const posts = await listGalleryPosts();
    return NextResponse.json({ ok: true, posts }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    report("gallery_list", error, { requestId: requestIdOf(req) });
    return NextResponse.json({ ok: false, error: "The gallery is unavailable right now." }, { status: 503, headers: privateHeaders });
  }
}

// Publish the caller's deck design to the public gallery. Counts against the
// daily upload budget (previews are images), so one account can't flood it.
export async function POST(req: Request) {
  const access = await authorizeRequest(req, "upload");
  if ("response" in access) return access.response;
  const text = await req.text();
  if (text.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "This design is too large to publish. Publish fewer screens." }, { status: 413, headers: privateHeaders });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: privateHeaders });
  }
  const parsed = galleryPublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "This design couldn't be published. Check the title and try again." }, { status: 400, headers: privateHeaders });
  }
  try {
    const id = await publishGalleryPost(access.client ? access : null, parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201, headers: privateHeaders });
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    report("gallery_publish", error, { code, userId: access.userId ?? undefined, requestId: requestIdOf(req) });
    return NextResponse.json({ ok: false, error: "Publishing failed. Your project is unchanged; try again." }, { status: 503, headers: privateHeaders });
  }
}
