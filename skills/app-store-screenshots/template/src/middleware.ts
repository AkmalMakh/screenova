import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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
    if (error || !user) {
      const denied = request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      response = denied;
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new NextResponse("Cloud workspace is not configured or unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const config = { matcher: ["/studio/:path*", "/editor/:path*", "/api/:path*", "/screenshots/:path*"] };
