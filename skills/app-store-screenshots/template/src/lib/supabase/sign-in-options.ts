import { supabaseConfig } from "./config";

export interface SignInOptions {
  google: boolean;
  github: boolean;
  email: boolean;
}

// Server-only discovery: display only providers enabled in this Supabase
// project. Email additionally requires an explicit operator opt-in after SMTP
// verification; the built-in sender is not suitable for public registration.
export async function getSignInOptions(): Promise<SignInOptions> {
  try {
    const { url, key } = supabaseConfig();
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Provider settings unavailable");
    const settings = await response.json();
    return {
      google: settings?.external?.google === true,
      github: settings?.external?.github === true,
      email: process.env.AUTH_EMAIL_ENABLED === "true" && settings?.external?.email === true,
    };
  } catch {
    return { google: false, github: false, email: false };
  }
}
