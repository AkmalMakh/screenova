"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUp, ChevronDown, Globe, LayoutGrid, Link2, Loader2, Plus, Search, Smartphone, Tablet, X } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CONTENT_LANGUAGES } from "@/lib/locale";
import { deviceLabel, useT } from "@/lib/ui-i18n";
import type { Device } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { GalleryPostSummary } from "@/lib/gallery";

type T = ReturnType<typeof useT>["t"];

export type SidebarProject = {
  id: string;
  name: string;
  updatedAt: number;
  device?: Device;
  thumb?: string;
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


const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

type SidebarTab = "projects" | "gallery";

export function StudioSidebar({
  projects,
  activeId,
  onOpenProject,
  galleryPosts,
  formatUpdatedAt,
}: {
  projects: SidebarProject[];
  activeId?: string | null;
  onOpenProject: (id: string) => void;
  /** Newest public designs; null while loading or when the gallery is unreachable. */
  galleryPosts: GalleryPostSummary[] | null;
  formatUpdatedAt: (updatedAt: number, t: T) => string;
}) {
  const { t } = useT();
  const [tab, setTab] = React.useState<SidebarTab>("projects");
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();

  const filtered = React.useMemo(
    () => (q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects),
    [projects, q],
  );
  const posts = React.useMemo(
    () => (galleryPosts ?? []).filter((post) => !q || post.title.toLowerCase().includes(q)),
    [galleryPosts, q],
  );

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

  const tabs: Array<{ value: SidebarTab; label: string; icon: React.ReactNode }> = [
    { value: "projects", label: t("home.tabProjects"), icon: <LayoutGrid className="h-4 w-4" aria-hidden /> },
    { value: "gallery", label: t("home.gallery"), icon: <Globe className="h-4 w-4" aria-hidden /> },
  ];

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label={t("home.recentTitle")} className="mx-3 mt-3 grid grid-cols-2 gap-1 rounded-full bg-foreground/[0.06] p-1">
        {tabs.map((item) => {
          const on = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(item.value)}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-full text-footnote font-medium transition-colors duration-150",
                on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "projects" ? t("home.searchProjects") : t("home.searchGallery")}
            aria-label={tab === "projects" ? t("home.searchProjects") : t("home.searchGallery")}
            className="h-10 w-full rounded-full border border-transparent bg-foreground/[0.06] pl-10 pr-4 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card sm:text-subhead"
          />
        </div>
      </div>

      {tab === "projects" ? (
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
          {!filtered.length && (
            <p className="px-2 py-6 text-caption text-muted-foreground">{t("home.emptyProjects")}</p>
          )}
        </nav>
      ) : (
        <nav aria-label={t("home.gallery")} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/gallery/${post.id}`}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.05]"
            >
              <img
                src={`/gallery/${post.id}/preview/0`}
                alt=""
                loading="lazy"
                className="h-14 w-14 shrink-0 rounded-sm border border-border/70 bg-card object-cover object-top"
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-subhead font-medium leading-snug">{post.title}</span>
                <span className="mt-0.5 flex items-center gap-1 text-caption text-muted-foreground">
                  <DeviceGlyph device={post.device} />
                  {t("home.slideCount", { count: post.screenCount })}
                </span>
              </span>
            </Link>
          ))}
          {!posts.length && (
            <p className="px-2 py-6 text-caption text-muted-foreground">
              {galleryPosts === null ? t("home.galleryUnavailable") : t("home.galleryEmpty")}
            </p>
          )}
          <Link href="/gallery" className="mt-2 inline-flex items-center gap-1 px-2 text-footnote font-medium text-primary hover:underline">
            {t("home.gallerySeeAll")}
          </Link>
        </nav>
      )}
    </div>
  );
}

function DeviceGlyph({ device }: { device?: Device }) {
  const Icon = device === "ipad" ? Tablet : Smartphone;
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />;
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
      <p className="px-2 pb-2 pt-3 text-subhead font-medium text-muted-foreground">{label}</p>
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
  // A deleted or unreachable screenshot falls back to the initial.
  const [thumbFailed, setThumbFailed] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
        active ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.05]",
      )}
    >
      {project.thumb && !thumbFailed ? (
        <img
          src={project.thumb}
          alt=""
          loading="lazy"
          onError={() => setThumbFailed(true)}
          className="h-14 w-14 shrink-0 rounded-sm border border-border/70 bg-card object-cover object-top"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-border/70 bg-card text-subhead font-semibold uppercase text-muted-foreground"
        >
          {project.name.trim().charAt(0) || "?"}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-subhead font-medium leading-snug">{project.name}</span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-caption text-muted-foreground">
          <DeviceGlyph device={project.device} />
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
    <div className="studio-composer rounded-[18px] border border-primary/25 bg-card/80 shadow-card backdrop-blur transition-shadow focus-within:border-primary/60 focus-within:shadow-pop">
      {references.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-5">
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
        <div className={cn("flex flex-wrap gap-1.5 px-5", references.length ? "pt-2" : "pt-5")}>
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
        rows={5}
        aria-describedby="studio-composer-hint"
        className="block max-h-[360px] min-h-[150px] w-full resize-none bg-transparent px-5 pb-3 pt-5 text-body leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60 sm:min-h-[180px] sm:text-[19px]"
      />
      <p id="studio-composer-hint" className="sr-only">{t("home.referenceAutoHint")}</p>

      {linkOpen && (
        <div className="mx-3 rounded-lg bg-muted/60 px-3 py-2">
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
        <p className="px-5 pb-2 text-caption text-destructive">{attachError || referenceError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={onAttachClick}
          disabled={loading}
          aria-label={t("home.attach")}
        >
          <Plus className="h-5 w-5" />
        </Button>

        <SegmentedControl
          label={t("home.device")}
          value={device}
          options={deviceOptions.map((value) => ({ value, label: deviceLabel(value, t), icon: <DeviceGlyph device={value} /> }))}
          onChange={(value) => onDeviceChange(value as Device)}
          disabled={loading}
        />

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-10 w-10 shrink-0 rounded-full", linkOpen && "bg-primary/10 text-primary")}
            onClick={() => setLinkOpen((value) => !value)}
            disabled={loading}
            aria-label={t("home.referenceButton")}
            aria-expanded={linkOpen}
          >
            <Link2 className="h-4 w-4" />
          </Button>

          <LocaleMenu locales={locales} onToggle={onToggleLocale} disabled={loading} />

          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={() => onSubmit(draft)}
            disabled={loading || !draft.trim()}
            aria-label={t("home.chatSend")}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </Button>
        </div>
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
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-foreground/[0.06] p-1"
    >
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
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-footnote font-medium transition-colors disabled:opacity-50",
              on
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
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
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 text-footnote font-medium transition-colors hover:bg-foreground/[0.1] disabled:opacity-50"
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
