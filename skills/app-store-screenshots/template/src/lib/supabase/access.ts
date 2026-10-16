import { NextResponse } from "next/server";
import { storageMode } from "./config";
import { serverSupabase } from "./server";

export type CloudAccess = { userId: string; client: Awaited<ReturnType<typeof serverSupabase>> };
export type Access = CloudAccess | { userId: null; client: null };
export const privateHeaders = { "cache-control": "private, no-store", "vary": "Cookie" };

export async function authorizeRequest(req?: Request, budget?: "ai" | "upload" | "import"):
  Promise<Access | { response: NextResponse }> {
  if (storageMode() === "local") return { userId: null, client: null };
  try {
    const client = await serverSupabase();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) {
      // Safe operational signals only: never log sessions, emails or provider bodies.
      console.warn("screenova_access_denied", { stage: "identity", status: error?.status ?? null, hasUser: !!user });
      return { response: NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401, headers: privateHeaders }) };
    }
    const { data: member, error: membershipError } = await client.from("beta_members").select("user_id").eq("user_id", user.id).maybeSingle();
    if (membershipError) {
      console.error("screenova_access_unavailable", { stage: "membership", code: /^[A-Z0-9]{5,12}$/.test(membershipError.code || "") ? membershipError.code : "unknown" });
      throw membershipError;
    }
    if (!member) return { response: NextResponse.json({ ok: false, error: "Workspace access is unavailable. Confirm your email or contact support." }, { status: 403, headers: privateHeaders }) };
    if (req && (req.method !== "GET" || req.headers.has("x-screenova-owner")) && req.headers.get("x-screenova-owner") !== user.id) {
      return { response: NextResponse.json({ ok: false, error: "Account changed. Reload before saving; your edits remain in this browser." }, { status: 409, headers: privateHeaders }) };
    }
    if (req && !["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.get("origin");
      if (origin && origin !== new URL(req.url).origin) return { response: NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 }) };
    }
    if (budget) {
      const { data: allowed, error: quotaError } = await client.rpc("consume_beta_budget", { kind: budget });
      if (quotaError) throw quotaError;
      if (!allowed) return { response: NextResponse.json({ ok: false, error: "Daily beta limit reached. Please try again tomorrow." }, { status: 429, headers: privateHeaders }) };
    }
    return { userId: user.id, client };
  } catch {
    return { response: NextResponse.json({ ok: false, error: "Cloud workspace is unavailable. No local data was accessed." }, { status: 503, headers: privateHeaders }) };
  }
}
