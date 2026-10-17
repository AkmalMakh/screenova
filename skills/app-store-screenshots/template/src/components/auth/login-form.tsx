"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/browser";
import { emailAccessRequest } from "@/lib/supabase/email-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github } from "lucide-react";
import { githubAccessRequest, signInError } from "@/lib/supabase/github-access";
import { googleAccessRequest } from "@/lib/supabase/google-access";
import type { SignInOptions } from "@/lib/supabase/sign-in-options";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export function LoginForm({ providers }: { providers: SignInOptions }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "github" | "email" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setError(signInError(new URLSearchParams(window.location.search).get("reason")));
    const resetPending = () => setPending(null);
    window.addEventListener("pageshow", resetPending);
    return () => window.removeEventListener("pageshow", resetPending);
  }, []);
  async function signIn(provider: "google" | "github") {
    if (pending !== null || !providers[provider]) return;
    setPending(provider); setError(""); setMessage("");
    try {
      const request = provider === "google" ? googleAccessRequest : githubAccessRequest;
      const { data, error } = await browserSupabase().auth.signInWithOAuth(request(window.location.origin));
      if (error || !data.url) throw new Error("Sign-in unavailable");
    } catch {
      setError(`We couldn’t open ${provider === "google" ? "Google" : "GitHub"} sign-in. Please try again shortly.`);
      setPending(null);
    }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-background p-6">
    <section className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-card">
      <Link href="/" className="text-sm font-semibold text-primary">Screenova</Link>
      <div className="space-y-2"><h1 className="text-[28px] font-semibold tracking-tight">Your private workspace</h1><p className="text-[15px] text-muted-foreground">Sign in or create an account to save your designs. Your projects and screenshots stay private to you.</p></div>
      {providers.google && <div className="space-y-3">
        <Button type="button" variant="outline" className="h-11 w-full gap-2" disabled={pending !== null} onClick={() => signIn("google")}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.97-3.39.97-2.61 0-4.83-1.77-5.62-4.15H3.04v2.59A10 10 0 0 0 12 22ZM6.38 13.9a6 6 0 0 1 0-3.8V7.51H3.04a10 10 0 0 0 0 8.98l3.34-2.59ZM12 5.95c1.47 0 2.78.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.34 2.59C7.17 7.72 9.39 5.95 12 5.95Z" /></svg>
          {pending === "google" ? "Opening Google…" : "Continue with Google"}
        </Button>
        <p className="text-[13px] text-muted-foreground">Uses your Google profile and email. No Gmail or Drive access requested.</p>
      </div>}
      {providers.github && <div className="space-y-3">
        <Button type="button" className="h-11 w-full gap-2" disabled={pending !== null} onClick={() => signIn("github")}><Github className="h-4 w-4" aria-hidden="true" />{pending === "github" ? "Opening GitHub…" : "Continue with GitHub"}</Button>
        <p className="text-[13px] text-muted-foreground">Uses your GitHub identity and email. No repository access requested.</p>
      </div>}
      {!providers.google && !providers.github && !providers.email && <p role="alert" className="text-sm text-destructive">Sign-in is temporarily unavailable. Please try again later.</p>}
      {providers.email && <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setPending("email"); setError(""); setMessage("");
        try {
          const { error } = await browserSupabase().auth.signInWithOtp(emailAccessRequest(email, window.location.origin));
          if (error) throw error;
          setMessage("Check your email for a confirmation or sign-in link. Open it to continue to your workspace.");
        } catch { setError("We could not send an email. Check your address and try again shortly. If this continues, contact support."); }
        finally { setPending(null); }
      }}>
        <label htmlFor="login-email" className="block text-[13px] font-medium">Email address</label>
        <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={pending !== null} />
        <Button type="submit" className="h-11 w-full" disabled={pending !== null}>{pending === "email" ? "Sending…" : "Continue with email"}</Button>
      </form>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-[13px] text-muted-foreground">No invitation needed. Daily beta usage limits apply.</p>
      <p className="text-[13px] text-muted-foreground">Need help? Contact <a href={SUPPORT_MAILTO} className="text-primary underline">{SUPPORT_EMAIL}</a>.</p>
    </section>
  </main>;
}
