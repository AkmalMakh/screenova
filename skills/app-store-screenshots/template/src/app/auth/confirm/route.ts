import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  try {
    if (token_hash && (type === "email" || type === "invite" || type === "magiclink")) {
      const client = await serverSupabase();
      const { error } = await client.auth.verifyOtp({ token_hash, type });
      if (!error) return NextResponse.redirect(new URL("/studio", url.origin));
    }
  } catch { /* Show a recoverable sign-in page, not a server error. */ }
  return NextResponse.redirect(new URL("/login?reason=expired", url.origin));
}
