/**
 * Where to send an OAuth return that landed on the wrong page.
 *
 * Supabase only honours the app's `redirectTo` when it matches the Site URL or
 * the redirect allow-list exactly; otherwise it silently falls back to the Site
 * URL and appends the PKCE `code` (or the provider `error`). The landing page
 * never exchanges that code, so the sign-in would be lost. Forwarding the
 * same parameters to the real callback route turns a configuration slip into a
 * working login, or into the callback's own recoverable login error.
 *
 * Only `code` and `error` travel; nothing else from the query is reflected.
 */
export function strayAuthReturn(params: URLSearchParams): string | null {
  const code = params.get("code");
  const error = params.get("error");
  if (!code && !error) return null;
  const forward = new URLSearchParams();
  if (error) forward.set("error", error);
  if (code) forward.set("code", code);
  return `/auth/callback?${forward.toString()}`;
}
