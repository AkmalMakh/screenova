"use client";
import * as React from "react";
import { Sparkles } from "lucide-react";
import { accountScope, apiFetch } from "@/lib/account-scope";
import { CREDITS_CHANGED_EVENT, type CreditsSnapshot } from "@/lib/credits";
import { useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";

/** Remaining beta design credits for the signed-in member; re-reads after every AI request. */
export function useCredits(): CreditsSnapshot | null {
  const [snapshot, setSnapshot] = React.useState<CreditsSnapshot | null>(null);
  React.useEffect(() => {
    if (!accountScope()) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch("/api/credits");
        const json = (await response.json()) as { ok?: boolean; credits?: number | null; perCall?: number };
        if (!cancelled && response.ok && json.ok && typeof json.credits === "number" && typeof json.perCall === "number") {
          setSnapshot({ credits: json.credits, perCall: json.perCall });
        }
      } catch {
        // Keep whatever was shown; the next AI request refreshes it.
      }
    };
    void load();
    window.addEventListener(CREDITS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CREDITS_CHANGED_EVENT, load);
    };
  }, []);
  return snapshot;
}

/** Fire after an AI request settles so every badge on the page re-reads the balance. */
export function announceCreditsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}

export function CreditsBadge({ className }: { className?: string }) {
  const { t } = useT();
  const snapshot = useCredits();
  if (!snapshot) return null;
  const empty = snapshot.credits < snapshot.perCall;
  const title = `${t("credits.left", { count: snapshot.credits })} · ${t("credits.perDesign", { cost: snapshot.perCall })}`;
  return (
    <span
      role="status"
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-caption font-medium tabular-nums",
        empty ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {t("credits.left", { count: snapshot.credits })}
    </span>
  );
}
