import { NextResponse } from "next/server";
import { report, requestIdOf } from "@/lib/ops";
import { isAuthOutage, outageLevel } from "./auth-outage";
import { storageMode } from "./config";
import { ACCESS_UNAVAILABLE, ACTION_UNAVAILABLE, LIMIT_REACHED, WORKSPACE_UNAVAILABLE } from "./messages";
import { serverSupabase } from "./server";

export type CloudAccess = { userId: string; client: Awaited<ReturnType<typeof serverSupabase>> };
export type Access = CloudAccess | { userId: null; client: null };
export type Budget = "ai" | "upload" | "import";
export const privateHeaders = { "cache-control": "private, no-store", "vary": "Cookie" };

const VERDICTS = new Set(["ok", "user", "global", "denied"]);

async function checkBudget(access: CloudAccess, budget: Budget, requestId: string | null): Promise<NextResponse | null> {
  const { data, error } = await access.client.rpc("consume_beta_budget_v2", { kind: budget });
  if (error) throw error;
  const verdict = typeof data === "string" && VERDICTS.has(data) ? data : null;
  if (verdict === "ok") return null;
  if (verdict === "global") {
    // A shared pool stays empty until midnight UTC: one alert per pool per day.
    report("budget_global", undefined, { kind: budget, requestId }, "warning", "day");
  } else if (verdict === "denied") {
    // The database refused the account (not a member, or an unknown kind):
    // an access problem, not a quota, so never tell the user to wait a day.
    console.warn("screenova_budget_denied", { kind: budget });
    return NextResponse.json({ ok: false, error: ACTION_UNAVAILABLE }, { status: 403, headers: privateHeaders });
  } else if (verdict === null) {
    // A missing or changed function is our outage: fail closed, page, and say so.
    report("budget_contract", undefined, { kind: budget, requestId }, "error");
    return NextResponse.json({ ok: false, error: WORKSPACE_UNAVAILABLE }, { status: 503, headers: privateHeaders });
  }
  return NextResponse.json({ ok: false, error: LIMIT_REACHED }, { status: 429, headers: privateHeaders });
}

export async function authorizeRequest(req?: Request, budget?: Budget):
  Promise<Access | { response: NextResponse }> {
  if (storageMode() === "local") return { userId: null, client: null };
  const requestId = requestIdOf(req);
  try {
    const client = await serverSupabase();
    const { data: { user }, error } = await client.auth.getUser();
    // An unreachable auth server is an outage (503 + page below), not a sign-out.
    if (isAuthOutage(error)) throw error;
    if (error || !user) {
      // Expected for signed-out visitors: log, do not alert.
      console.warn("screenova_access_denied", { stage: "identity", status: error?.status ?? null, hasUser: !!user });
      return { response: NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401, headers: privateHeaders }) };
    }
    const { data: member, error: membershipError } = await client.from("beta_members").select("user_id").eq("user_id", user.id).maybeSingle();
    if (membershipError) throw membershipError;
    if (!member) return { response: NextResponse.json({ ok: false, error: ACCESS_UNAVAILABLE }, { status: 403, headers: privateHeaders }) };
    if (req && (req.method !== "GET" || req.headers.has("x-screenova-owner")) && req.headers.get("x-screenova-owner") !== user.id) {
      return { response: NextResponse.json({ ok: false, error: "Account changed. Reload before saving; your edits remain in this browser." }, { status: 409, headers: privateHeaders }) };
    }
    if (req && !["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.get("origin");
      if (origin && origin !== new URL(req.url).origin) return { response: NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 }) };
    }
    const access: CloudAccess = { userId: user.id, client };
    if (budget) {
      const denied = await checkBudget(access, budget, requestId);
      if (denied) return { response: denied };
    }
    return access;
  } catch (error) {
    // Auth, membership or quota service failure: fail closed and page someone.
    const code = (error as { code?: unknown } | null)?.code;
    report("access_unavailable", error, { kind: budget, code, requestId }, outageLevel(error));
    return { response: NextResponse.json({ ok: false, error: WORKSPACE_UNAVAILABLE }, { status: 503, headers: privateHeaders }) };
  }
}
