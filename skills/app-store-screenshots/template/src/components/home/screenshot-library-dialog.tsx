"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { thumbnailUrl } from "@/lib/screenshot-library";
import { useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";

/** Pick screenshots that are already uploaded, instead of uploading them again. */
export function ScreenshotLibraryDialog({ open, onOpenChange, paths, room, onPick }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paths: string[];
  /** How many more screenshots the composer can take. */
  room: number;
  onPick: (paths: string[]) => void;
}) {
  const { t } = useT();
  const [picked, setPicked] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  function toggle(path: string) {
    setPicked((current) =>
      current.includes(path)
        ? current.filter((entry) => entry !== path)
        : current.length < room ? [...current, path] : current,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(720px,90dvh)] max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("library.title")}</DialogTitle>
          <DialogDescription>{t("library.hint", { count: room })}</DialogDescription>
        </DialogHeader>

        {paths.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-subhead text-muted-foreground">
            {t("library.empty")}
          </p>
        ) : (
          <div className="-mx-1 grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-y-auto px-1 py-1 sm:grid-cols-5">
            {paths.map((path, index) => {
              const order = picked.indexOf(path);
              const on = order >= 0;
              const full = !on && picked.length >= room;
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => toggle(path)}
                  disabled={full}
                  aria-pressed={on}
                  aria-label={t("library.item", { index: index + 1 })}
                  className={cn(
                    "relative aspect-[9/19.5] overflow-hidden rounded-sm border bg-muted transition-[border-color,opacity] duration-micro ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                    on ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-foreground/30",
                  )}
                >
                  <img src={thumbnailUrl(path)} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                  {on && (
                    // The number is the order the screens will appear in the deck.
                    <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-semibold text-primary-foreground">
                      {order + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" className="h-10 rounded-sm" onClick={() => onOpenChange(false)}>
            {t("library.cancel")}
          </Button>
          <Button
            type="button"
            className="h-10 gap-1.5 rounded-sm px-4"
            disabled={!picked.length}
            onClick={() => {
              onPick(picked);
              onOpenChange(false);
            }}
          >
            <Check className="h-4 w-4" aria-hidden />
            {t("library.add", { count: picked.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
