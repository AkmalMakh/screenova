"use client";
import { AccountButton } from "@/components/auth/account-button";
import * as React from "react";
import { ChevronDown, Clock, Link2, Plus, Search, Send, Paperclip, Loader2, Wand2, X } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CONTENT_LANGUAGES } from "@/lib/locale";
import { deviceLabel, useT } from "@/lib/ui-i18n";
import type { Device } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SegmentThumb, useSegmentThumb } from "@/components/ui/segment-thumb";
import { STUDIO_TEMPLATES, type TemplateEntry } from "@/lib/studio-templates";
export { STUDIO_TEMPLATES, type TemplateEntry } from "@/lib/studio-templates";

type T = ReturnType<typeof useT>["t"];

export type SidebarProject = {
  id: string;
  name: string;
  updatedAt: number;
};


/** A design-reference link the user attached to the composer. App Store links
    resolve to the app's icon/name (and screenshots, held by the page state);
    other links stay as plain named URLs. */
export type ComposerReference = {
  id: string;
  name: string;
  url: string;
  iconUrl?: string;
  loading?: boolean;
};

/** Deck assets that ship with the template — the sidebar's Templates group. */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

export function StudioSidebar({
  projects,
  activeId,
  onOpenProject,
  onNewDeck,
  onOpenTemplate,
  formatUpdatedAt,
}: {
  projects: SidebarProject[];
  activeId?: string | null;
  onOpenProject: (id: string) => void;
  onNewDeck: () => void;
  onOpenTemplate: (template: TemplateEntry) => void;
  formatUpdatedAt: (updatedAt: number, t: T) => string;
}) {
  const { t } = useT();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  // Group by recency the way a person thinks about their own work, not by
  // raw timestamp order.
  const { recent, earlier } = React.useMemo(() => {
    const now = Date.now();
    const recent: SidebarProject[] = [];
    const earlier: SidebarProject[] = [];
    for (const p of filtered) {
      (now - p.updatedAt <= WEEK_MS ? recent : earlier).push(p);
    }
    return { recent, earlier };
  }, [filtered]);

  const templates = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STUDIO_TEMPLATES;
    return STUDIO_TEMPLATES.filter((tpl) => tpl.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <Wand2 className="h-4 w-4" />
        </span>
        <span className="truncate text-footnote font-semibold tracking-tight">
          {t("home.brand")}
        </span>
        <AccountButton />
      </div>

      <div className="px-3 pb-3">
        <Button
          type="button"
          onClick={onNewDeck}
          className="h-9 w-full justify-start gap-2 rounded-sm px-3 text-footnote font-medium"
        >
          <Plus className="h-4 w-4" />
          {t("home.newDeck")}
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("home.searchProjects")}
            aria-label={t("home.searchProjects")}
            className="h-9 w-full rounded-sm border border-border/80 bg-muted/40 pl-8 pr-3 text-footnote outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card"
          />
        </div>
      </div>

      <nav aria-label={t("home.recentTitle")} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <SidebarGroup label={t("home.groupRecent")} hidden={!recent.length}>
          {recent.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              active={project.id === activeId}
              onClick={() => onOpenProject(project.id)}
              subtitle={formatUpdatedAt(project.updatedAt, t)}
            />
          ))}
        </SidebarGroup>

        <SidebarGroup label={t("home.groupEarlier")} hidden={!earlier.length}>
          {earlier.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              active={project.id === activeId}
              onClick={() => onOpenProject(project.id)}
              subtitle={formatUpdatedAt(project.updatedAt, t)}
            />
          ))}
        </SidebarGroup>

        {!filtered.length && !templates.length && (
          <p className="px-2 py-6 text-caption text-muted-foreground">{t("home.emptyProjects")}</p>
        )}

        <SidebarGroup label={t("home.templates")} hidden={!templates.length}>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onOpenTemplate(tpl)}
              className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted/70"
            >
              <img
                src={tpl.thumb}
                alt=""
                loading="lazy"
                className="h-9 w-6 shrink-0 rounded-xs border border-border/70 object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-footnote font-medium">{tpl.name}</span>
                <span className="block truncate text-caption text-muted-foreground">
                  {t("home.slideCount", { count: tpl.slides })}
                </span>
              </span>
            </button>
          ))}
        </SidebarGroup>
      </nav>
    </div>
  );
}

function SidebarGroup({
  label,
  hidden,
  children,
}: {
  label: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <div className="mb-4">
      <p className="px-2 pb-1.5 text-caption font-medium text-muted-foreground">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ProjectRow({
  project,
  subtitle,
  active,
  onClick,
}: {
  project: SidebarProject;
  subtitle: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/70",
      )}
    >
      <span
        aria-hidden
        className="flex h-9 w-6 shrink-0 items-center justify-center rounded-xs border border-border/70 bg-muted/60 text-caption font-semibold uppercase text-muted-foreground"
      >
        {project.name.trim().charAt(0) || "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-footnote font-medium">{project.name}</span>
        <span className="flex items-center gap-1 truncate text-caption text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          {subtitle}
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Composer                                                                   */
/* -------------------------------------------------------------------------- */

export function StudioComposer({
  draft,
  onDraftChange,
  onDetectReferenceLinks,
  onSubmit,
  loading,
  draftRef,
  attachments,
  attachError,
  onAttachClick,
  onRemoveAttachment,
  device,
  onDeviceChange,
  deviceOptions,
  locales,
  onToggleLocale,
  references,
  referenceError,
  onAddReference,
  onRemoveReference,
}: {
  draft: string;
  onDraftChange: (value: string, complete?: boolean) => void;
  onDetectReferenceLinks: (text: string, complete: boolean) => void;
  onSubmit: (text: string) => void;
  loading: boolean;
  draftRef: React.RefObject<HTMLTextAreaElement | null>;
  attachments: Array<{ id: string; name: string; dataUrl: string }>;
  attachError: string | null;
  onAttachClick: () => void;
  onRemoveAttachment: (id: string) => void;
  device: Device;
  onDeviceChange: (device: Device) => void;
  deviceOptions: Device[];
  locales: string[];
  onToggleLocale: (code: string) => void;
  references: ComposerReference[];
  referenceError: string | null;
  onAddReference: (url: string) => boolean;
  onRemoveReference: (id: string) => void;
}) {
  const { t } = useT();
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkDraft, setLinkDraft] = React.useState("");

  function submitLink() {
    if (onAddReference(linkDraft)) setLinkDraft("");
  }

  return (
    <div className="rounded-lg border border-input bg-card shadow-sm transition-shadow focus-within:border-primary/60 focus-within:shadow-card">
      {references.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-4">
          {references.map((reference) => (
            <span
              key={reference.id}
              title={reference.url}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xs border border-border bg-muted/40 pl-2 pr-1 text-footnote"
            >
              {reference.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : reference.iconUrl ? (
                // Remote App Store icon — display only, never uploaded.
                <img
                  src={reference.iconUrl}
                  alt=""
                  className="h-5 w-5 rounded-xs border border-border/60 object-cover"
                />
              ) : (
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="max-w-40 truncate font-medium">{reference.name}</span>
              <button
                type="button"
                onClick={() => onRemoveReference(reference.id)}
                disabled={loading}
                aria-label={t("home.referenceRemove", { name: reference.name })}
                className="flex h-11 w-11 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className={cn("flex flex-wrap gap-1.5 px-4", references.length ? "pt-2" : "pt-4")}>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group relative h-16 w-11 overflow-hidden rounded-sm border border-border/70"
            >
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                className="attachment-remove absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-xs bg-background/90 opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => onRemoveAttachment(attachment.id)}
                disabled={loading}
                aria-label={t("home.removeAttachment", { name: attachment.name })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={draftRef}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value, (event.nativeEvent as InputEvent).inputType === "insertFromPaste")}
        onPaste={(event) => onDetectReferenceLinks(event.clipboardData.getData("text"), true)}
        onBlur={() => onDetectReferenceLinks(draft, true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit(draft);
          }
        }}
        placeholder={t("home.chatPlaceholder")}
        aria-label={t("home.chatPlaceholder")}
        disabled={loading}
        rows={4}
        className="block max-h-[320px] min-h-[132px] w-full resize-none bg-transparent px-4 pb-3 pt-4 text-body leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />

      <p className="px-4 pb-3 text-caption text-muted-foreground">{t("home.referenceAutoHint")}</p>

      {linkOpen && (
        <div className="border-t border-border/70 px-3 py-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitLink();
                } else if (event.key === "Escape") {
                  setLinkOpen(false);
                }
              }}
              placeholder={t("home.referencePlaceholder")}
              aria-label={t("home.referenceButton")}
              autoFocus
              disabled={loading}
              className="h-8 min-w-0 flex-1 bg-transparent text-footnote outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-8 shrink-0 rounded-sm px-3 text-footnote font-medium"
              onClick={submitLink}
              disabled={loading || !linkDraft.trim()}
            >
              {t("home.referenceAdd")}
            </Button>
          </div>
          <p className="pl-6 pt-1 text-caption leading-relaxed text-muted-foreground">
            {t("home.referenceHint")}
          </p>
        </div>
      )}

      {(attachError || referenceError) && (
        <p className="px-4 pb-2 text-caption text-destructive">{attachError || referenceError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-3 py-2.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-sm"
          onClick={onAttachClick}
          disabled={loading}
          aria-label={t("home.attach")}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "h-9 w-9 shrink-0 rounded-sm",
            linkOpen && "border-primary/50 text-primary",
          )}
          onClick={() => setLinkOpen((value) => !value)}
          disabled={loading}
          aria-label={t("home.referenceButton")}
          aria-expanded={linkOpen}
        >
          <Link2 className="h-4 w-4" />
        </Button>

        <SegmentedControl
          label={t("home.device")}
          value={device}
          options={deviceOptions.map((value) => ({ value, label: deviceLabel(value, t) }))}
          onChange={(value) => onDeviceChange(value as Device)}
          disabled={loading}
        />

        <LocaleMenu locales={locales} onToggle={onToggleLocale} disabled={loading} />

        <Button
          type="button"
          className="ml-auto h-11 shrink-0 rounded-sm px-4"
          onClick={() => onSubmit(draft)}
          disabled={loading || !draft.trim()}
          aria-label={t("home.chatSend")}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span>{t("home.chatSend")}</span>
        </Button>
      </div>
    </div>
  );
}

/** One track with a selected thumb — not N independent pills. */
function SegmentedControl({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [ref, thumb] = useSegmentThumb<HTMLDivElement>();
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className="relative inline-flex h-9 shrink-0 items-center gap-0.5 rounded-sm bg-muted/70 p-0.5"
    >
      <SegmentThumb rect={thumb} />
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 h-8 rounded-xs px-2.5 text-footnote font-medium transition-colors duration-micro disabled:opacity-50",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Language picker as a menu, so seven locales cost one control instead of seven. */
function LocaleMenu({
  locales,
  onToggle,
  disabled,
}: {
  locales: string[];
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const primary = CONTENT_LANGUAGES.find((language) => language.code === locales[0]);
  const extra = locales.length - 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("home.languages")}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-border/80 px-3 text-footnote font-medium transition-colors hover:bg-muted/70 disabled:opacity-50"
        >
          {primary?.name ?? t("home.languages")}
          {extra > 0 && <span className="text-muted-foreground">+{extra}</span>}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" collisionPadding={12}
        aria-label={t("home.languages")}
        className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-52 overflow-y-auto rounded-sm"
      >
        {CONTENT_LANGUAGES.map((language) => (
          <DropdownMenuCheckboxItem
            key={language.code}
            checked={locales.includes(language.code)}
            onCheckedChange={() => onToggle(language.code)}
            onSelect={(event) => event.preventDefault()}
            className="py-2 text-footnote"
          >
            {language.name}
          </DropdownMenuCheckboxItem>
        ))}
        <p className="px-2.5 pb-1 pt-2 text-caption leading-relaxed text-muted-foreground">
          {t("home.languagesHint")}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
