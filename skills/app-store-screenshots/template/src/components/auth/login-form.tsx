"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/browser";
import { emailAccessRequest } from "@/lib/supabase/email-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "invite" || reason === "access") setError("Workspace access is unavailable for this account. Confirm your email or contact support.");
    if (reason === "expired") setError("That sign-in link has expired or was already used. Request a new one below.");
    if (reason === "session") setError("Your session ended or the workspace is unavailable. Please sign in again.");
  }, []);
  return <main className="flex min-h-dvh items-center justify-center bg-background p-6">
    <section className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-card">
      <Link href="/" className="text-sm font-semibold text-primary">Screenova</Link>
      <div className="space-y-2"><h1 className="text-[28px] font-semibold tracking-tight">Your private workspace</h1><p className="text-[15px] text-muted-foreground">Sign in or create an account with your email. Your projects and screenshots stay private to you.</p></div>
      {!configured ? <p role="alert" className="text-sm text-destructive">Cloud sign-in is not configured yet. Please contact the beta organizer.</p> : <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setPending(true); setError(""); setMessage("");
        try {
          const { error } = await browserSupabase().auth.signInWithOtp(emailAccessRequest(email, window.location.origin));
          if (error) throw error;
          setMessage("Check your email for a confirmation or sign-in link. Open it to continue to your workspace.");
        } catch { setError("We could not send an email. Check your address and try again shortly. If this continues, contact support."); }
        finally { setPending(false); }
      }}>
        <label htmlFor="login-email" className="block text-[13px] font-medium">Email address</label>
        <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={pending} />
        <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Sending…" : "Continue with email"}</Button>
      </form>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">No invitation or password needed. Verify your email to get started. Daily beta usage limits apply.</p>
    </section>
  </main>;
}
