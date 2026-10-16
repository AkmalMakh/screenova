"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { accountScope } from "@/lib/account-scope";
import { browserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
export function AccountButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!accountScope()) return null;
  return <div><Button type="button" variant="ghost" size="icon" aria-label="Sign out" title="Sign out" disabled={pending} onClick={async () => {
    if (!window.confirm("Sign out? Make sure your latest edits show as saved first.")) return;
    setPending(true);
    const { error } = await browserSupabase().auth.signOut({ scope: "local" });
    if (error) { setError("Could not sign out. Try again."); setPending(false); return; }
    window.location.assign("/login");
  }}><LogOut className="h-4 w-4" /></Button>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>;
}
