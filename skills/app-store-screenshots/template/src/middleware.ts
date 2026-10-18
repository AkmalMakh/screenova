import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { report, requestIdOf } from "@/lib/ops";
import { isAuthOutage, outageLevel } from "@/lib/supabase/auth-outage";
import { WORKSPACE_UNAVAILABLE } from "@/lib/supabase/messages";
import { storageMode, supabaseConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  if (storageMode() === "local") return NextResponse.next();
  // Never publish the original user's assets, even if Next serves public/ directly.
  if (request.nextUrl.pathname.startsWith("/screenshots/")) return new NextResponse("Not found", { status: 404 });
  let response = NextResponse.next({ request });
  try {
    const { url, key } = supabaseConfig();
    const supabase = createServerClient(url, key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    } });
    const { data: { user }, error } = await supabase.auth.getUser();
    // An unreachable auth server is an outage (503 / outage notice below), not a sign-out.
    if (isAuthOutage(error)) throw error;
    if (error || !user) {
      const denied = request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      response = denied;
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    // Missing hosted config or an auth outage blocks every protected route.
    report("middleware", error, { requestId: requestIdOf(request) }, outageLevel(error));
    // API callers parse JSON before checking the status, so keep the API contract.
    // Pages go to the login screen's outage notice (one designed surface, no
    // inline HTML here). /login is outside the matcher, so this cannot loop.
    const unavailable = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ ok: false, error: WORKSPACE_UNAVAILABLE }, { status: 503 })
      : NextResponse.redirect(new URL("/login?reason=unavailable", request.url));
    // getUser() may have rotated the refresh token before the outage hit.
    // Dropping the new cookies would leave the browser with a used token and
    // sign the user out once Supabase sees it reused.
    response.cookies.getAll().forEach(cookie => unavailable.cookies.set(cookie));
    unavailable.headers.set("Cache-Control", "no-store");
    return unavailable;
  }
}

export const config = { matcher: ["/studio/:path*", "/editor/:path*", "/api/:path*", "/screenshots/:path*"] };
