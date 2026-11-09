"use client";
import * as React from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DraftJob } from "@/lib/draft-runner";
import { CREDIT_COST } from "@/lib/credits";
import { useT } from "@/lib/ui-i18n";

/** What a first draft is doing right now, floating over the deck it is filling in. */
export function DraftProgress({ job, top, onRetry, onDismiss }: {
  job: DraftJob;
  top: number;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { t } = useT();
  // A ticking clock shows the draft is alive through Claude's quiet planning stretch.
  const [started] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(started);
  React.useEffect(() => {
    if (job.status === "error") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [job.status]);
  const seconds = Math.max(0, Math.round((now - started) / 1000));
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const attachments = job.request.attachments.length;
  const uploaded = job.paths.filter(Boolean).length;
  const designed = job.slides.filter(Boolean).length;
  const failed = job.status === "error";
  // Uploads are a quick first stretch; the screens are most of the wait.
  const progress = job.status === "uploading"
    ? attachments ? (uploaded / attachments) * 0.15 : 0
    : 0.15 + (designed / Math.max(1, job.total)) * 0.85;
  const title = failed
    ? t("draft.failed")
    : job.status === "uploading"
      ? t("draft.uploading", { done: uploaded, total: attachments })
      : designed === 0
        ? t("draft.planning")
        : t("draft.designing", { current: Math.min(designed + 1, job.total), total: job.total });

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute left-1/2 z-30 w-[min(420px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-[12px] border border-border bg-card/95 shadow-pop backdrop-blur"
      style={{ top }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {failed ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        ) : (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-3 text-footnote font-semibold">
            <span>{title}</span>
            {/* Hidden from the live region, or it would be read out every second. */}
            {!failed && <span aria-hidden className="shrink-0 tabular-nums text-caption font-normal text-muted-foreground">{elapsed}</span>}
          </p>
          <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
            {failed ? job.error : t("draft.hint")}
          </p>
          {failed && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" className="h-9 gap-1.5 rounded-sm px-3" onClick={onRetry}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t("draft.retry")}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-9 rounded-sm px-3" onClick={onDismiss}>
                {t("draft.dismiss")}
              </Button>
              <span className="text-caption text-muted-foreground">{t("credits.draftCost", { cost: CREDIT_COST.draft })}</span>
            </div>
          )}
        </div>
      </div>
      {!failed && (
        <div className="h-1 bg-muted" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-medium ease-out motion-reduce:transition-none"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
