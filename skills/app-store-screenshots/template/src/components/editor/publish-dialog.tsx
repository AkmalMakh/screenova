"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/ui-i18n";

type Phase = { kind: "form" } | { kind: "publishing" } | { kind: "done"; url: string };

export function PublishDialog({
  open,
  onOpenChange,
  defaultTitle,
  screenCount,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  screenCount: number;
  /** Resolves with the new post id, or throws an Error with user-facing copy. */
  onPublish: (title: string, description: string) => Promise<string>;
}) {
  const { t } = useT();
  const [title, setTitle] = React.useState(defaultTitle);
  const [description, setDescription] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>({ kind: "form" });
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setDescription("");
    setPhase({ kind: "form" });
    setError(null);
    setCopied(false);
  }, [open, defaultTitle]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || phase.kind === "publishing") return;
    setError(null);
    setPhase({ kind: "publishing" });
    try {
      const id = await onPublish(title.trim(), description.trim());
      setPhase({ kind: "done", url: `${window.location.origin}/gallery/${id}` });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("publish.failed"));
      setPhase({ kind: "form" });
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(t("publish.copyFailed"));
    }
  }

  const publishing = phase.kind === "publishing";

  return (
    <Dialog open={open} onOpenChange={(next) => !publishing && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        {phase.kind === "done" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                {t("publish.doneTitle")}
              </DialogTitle>
              <DialogDescription>{t("publish.doneDescription")}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input readOnly value={phase.url} aria-label={t("publish.link")} className="h-10 rounded-sm text-base" onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" variant="outline" className="h-10 shrink-0 gap-2 rounded-sm" onClick={() => void copy(phase.url)}>
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? t("publish.copied") : t("publish.copy")}
              </Button>
            </div>
            {error && <p role="alert" className="text-caption text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" className="h-10 rounded-sm" onClick={() => onOpenChange(false)}>
                {t("publish.close")}
              </Button>
              <Button asChild className="h-10 gap-2 rounded-sm">
                <a href={phase.url} target="_blank" rel="noopener noreferrer">
                  {t("publish.view")}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{t("publish.title")}</DialogTitle>
              <DialogDescription>{t("publish.description", { count: screenCount })}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="publish-title" className="block text-footnote font-medium">{t("publish.nameLabel")}</Label>
              <Input
                id="publish-title"
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 rounded-sm text-base"
                disabled={publishing}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-description" className="block text-footnote font-medium">
                {t("publish.notesLabel")} <span className="font-normal text-muted-foreground">{t("publish.optional")}</span>
              </Label>
              <Textarea
                id="publish-description"
                value={description}
                maxLength={280}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
                className="resize-none rounded-sm text-base"
                disabled={publishing}
              />
            </div>
            <ul className="space-y-2 rounded-lg border border-border bg-muted/50 p-4 text-footnote">
              <li className="flex gap-2"><Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />{t("publish.visibility")}</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />{t("publish.reuse")}</li>
            </ul>
            {error && <p role="alert" className="text-footnote text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" className="h-10 rounded-sm" onClick={() => onOpenChange(false)} disabled={publishing}>
                {t("publish.cancel")}
              </Button>
              <Button type="submit" className="h-10 gap-2 rounded-sm px-5" disabled={publishing || !title.trim()}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Globe className="h-4 w-4" aria-hidden />}
                {publishing ? t("publish.publishing") : t("publish.submit")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
