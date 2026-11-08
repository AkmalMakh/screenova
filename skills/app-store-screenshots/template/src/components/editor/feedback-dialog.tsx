"use client";

import * as React from "react";
import { Check, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SegmentThumb, useSegmentThumb } from "@/components/ui/segment-thumb";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_MAX, WOULD_USE, type FeedbackContext, type WouldUse } from "@/lib/beta-feedback";
import { useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";

type Phase = "form" | "sending" | "done";

export function FeedbackDialog({
  context,
  onOpenChange,
  onSend,
}: {
  /** Where the dialog was opened from; null keeps it closed. */
  context: FeedbackContext | null;
  onOpenChange: (open: boolean) => void;
  /** Resolves once stored, or throws an Error with user-facing copy. */
  onSend: (wouldUse: WouldUse | null, message: string, context: FeedbackContext) => Promise<void>;
}) {
  const { t } = useT();
  const open = context !== null;
  const [wouldUse, setWouldUse] = React.useState<WouldUse | null>(null);
  const [message, setMessage] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("form");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setWouldUse(null);
    setMessage("");
    setPhase("form");
    setError(null);
  }, [open]);

  const sending = phase === "sending";
  const ready = wouldUse !== null || message.trim().length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!context || !ready || sending) return;
    setError(null);
    setPhase("sending");
    try {
      await onSend(wouldUse, message.trim(), context);
      setPhase("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("feedback.failed"));
      setPhase("form");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        {phase === "done" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                {t("feedback.doneTitle")}
              </DialogTitle>
              <DialogDescription>{t("feedback.doneDescription")}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button type="button" className="h-10 rounded-sm px-5" onClick={() => onOpenChange(false)}>
                {t("feedback.close")}
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{t("feedback.title")}</DialogTitle>
              <DialogDescription>
                {context === "export" ? t("feedback.descriptionExport") : t("feedback.descriptionMenu")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <p id="feedback-would-use" className="text-footnote font-medium">{t("feedback.wouldUseLabel")}</p>
              <WouldUseChoice value={wouldUse} onChange={setWouldUse} disabled={sending} labelledBy="feedback-would-use" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-message" className="block text-footnote font-medium">
                {t("feedback.messageLabel")} <span className="font-normal text-muted-foreground">{t("feedback.optional")}</span>
              </Label>
              <Textarea
                id="feedback-message"
                value={message}
                maxLength={FEEDBACK_MAX}
                rows={4}
                onChange={(event) => setMessage(event.target.value)}
                className="resize-none rounded-sm text-base"
                disabled={sending}
              />
            </div>
            <p className="flex gap-2 rounded-lg border border-border bg-muted/50 p-4 text-footnote">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("feedback.privacy")}
            </p>
            {error && <p role="alert" className="text-footnote text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" className="h-10 rounded-sm" onClick={() => onOpenChange(false)} disabled={sending}>
                {t("feedback.cancel")}
              </Button>
              <Button type="submit" className="h-10 gap-2 rounded-sm px-5" disabled={sending || !ready}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {sending ? t("feedback.sending") : t("feedback.submit")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Its own component so the thumb is measured when the dialog content mounts,
// not when the closed dialog does.
function WouldUseChoice({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: WouldUse | null;
  onChange: (value: WouldUse | null) => void;
  disabled: boolean;
  labelledBy: string;
}) {
  const { t } = useT();
  const [ref, thumb] = useSegmentThumb<HTMLDivElement>();
  const label: Record<WouldUse, string> = { yes: t("feedback.yes"), maybe: t("feedback.maybe"), no: t("feedback.no") };
  return (
    <div ref={ref} role="group" aria-labelledby={labelledBy} className="relative inline-flex h-11 items-center gap-0.5 rounded-sm bg-muted/70 p-0.5">
      <SegmentThumb rect={thumb} />
      {WOULD_USE.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={value === choice}
          onClick={() => onChange(value === choice ? null : choice)}
          disabled={disabled}
          className={cn(
            "relative z-10 h-10 min-w-[4.5rem] rounded-xs px-4 text-footnote font-medium transition-colors duration-micro disabled:opacity-50",
            value === choice ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label[choice]}
        </button>
      ))}
    </div>
  );
}
