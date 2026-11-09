"use client";
import * as React from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Device } from "@/lib/types";
import { deviceLabel, useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";

export type ExportChoice = {
  device: Device;
  screens: number;
  /** "designed": its own deck; "copies": untouched, will take `source`'s design; "starter": untouched, nothing to copy. */
  status: "designed" | "copies" | "starter";
  source?: Device;
};

/** Which devices go into the export bundle. */
export function ExportDialog({ open, onOpenChange, choices, initial, onExport }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choices: ExportChoice[];
  initial: Device[];
  onExport: (devices: Device[]) => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = React.useState<Device[]>(initial);

  React.useEffect(() => {
    if (open) setSelected(initial);
    // Reset only when the dialog opens, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(device: Device) {
    setSelected((current) => (current.includes(device) ? current.filter((entry) => entry !== device) : [...current, device]));
  }

  const ordered = choices.filter((choice) => selected.includes(choice.device)).map((choice) => choice.device);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>{t("export.hint")}</DialogDescription>
        </DialogHeader>

        <div role="group" aria-label={t("export.title")} className="space-y-2">
          {choices.map((choice) => {
            const on = selected.includes(choice.device);
            const note = choice.status === "copies" && choice.source
              ? t("export.copies", { device: deviceLabel(choice.source, t) })
              : choice.status === "starter"
                ? t("export.starter")
                : t("export.screens", { count: choice.screens });
            return (
              <button
                key={choice.device}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(choice.device)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-sm border px-3 text-left transition-[background-color,border-color] duration-micro ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary/40 bg-primary/10" : "border-border bg-card hover:border-foreground/25",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-xs border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-footnote font-medium">{deviceLabel(choice.device, t)}</span>
                  <span className="block text-caption text-muted-foreground">{note}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" className="h-10 rounded-sm" onClick={() => onOpenChange(false)}>
            {t("export.cancel")}
          </Button>
          <Button
            type="button"
            className="h-10 gap-1.5 rounded-sm px-4"
            disabled={!ordered.length}
            onClick={() => {
              onOpenChange(false);
              onExport(ordered);
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("export.submit", { count: ordered.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
