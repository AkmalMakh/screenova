import { NextResponse } from "next/server";
import { getGalleryTemplate, hideGalleryPost, unpublishGalleryPost } from "@/lib/gallery-store";
import { report, requestIdOf } from "@/lib/ops";
import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ ok: false, error: "This design is no longer in the gallery." }, { status: 404, headers: privateHeaders });
const failed = () => NextResponse.json({ ok: false, error: "The gallery is unavailable right now. Try again shortly." }, { status: 503, headers: privateHeaders });

// The editable template, for signed-in users. Also says whether the caller
// owns the post or moderates the gallery, so the page can offer the controls.
export async function GET(req: Request, { params }: Context) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  const { id } = await params;
  try {
    const result = await getGalleryTemplate(access.client ? access : null, id);
    // viewerId is the caller's own account id: public gallery pages have no
    // workspace boundary, so the page echoes it back on unpublish/hide.
    return result ? NextResponse.json({ ok: true, ...result, viewerId: access.userId }, { headers: privateHeaders }) : notFound();
  } catch (error) {
    report("gallery_read", error, { code: (error as { code?: unknown }).code, requestId: requestIdOf(req) });
    return failed();
  }
}

// Unpublish your own post. RLS limits the delete to the caller's rows.
export async function DELETE(req: Request, { params }: Context) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  const { id } = await params;
  try {
    return (await unpublishGalleryPost(access.client ? access : null, id))
      ? NextResponse.json({ ok: true }, { headers: privateHeaders })
      : notFound();
  } catch (error) {
    report("gallery_unpublish", error, { code: (error as { code?: unknown }).code, requestId: requestIdOf(req) });
    return failed();
  }
}

// Moderator hide ({ "hidden": true }). Unhiding is an operator SQL action.
export async function PATCH(req: Request, { params }: Context) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { hidden?: unknown } | null;
  if (body?.hidden !== true) {
    return NextResponse.json({ ok: false, error: "Only hiding is supported." }, { status: 400, headers: privateHeaders });
  }
  try {
    const hidden = await hideGalleryPost(access.client ? access : null, id);
    if (hidden === null) return NextResponse.json({ ok: false, error: "Only gallery moderators can hide posts." }, { status: 403, headers: privateHeaders });
    return hidden ? NextResponse.json({ ok: true }, { headers: privateHeaders }) : notFound();
  } catch (error) {
    report("gallery_hide", error, { code: (error as { code?: unknown }).code, requestId: requestIdOf(req) });
    return failed();
  }
}
