import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const providerError = url.searchParams.get("error");
  if (providerError) return redirect(providerError === "access_denied" ? "/login?reason=cancelled" : "/login?reason=oauth");
  try {
    if (code) {
      const client = await serverSupabase();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return redirect("/studio");
    }
  } catch { /* Never disclose credentials/provider errors in URLs. */ }
  return redirect("/login?reason=expired");
}
