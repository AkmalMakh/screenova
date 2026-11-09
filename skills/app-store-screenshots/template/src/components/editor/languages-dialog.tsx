"use client";
import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CREDIT_COST } from "@/lib/credits";
import { CONTENT_LANGUAGES } from "@/lib/locale";
import { useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";

export const languageName = (code: string) => CONTENT_LANGUAGES.find((language) => language.code === code)?.name ?? code.toUpperCase();

/**
 * The project's languages. Adding one has Claude write native copy for it
 * from the language being edited; that language is the source and stays on.
 */
export function LanguagesDialog({ open, onOpenChange, locales, source, onApply }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locales: string[];
  source: string;
  onApply: (next: string[], rewrite: boolean) => Promise<boolean>;
}) {
  const { t } = useT();
  const [selected, setSelected] = React.useState<string[]>(locales);
  const [rewrite, setRewrite] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelected(locales);
    setRewrite(false);
  }, [open, locales]);

  const added = selected.filter((code) => !locales.includes(code));
  const targets = rewrite ? selected.filter((code) => code !== source) : added;
  const changed = added.length > 0 || selected.length !== locales.length || rewrite;

  function toggle(code: string) {
    if (code === source) return;
    setSelected((current) => (current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code]));
  }

  async function apply() {
    setWorking(true);
    try {
      if (await onApply(selected, rewrite)) onOpenChange(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !working && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("languages.title")}</DialogTitle>
          <DialogDescription>{t("languages.hint", { source: languageName(source) })}</DialogDescription>
        </DialogHeader>

        <div role="group" aria-label={t("languages.title")} className="grid grid-cols-2 gap-2">
          {CONTENT_LANGUAGES.map((language) => {
            const on = selected.includes(language.code);
            const isSource = language.code === source;
            return (
              <button
                key={language.code}
                type="button"
                aria-pressed={on}
                disabled={working || isSource}
                onClick={() => toggle(language.code)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-2 rounded-sm border px-3 text-left text-footnote font-medium transition-[background-color,border-color,color] duration-micro ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-foreground/25",
                  isSource && "cursor-default",
                )}
              >
                <span className="flex items-center gap-2">
                  {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                  {language.name}
                </span>
                {isSource && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-caption">{t("languages.source")}</span>
                )}
              </button>
            );
          })}
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-footnote">
          <input
            type="checkbox"
            checked={rewrite}
            disabled={working}
            onChange={(event) => setRewrite(event.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          {t("languages.rewrite")}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-caption text-muted-foreground" aria-live="polite">
            {working && targets.length
              ? t("languages.writing", { languages: targets.map(languageName).join(", ") })
              : targets.length
                ? t("credits.draftCost", { cost: CREDIT_COST.edit })
                : ""}
          </span>
          <Button type="button" className="h-10 gap-1.5 rounded-sm px-5" disabled={!changed || working} onClick={() => void apply()}>
            {working && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
            {t("languages.select")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
