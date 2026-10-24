import { NextResponse } from "next/server";
import { CREDITS_PER_DESIGN } from "@/lib/credits";
import { report, requestIdOf } from "@/lib/ops";
import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

/** The signed-in member's remaining beta design credits. Read-only. */
export async function GET(req: Request) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  if (!access.client) {
    // Local mode has no accounts and no budget.
    return NextResponse.json({ ok: true, credits: null, perCall: CREDITS_PER_DESIGN }, { headers: privateHeaders });
  }
  const { data, error } = await access.client.from("beta_members").select("credits").eq("user_id", access.userId).maybeSingle();
  if (error || !data) {
    report("credits_read", error ?? undefined, { userId: access.userId, requestId: requestIdOf(req) });
    return NextResponse.json({ ok: false, error: "Credits could not be loaded." }, { status: 503, headers: privateHeaders });
  }
  return NextResponse.json({ ok: true, credits: data.credits, perCall: CREDITS_PER_DESIGN }, { headers: privateHeaders });
}
