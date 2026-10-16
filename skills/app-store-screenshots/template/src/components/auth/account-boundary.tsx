"use client";
import { useEffect, useState } from "react";
import { setAccountScope } from "@/lib/account-scope";
import { browserSupabase } from "@/lib/supabase/browser";

export function AccountBoundary({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setAccountScope(userId); setReady(true); }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const { data: { subscription } } = browserSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) window.location.assign("/login");
    });
    return () => subscription.unsubscribe();
  }, [userId]);
  return ready ? children : <div className="p-8 text-sm text-muted-foreground">Opening your workspace…</div>;
}
