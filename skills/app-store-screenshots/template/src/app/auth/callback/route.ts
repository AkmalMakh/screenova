import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  try {
    if (code) {
      const client = await serverSupabase();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/studio", url.origin));
    }
  } catch { /* Never disclose credentials/provider errors in URLs. */ }
  return NextResponse.redirect(new URL("/login?reason=expired", url.origin));
}
