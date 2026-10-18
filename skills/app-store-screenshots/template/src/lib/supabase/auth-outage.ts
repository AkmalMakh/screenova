import { isAuthRetryableFetchError } from "@supabase/supabase-js";

// supabase-js reports an unreachable or failing auth server as "no user" plus an
// error, not as a thrown exception. Treating that as "signed out" would bounce
// everyone to /login during an outage and page nobody. Network failures
// (AuthRetryableFetchError, status 0), 5xx answers and rate limiting (429, which
// auth-js would otherwise turn into a cleared session) are outages; anything
// else (missing session, expired or invalid token) is an ordinary sign-out.
export function isAuthOutage(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  // A non-JSON answer (a WAF or CDN error page, a wrong URL) is not a sign-out.
  if ((error as { name?: unknown }).name === "AuthUnknownError") return true;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && (status >= 500 || status === 429);
}

/** Rate limiting is a capacity warning; network failures and 5xx are errors. */
export function outageLevel(error: unknown): "warning" | "error" {
  return (error as { status?: unknown } | null)?.status === 429 ? "warning" : "error";
}
