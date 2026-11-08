import { NextResponse } from "next/server";
import { FEEDBACK_MAX, feedbackSchema } from "@/lib/beta-feedback";
import { report, requestIdOf } from "@/lib/ops";
import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

const MAX_BODY = FEEDBACK_MAX * 4 + 1_000;

// A member's feedback from the editor. Insert-only; the operator reads it in
// the SQL Editor (RUNBOOK.md, "Beta cohort review").
export async function POST(req: Request) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  if (!access.client) {
    // Local mode has no accounts and nobody to read it.
    return NextResponse.json({ ok: false, error: "Feedback is collected in the hosted beta only." }, { status: 404, headers: privateHeaders });
  }
  const text = await req.text();
  if (text.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "This message is too long. Shorten it and try again." }, { status: 413, headers: privateHeaders });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: privateHeaders });
  }
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Choose an answer or write a message." }, { status: 400, headers: privateHeaders });
  }
  const { projectId, wouldUse, message, context } = parsed.data;
  const { error } = await access.client
    .from("beta_feedback")
    .insert({ project_id: projectId, would_use: wouldUse, message: message.trim(), context });
  if (error) {
    report("feedback_send", error, { code: error.code, userId: access.userId, requestId: requestIdOf(req) });
    return NextResponse.json({ ok: false, error: "Your feedback couldn't be sent. Try again." }, { status: 503, headers: privateHeaders });
  }
  return NextResponse.json({ ok: true }, { status: 201, headers: privateHeaders });
}
