import { NextResponse } from "next/server";
import { exportEventSchema } from "@/lib/beta-feedback";
import { report, requestIdOf } from "@/lib/ops";
import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

const MAX_BODY = 4_000;

// Records a finished export. The ZIP is built and downloaded in the browser,
// so this is the only way the operator learns that a member reached the end.
export async function POST(req: Request) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  // Local mode has no accounts to attribute an export to.
  if (!access.client) return new NextResponse(null, { status: 204, headers: privateHeaders });
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: "Event too large." }, { status: 413, headers: privateHeaders });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: privateHeaders });
  }
  const parsed = exportEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid event." }, { status: 400, headers: privateHeaders });
  const { kind, projectId, detail } = parsed.data;
  const { error } = await access.client.from("beta_events").insert({ kind, project_id: projectId, detail });
  if (error) {
    // Telemetry never blocks the user, but a missing table means a skipped migration.
    report("event_record", error, { code: error.code, kind, userId: access.userId, requestId: requestIdOf(req) }, "warning", "day");
    return NextResponse.json({ ok: false, error: "Event not recorded." }, { status: 503, headers: privateHeaders });
  }
  return new NextResponse(null, { status: 204, headers: privateHeaders });
}
