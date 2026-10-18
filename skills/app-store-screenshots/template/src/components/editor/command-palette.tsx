"use client";
import * as React from "react";
import { Command, CornerDownLeft, Search } from "lucide-react";
import { useT } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";
import { usePresence } from "./use-editor-layout";

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
// ARIA combobox pattern: focus stays in the search field, the highlighted
// command is announced through aria-activedescendant.
export function CommandPalette({ open, onOpenChange, groups }: Props) {
  const { t } = useT();
  const listId = React.useId();
  const presence = usePresence(open);
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

  const optionId = (id: string) => `${listId}-${id}`;
  // Keep the highlighted command in view while arrowing through a long list.
  React.useEffect(() => {
    if (!open || !active) return;
    document.getElementById(optionId(active.id))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active?.id]);

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
    } else if (event.key === "Tab") {
      // Modal: focus never leaves the palette; commands are reached by arrows.
      event.preventDefault();
    }
  }

  if (!presence.mounted) return null;

  return (
    <div
      data-state={presence.state}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm duration-short ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-micro data-[state=closed]:fill-mode-forwards"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        data-state={presence.state}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-popover shadow-pop ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-top-2 data-[state=open]:duration-short data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98] data-[state=closed]:duration-micro data-[state=closed]:ease-in data-[state=closed]:fill-mode-forwards"
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
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(active.id) : undefined}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="flex h-6 shrink-0 items-center gap-1 rounded-xs border bg-muted/60 px-1.5 text-caption font-medium text-muted-foreground">
            <Command className="h-3 w-3" />
            K
          </kbd>
        </div>

        <div id={listId} role="listbox" aria-label={t("palette.title")} className="max-h-[50vh] overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("palette.empty")}
            </p>
          ) : (
            filtered.map((group) => (
              <div key={group.label} role="group" aria-labelledby={`${listId}-g-${group.label}`}>
                <p id={`${listId}-g-${group.label}`} className="px-3 pb-1 pt-3 text-caption font-semibold text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((action) => {
                  const isActive = active?.id === action.id;
                  return (
                    <div
                      key={action.id}
                      id={optionId(action.id)}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={action.disabled || undefined}
                      onMouseMove={() =>
                        setIndex(Math.max(0, flat.findIndex((item) => item.id === action.id)))
                      }
                      // Keep focus in the search field while clicking.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => run(action)}
                      className={cn(
                        "flex w-full cursor-default items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-micro",
                        isActive ? "bg-primary text-primary-foreground" : "text-foreground",
                        action.disabled && "opacity-40",
                      )}
                    >
                      <span className="truncate">{action.label}</span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 text-caption tabular-nums",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {action.hint}
                        {isActive && <CornerDownLeft className="h-3 w-3" />}
                      </span>
                    </div>
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
