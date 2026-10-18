import OpenAI, { APIUserAbortError } from "openai";
import { NextResponse } from "next/server";
import { report, requestIdOf } from "./ops";

// One mapping from OpenAI failures to user copy for every AI route.
//
//   status / code                   user sees (status)                          operator
//   429 + insufficient_quota        AI_PAUSED (503)                             warning "ai_quota"
//   429                             rate-limited, try shortly (429)             console only (transient)
//   401                             key rejected (401)                          error
//   >= 500                          route-specific "could not ..." (vendor)     error
//   403 / 404 (model)               route-specific "could not ..." (vendor)     error
//   other 4xx (user's own input)    short copy per known code, else generic     console only
//
// Vendor error text never reaches the user: it can name models, accounts or
// internal limits. It goes to the server console only.
//   user abort (Cancel)             route's "cancelled" (499)                  none
//
// The monthly hard limit is set on purpose; after it, "try again shortly" would
// be false for weeks, so quota exhaustion gets its own honest message.
// The monthly limit can last weeks, so it alerts once per UTC day per instance
// (report's "day" window); every hit still logs.

const REJECTED_COPY: Record<string, string> = {
  invalid_image: "One of the images couldn't be read. Try a PNG or JPEG screenshot.",
  invalid_image_format: "One of the images couldn't be read. Try a PNG or JPEG screenshot.",
  image_too_large: "One of the images is too large. Try a smaller screenshot.",
  content_policy_violation: "OpenAI declined this request. Try different screenshots or wording.",
  context_length_exceeded: "This request is too long. Try fewer screenshots or shorter text.",
  string_above_max_length: "This request is too long. Try fewer screenshots or shorter text.",
};
export const AI_REJECTED = "OpenAI couldn't process this request. Try different screenshots or wording.";

export const AI_PAUSED = "AI features are paused for now; manual editing and export still work.";

export function openAIErrorResponse(error: unknown, unavailableMessage: string, req?: Request): NextResponse | null {
  if (!(error instanceof OpenAI.APIError)) return null;
  // A user pressing Cancel surfaces as a status-less APIError subclass. Leave it
  // to the route's own "cancelled" (499) branch: it is not a provider failure.
  if (error instanceof APIUserAbortError) return null;
  const requestId = requestIdOf(req);
  const status = error.status || 502;
  if (error.code === "insufficient_quota") {
    report("ai_quota", undefined, { code: error.code, requestId }, "warning", "day");
    return NextResponse.json({ ok: false, error: AI_PAUSED }, { status: 503 });
  }
  if (status === 429) {
    console.warn("screenova_ai_rate_limited", { requestId });
    return NextResponse.json({ ok: false, error: "OpenAI is rate-limited right now. Try again shortly." }, { status });
  }
  // Page only for failures on OpenAI's or our side (key, permission, missing
  // or retired model, 5xx, no
  // status). A 4xx caused by the user's own input (bad image, content policy,
  // too long) is not an outage: log it, don't email anyone.
  if (status === 401 || status === 403 || status === 404 || status >= 500) {
    report("ai_provider", error, { code: error.code ?? String(status), requestId });
  } else {
    console.warn("screenova_ai_rejected", { status, code: error.code ?? null, message: error.message, requestId });
  }
  const message =
    status === 401
      ? "The OpenAI API key was rejected."
      : status === 403 || status === 404 || status >= 500
        ? unavailableMessage
        : (error.code && REJECTED_COPY[error.code]) || AI_REJECTED;
  return NextResponse.json({ ok: false, error: message }, { status });
}
