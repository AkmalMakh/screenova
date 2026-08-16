"use client";
import * as React from "react";
import { Command, CornerDownLeft, Search } from "lucide-react";
import { useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
  disabled?: boolean;
};

export type PaletteGroup = {
  label: string;
  items: PaletteAction[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: PaletteGroup[];
};

// ⌘K command palette — keyboard-first, filter-as-you-type, Enter to run.
// Custom overlay instead of Radix so arrow-key focus stays under our control.
export function CommandPalette({ open, onOpenChange, groups }: Props) {
  const { t } = useT();
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset filter + selection whenever the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      // Focus after the panel mounts so the cursor lands in the search box.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const normalized = query.trim().toLowerCase();
  const filtered = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !normalized ||
          item.label.toLowerCase().includes(normalized) ||
          (item.hint || "").toLowerCase().includes(normalized),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const flat = filtered.flatMap((group) => group.items);
  const active = flat[Math.max(0, Math.min(index, flat.length - 1))] || null;

  React.useEffect(() => {
    setIndex(0);
  }, [query]);

  function run(action: PaletteAction) {
    if (action.disabled) return;
    onOpenChange(false);
    action.run();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((current) => (flat.length ? (current + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((current) => (flat.length ? (current - 1 + flat.length) % flat.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) run(active);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-popover shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.placeholder")}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="flex h-6 shrink-0 items-center gap-1 rounded-md border bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />
            K
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("palette.empty")}
            </p>
          ) : (
            filtered.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((action) => {
                  const isActive = active?.id === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onMouseEnter={() =>
                        setIndex(Math.max(0, flat.findIndex((item) => item.id === action.id)))
                      }
                      onClick={() => run(action)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100",
                        isActive ? "bg-primary text-primary-foreground" : "text-foreground",
                        action.disabled && "opacity-40",
                      )}
                    >
                      <span className="truncate">{action.label}</span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 text-[11px]",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {action.hint}
                        {isActive && <CornerDownLeft className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
