"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fileToDataUrl, uploadDataUrl } from "@/components/editor/screenshot-picker";
import type { AppStoreLookupResult } from "@/lib/app-store";
import { LAYOUT_LABEL, themeById } from "@/lib/constants";
import { buildSlidesFromAnalysis, type SlideAnalysis } from "@/lib/import-slides";
import { CONTENT_LANGUAGES } from "@/lib/locale";
import { useProject } from "@/lib/storage";
import type { DeckSuggestion } from "@/lib/suggest-deck";
import type { Device, Theme } from "@/lib/types";
import { deviceLabel, LanguageProvider, useT } from "@/lib/ui-i18n";
import type { TranslationKey } from "@/lib/ui-translations/en";
import { cn } from "@/lib/utils";

type T = ReturnType<typeof useT>["t"];

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };
type Attachment = { id: string; name: string; dataUrl: string };

type ImportResult = {
  ok: boolean;
  app: AppStoreLookupResult;
  iconPath: string;
  screenshots: Array<{ name: string; path: string }>;
};

const CHAT_DEVICES: Device[] = ["iphone", "ipad", "android"];
const IMPORT_DEVICES: Device[] = ["iphone", "ipad"];
const MAX_ATTACHMENTS = 10;
const MAX_ATTACH_BYTES = 8 * 1024 * 1024;
const ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp";
const DECK_LOCALE = (deck: DeckSuggestion, locales: string[]): string => {
  for (const locale of locales) {
    if (deck.slides.some((slide) => slide.copy[locale])) return locale;
  }
  return "en";
};
const SUGGESTION_CHIPS: TranslationKey[] = [
  "home.chip1",
  "home.chip2",
  "home.chip3",
  "home.chip4",
  "home.chip5",
];

// Decorative mini-deck shown under the hero — colors drawn from the app's
// own themes (clean-light, dark-bold, ocean-fresh).
const HERO_CARDS = [
  { bg: "#F6F1EA", line: "#171717", accent: "#5B7CFA", fg: "#171717", tilt: -4 },
  { bg: "#0B1020", line: "#F8FAFC", accent: "#8B5CF6", fg: "#F8FAFC", tilt: 0 },
  { bg: "#E0F2FE", line: "#0C4A6E", accent: "#0284C7", fg: "#0C4A6E", tilt: 4 },
];

export function HomePage() {
  return (
    <LanguageProvider>
      <Home />
    </LanguageProvider>
  );
}

function Home() {
  const { t, lang } = useT();
  const router = useRouter();
  const { hydrated, projects, createProject, switchProject, deleteProject, setState } =
    useProject();

  // App Store link flow (secondary).
  const [link, setLink] = React.useState("");
  const [linkLoading, setLinkLoading] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [lookupApp, setLookupApp] = React.useState<AppStoreLookupResult | null>(null);
  const [importDevice, setImportDevice] = React.useState<Device>("iphone");
  const [importLocales, setImportLocales] = React.useState<string[]>(["en"]);
  const [importing, setImporting] = React.useState<string | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  // Describe-your-app chat flow (main).
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = React.useState("");
  const [chatLoading, setChatLoading] = React.useState(false);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [attachError, setAttachError] = React.useState<string | null>(null);
  const [deck, setDeck] = React.useState<DeckSuggestion | null>(null);
  const [deckPaths, setDeckPaths] = React.useState<string[]>([]);
  const [deckAppName, setDeckAppName] = React.useState("");
  const [chatDevice, setChatDevice] = React.useState<Device>("iphone");
  const [chatLocales, setChatLocales] = React.useState<string[]>(["en"]);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Preselect the current UI language plus English, like the new-project dialog.
  React.useEffect(() => {
    if (lang === "en") return;
    setImportLocales((current) => (current.length === 1 ? [lang, "en"] : current));
    setChatLocales((current) => (current.length === 1 ? [lang, "en"] : current));
  }, [lang]);

  React.useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [chatMessages, chatLoading]);

  // ---------- App Store link flow ----------

  async function submitLookup(event: React.FormEvent) {
    event.preventDefault();
    const value = link.trim();
    if (!value || linkLoading) return;
    setLinkLoading(true);
    setLinkError(null);
    setLookupApp(null);
    try {
      const response = await fetch("/api/app-store/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const json = (await response.json()) as { ok?: boolean; app?: AppStoreLookupResult; error?: string };
      if (!response.ok || !json.ok || !json.app) {
        throw new Error(json.error || t("home.lookupFailed"));
      }
      setLookupApp(json.app);
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : t("home.lookupFailed"));
    } finally {
      setLinkLoading(false);
    }
  }

  function resetLookup() {
    setLookupApp(null);
    setImportError(null);
    setImporting(null);
    setLink("");
  }

  async function importApp() {
    if (!lookupApp || importing) return;
    const locales = importLocales.length ? importLocales : ["en"];
    setImporting(t("home.importingFetch"));
    setImportError(null);
    let createdId: string | null = null;
    try {
      const response = await fetch("/api/app-store/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link.trim(), device: importDevice }),
      });
      const json = (await response.json()) as Partial<ImportResult> & { error?: string };
      if (!response.ok || !json.ok || !json.screenshots?.length) {
        throw new Error(json.error || t("home.importFailed"));
      }
      const result = json as ImportResult;
      const created = createProject(result.app.trackName, locales);
      createdId = created.id ?? null;
      setState((prev) => ({
        ...prev,
        appName: result.app.trackName,
        appIcon: result.iconPath || prev.appIcon,
        device: importDevice,
      }));

      setImporting(t("home.importingDraft"));
      const analysisResponse = await fetch("/api/design/analyze-screenshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appName: result.app.trackName,
          locales,
          screenshots: result.screenshots,
        }),
      });
      const analysis = (await analysisResponse.json()) as {
        ok?: boolean;
        slides?: SlideAnalysis[];
        error?: string;
      };
      if (!analysisResponse.ok || !analysis.ok || !analysis.slides) {
        throw new Error(analysis.error || t("home.importFailed"));
      }
      const slides = buildSlidesFromAnalysis(
        analysis.slides,
        result.screenshots.map((screenshot) => screenshot.path),
        locales,
        importDevice,
      );
      setState((prev) => ({
        ...prev,
        slidesByDevice: { ...prev.slidesByDevice, [importDevice]: slides },
      }));
      router.push("/editor");
    } catch (error) {
      // Don't leave a half-imported project behind — it would show up in
      // Recent projects as an empty deck.
      if (createdId) deleteProject(createdId);
      setImporting(null);
      setImportError(error instanceof Error ? error.message : t("home.importFailed"));
    }
  }

  // ---------- Chat flow ----------

  async function addFiles(list: FileList | null) {
    if (!list || chatLoading) return;
    setAttachError(null);
    const room = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const picked = Array.from(list).slice(0, room);
    if (Array.from(list).length > room) {
      setAttachError(t("home.attachTooMany", { count: MAX_ATTACHMENTS }));
    }
    const next: Attachment[] = [];
    for (const file of picked) {
      if (!ATTACHMENT_TYPES.includes(file.type)) {
        setAttachError(t("home.attachFormatError"));
        continue;
      }
      if (file.size > MAX_ATTACH_BYTES) {
        setAttachError(t("home.attachTooLarge", { name: file.name }));
        continue;
      }
      try {
        next.push({ id: chatId(), name: file.name, dataUrl: await fileToDataUrl(file) });
      } catch {
        setAttachError(t("home.uploadFailed", { name: file.name }));
      }
    }
    if (next.length) {
      setAttachments((current) => [...current, ...next].slice(0, MAX_ATTACHMENTS));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
    setAttachError(null);
  }

  async function submitChat(text: string) {
    const value = text.trim();
    if (!value || chatLoading) return;
    setChatDraft("");
    setAttachError(null);
    const userMessage: ChatMessage = { id: chatId(), role: "user", text: value };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatLoading(true);
    try {
      // Upload the attached screenshots first so the model can see them.
      const paths: string[] = [];
      for (const attachment of attachments) {
        const uploaded = await uploadDataUrl(attachment.dataUrl);
        if (!uploaded) {
          throw new Error(t("home.uploadFailed", { name: attachment.name }));
        }
        paths.push(uploaded);
      }
      const response = await fetch("/api/design/suggest-deck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, text: messageText }) => ({ role, text: messageText })),
          locales: chatLocales,
          device: chatDevice,
          count: 5,
          screenshots: attachments.length
            ? paths.map((path, index) => ({ name: attachments[index].name, path }))
            : undefined,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; deck?: DeckSuggestion; error?: string };
      if (!response.ok || !json.ok || !json.deck) {
        throw new Error(json.error || t("home.chatFailed"));
      }
      setDeck(json.deck);
      setDeckPaths(paths);
      setDeckAppName(json.deck.appName);
      setAttachments([]);
      setChatMessages((messages) => [
        ...messages,
        { id: chatId(), role: "assistant", text: json.deck!.summary },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("home.chatFailed");
      setChatMessages((messages) => [
        ...messages,
        { id: chatId(), role: "assistant", text: message },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function openDeckInEditor() {
    if (!deck || !deckAppName.trim()) return;
    const locales = chatLocales.length ? chatLocales : ["en"];
    const slides = buildSlidesFromAnalysis(deck.slides, deckPaths, locales, chatDevice);
    createProject(deckAppName.trim(), locales);
    setState((prev) => ({
      ...prev,
      appName: deckAppName.trim(),
      themeId: deck.themeId,
      device: chatDevice,
      slidesByDevice: { ...prev.slidesByDevice, [chatDevice]: slides },
    }));
    router.push("/editor");
  }

  function openProject(id: string) {
    switchProject(id);
    router.push("/editor");
  }

  function startBlank() {
    createProject();
    router.push("/editor");
  }

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm">{t("home.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass sticky top-0 z-40 border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            type="button"
            className="flex items-center gap-2"
            onClick={() => {
              resetLookup();
            }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wand2 className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">{t("home.brand")}</span>
          </button>
          <span className="hidden text-caption text-muted-foreground sm:block">
            {t("home.tagline")}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <section className="mx-auto max-w-3xl pb-10 pt-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-white/70 px-3.5 py-1 text-caption font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3 w-3 text-primary" />
            {t("home.badge")}
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-balance text-[42px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[54px]">
            {t("home.title1")}
            <br />
            {t("home.title2")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-subhead leading-relaxed text-muted-foreground">
            {t("home.subtitle")}
          </p>

          <div aria-hidden className="mx-auto mt-12 flex max-w-md items-end justify-center gap-4">
            {HERO_CARDS.map((card, index) => (
              <div
                key={index}
                className="fade-up w-24 overflow-hidden rounded-xl border border-border/70 shadow-card"
                style={{
                  animationDelay: `${150 + index * 90}ms`,
                  transform: `rotate(${card.tilt}deg)`,
                }}
              >
                <div className="aspect-[9/19]" style={{ backgroundColor: card.bg }}>
                  <div
                    className="mx-auto mt-[16%] flex h-[40%] w-[58%] flex-col items-center justify-center gap-[8%] rounded-[14%] border"
                    style={{ borderColor: card.line, opacity: 0.85 }}
                  >
                    <span className="h-[4%] w-[62%] rounded-full" style={{ backgroundColor: card.line }} />
                    <span className="h-[4%] w-[40%] rounded-full" style={{ backgroundColor: card.line }} />
                  </div>
                  <div className="mx-auto mt-[12%] flex flex-col items-center gap-[6%]">
                    <span className="h-1.5 w-12 rounded-full" style={{ backgroundColor: card.accent }} />
                    <span className="h-2 w-16 rounded-full" style={{ backgroundColor: card.fg }} />
                    <span className="h-2 w-10 rounded-full" style={{ backgroundColor: card.fg, opacity: 0.6 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <ChatCard
          messages={chatMessages}
          draft={chatDraft}
          onDraftChange={setChatDraft}
          loading={chatLoading}
          onSubmit={(text) => void submitChat(text)}
          scrollRef={chatScrollRef}
          attachments={attachments}
          attachError={attachError}
          onAddFiles={(list) => void addFiles(list)}
          onRemoveAttachment={removeAttachment}
          fileRef={fileRef}
          device={chatDevice}
          onDeviceChange={setChatDevice}
          locales={chatLocales}
          onToggleLocale={(code) =>
            setChatLocales((current) =>
              current.includes(code)
                ? current.length === 1
                  ? current
                  : current.filter((entry) => entry !== code)
                : [...current, code],
            )
          }
        />

        {deck && (
          <DeckPreview
            deck={deck}
            paths={deckPaths}
            appName={deckAppName}
            onAppNameChange={setDeckAppName}
            device={chatDevice}
            onDeviceChange={setChatDevice}
            locales={chatLocales}
            onToggleLocale={(code) =>
              setChatLocales((current) =>
                current.includes(code)
                  ? current.length === 1
                    ? current
                    : current.filter((entry) => entry !== code)
                  : [...current, code],
              )
            }
            loading={chatLoading}
            onOpenEditor={openDeckInEditor}
          />
        )}

        <section className="mx-auto mt-14 max-w-2xl">
          <h2 className="mb-3 text-title3 font-semibold tracking-tight">
            {t("home.linkSectionTitle")}
          </h2>
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            {!lookupApp ? (
              <form onSubmit={submitLookup} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    placeholder={t("home.linkPlaceholder")}
                    className="h-10 flex-1 text-sm"
                    aria-label={t("home.linkLabel")}
                    disabled={linkLoading}
                  />
                  <Button
                    type="submit"
                    className="h-10 shrink-0 px-4"
                    disabled={linkLoading || !link.trim()}
                  >
                    {linkLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("home.fetching")}
                      </>
                    ) : (
                      t("home.fetch")
                    )}
                  </Button>
                </div>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {t("home.linkHint")}
                </p>
                {linkError && <p className="text-xs text-destructive">{linkError}</p>}
              </form>
            ) : (
              <LookupResult
                app={lookupApp}
                device={importDevice}
                onDeviceChange={setImportDevice}
                locales={importLocales}
                onToggleLocale={(code) =>
                  setImportLocales((current) =>
                    current.includes(code)
                      ? current.length === 1
                        ? current
                        : current.filter((entry) => entry !== code)
                      : [...current, code],
                  )
                }
                importing={importing}
                importError={importError}
                onImport={() => void importApp()}
                onReset={resetLookup}
              />
            )}
          </div>
        </section>

        {projects.length > 0 && (
          <section className="mx-auto mt-14 max-w-2xl">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-title3 font-semibold tracking-tight">
                {t("home.recentTitle")}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-border/80 bg-white/70 px-3 py-1 text-caption font-medium text-foreground shadow-sm transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-accent active:scale-[0.97]"
                  onClick={startBlank}
                >
                  {t("home.blankCardTitle")}
                </button>
                <span className="text-caption text-muted-foreground">{t("home.recentHint")}</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="lift-hover group flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 text-left shadow-card"
                  onClick={() => openProject(project.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-caption text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatUpdatedAt(project.updatedAt, t)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ---------- Chat card (main flow) ----------

function ChatCard({
  messages,
  draft,
  onDraftChange,
  loading,
  onSubmit,
  scrollRef,
  attachments,
  attachError,
  onAddFiles,
  onRemoveAttachment,
  fileRef,
  device,
  onDeviceChange,
  locales,
  onToggleLocale,
}: {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  loading: boolean;
  onSubmit: (text: string) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  attachments: Attachment[];
  attachError: string | null;
  onAddFiles: (list: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  device: Device;
  onDeviceChange: (device: Device) => void;
  locales: string[];
  onToggleLocale: (code: string) => void;
}) {
  const { t } = useT();
  const draftRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus the description box on desktop so users can start typing right away.
  // preventScroll: without it the browser scrolls the composer into view on
  // mount, skipping the hero and pinning the card under the sticky header.
  React.useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      draftRef.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <section className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
        <div className="flex items-center gap-2.5 border-b border-border/70 bg-white/50 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="text-title3 font-semibold tracking-tight">{t("home.chatTitle")}</h2>
            <p className="text-caption text-muted-foreground">{t("home.chatSubtitle")}</p>
          </div>
        </div>

        <div className="flex h-[380px] min-h-0 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted/40">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </span>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {t("home.chatEmpty")}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {SUGGESTION_CHIPS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded-full border border-border/80 bg-white/70 px-3.5 py-1.5 text-xs text-muted-foreground shadow-sm transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-accent hover:text-foreground active:scale-[0.97]"
                      onClick={() => onSubmit(t(key))}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-foreground",
                      )}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 rounded-2xl bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("home.chatThinking")}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t p-3">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="group relative h-16 w-11 overflow-hidden rounded-md border"
                  >
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-background/90 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                      onClick={() => onRemoveAttachment(attachment.id)}
                      disabled={loading}
                      title={t("home.removeAttachment", { name: attachment.name })}
                      aria-label={t("home.removeAttachment", { name: attachment.name })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachError && <p className="mb-1.5 text-caption text-destructive">{attachError}</p>}

            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                {t("home.device")}
                <DevicePicker
                  value={device}
                  options={CHAT_DEVICES}
                  onChange={onDeviceChange}
                  disabled={loading}
                />
              </span>
              <span className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                {t("home.languages")}
                <LocalePicker selected={locales} onToggle={onToggleLocale} disabled={loading} />
              </span>
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                title={t("home.attach")}
                aria-label={t("home.attach")}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                ref={draftRef}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    onSubmit(draft);
                  }
                }}
                placeholder={t("home.chatPlaceholder")}
                rows={2}
                className="min-h-0 flex-1 resize-none text-sm"
                aria-label={t("home.chatPlaceholder")}
                disabled={loading}
              />
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => onSubmit(draft)}
                disabled={loading || !draft.trim()}
                title={t("home.chatSend")}
                aria-label={t("home.chatSend")}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              hidden
              disabled={loading}
              onChange={(event) => {
                onAddFiles(event.currentTarget.files);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Deck preview ----------

function DeckPreview({
  deck,
  paths,
  appName,
  onAppNameChange,
  device,
  onDeviceChange,
  locales,
  onToggleLocale,
  loading,
  onOpenEditor,
}: {
  deck: DeckSuggestion;
  paths: string[];
  appName: string;
  onAppNameChange: (value: string) => void;
  device: Device;
  onDeviceChange: (device: Device) => void;
  locales: string[];
  onToggleLocale: (code: string) => void;
  loading: boolean;
  onOpenEditor: () => void;
}) {
  const { t } = useT();
  const theme = themeById(deck.themeId);

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title3 font-semibold tracking-tight">{t("home.deckTitle")}</h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accent }} />
            {t("home.deckTheme", { theme: theme.name })}
          </span>
          <span className="text-caption text-muted-foreground">
            {t("home.deckScreens", { count: deck.slides.length })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {deck.slides.map((slide, index) => (
          <div
            key={index}
            className="fade-up"
            style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
          >
            <DeckSlideCard
              slide={slide}
              locale={DECK_LOCALE(deck, locales)}
              theme={theme}
              thumbnail={paths[index]}
            />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label className="text-xs">{t("home.appNameLabel")}</Label>
            <Input
              value={appName}
              onChange={(event) => onAppNameChange(event.target.value)}
              maxLength={60}
              className="h-8 text-sm"
              aria-label={t("home.appNameLabel")}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("home.device")}</Label>
            <DevicePicker
              value={device}
              options={CHAT_DEVICES}
              onChange={onDeviceChange}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("home.languages")}</Label>
            <LocalePicker selected={locales} onToggle={onToggleLocale} disabled={loading} />
          </div>
          <Button
            type="button"
            className="h-9 px-4"
            onClick={onOpenEditor}
            disabled={loading || !appName.trim()}
          >
            {t("home.openEditor")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-2 text-caption text-muted-foreground">{t("home.languagesHint")}</p>
      </div>
    </div>
  );
}

// ---------- App Store result card ----------

function LookupResult({
  app,
  device,
  onDeviceChange,
  locales,
  onToggleLocale,
  importing,
  importError,
  onImport,
  onReset,
}: {
  app: AppStoreLookupResult;
  device: Device;
  onDeviceChange: (device: Device) => void;
  locales: string[];
  onToggleLocale: (code: string) => void;
  importing: string | null;
  importError: string | null;
  onImport: () => void;
  onReset: () => void;
}) {
  const { t } = useT();
  const previewScreens =
    device === "ipad"
      ? app.ipadScreenshotUrls.length
        ? app.ipadScreenshotUrls
        : app.screenshotUrls
      : app.screenshotUrls.length
        ? app.screenshotUrls
        : app.ipadScreenshotUrls;
  const busy = !!importing;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {app.artworkUrl100 && (
          // Remote Apple CDN thumbnail — displayed directly, never uploaded.
          <img
            src={app.artworkUrl100}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border bg-muted object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-title3 font-semibold tracking-tight">{app.trackName}</h2>
            {app.trackViewUrl && (
              <a
                href={app.trackViewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
                title={t("home.viewOnAppStore")}
                aria-label={t("home.viewOnAppStore")}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[app.sellerName, app.primaryGenreName].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-muted-foreground">
            {app.averageUserRating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">
                  {app.averageUserRating.toFixed(1)}
                </span>
                {app.userRatingCount > 0 && (
                  <span>
                    ({t("home.ratingCount", { count: app.userRatingCount.toLocaleString() })})
                  </span>
                )}
              </span>
            )}
            {app.version && <span>{t("home.version", { version: app.version })}</span>}
          </div>
        </div>
      </div>

      {previewScreens.length > 0 && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-5 gap-1.5">
            {previewScreens.slice(0, 5).map((url) => (
              // Remote Apple CDN thumbnails for preview only; the import API
              // downloads the real files server-side.
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="aspect-[9/19] w-full rounded-md border bg-muted object-cover"
              />
            ))}
          </div>
          <p className="text-caption text-muted-foreground">
            {t("home.screenshotCount", { count: previewScreens.length })}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">{t("home.device")}</Label>
        <DevicePicker value={device} options={IMPORT_DEVICES} onChange={onDeviceChange} disabled={busy} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("home.languages")}</Label>
        <LocalePicker selected={locales} onToggle={onToggleLocale} disabled={busy} />
        <p className="text-caption text-muted-foreground">{t("home.languagesHint")}</p>
      </div>

      {importError && <p className="text-xs text-destructive">{importError}</p>}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onReset}
          disabled={busy}
        >
          <X className="h-3.5 w-3.5" />
          {t("home.differentLink")}
        </Button>
        <Button type="button" className="h-9 px-4" onClick={onImport} disabled={busy}>
          {importing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {importing}
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              {t("home.import")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------- Small pieces ----------

function DeckSlideCard({
  slide,
  locale,
  theme,
  thumbnail,
}: {
  slide: SlideAnalysis;
  locale: string;
  theme: Theme;
  thumbnail?: string;
}) {
  const copy = slide.copy[locale] || slide.copy.en || Object.values(slide.copy)[0];
  return (
    <div
      className="lift-hover relative flex aspect-[9/19] flex-col overflow-hidden rounded-xl border border-border/70 shadow-card"
      style={{ backgroundColor: theme.bg, color: theme.fg }}
    >
      {thumbnail ? (
        <>
          <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <span className="absolute left-3 top-2 z-10 text-[8px] font-semibold uppercase tracking-widest text-white/80">
            {LAYOUT_LABEL[slide.layout]}
          </span>
          <div className="relative z-10 mt-auto p-3 text-white">
            {copy?.label && (
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: theme.accent }}>
                {copy.label}
              </p>
            )}
            {copy?.headline && (
              <p className="mt-1 whitespace-pre-line text-[13px] font-semibold leading-tight">
                {copy.headline}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="p-3 text-[8px] font-semibold uppercase tracking-widest opacity-50">
            {LAYOUT_LABEL[slide.layout]}
          </span>
          <div className="mt-auto p-3">
            {copy?.label && (
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: theme.accent }}>
                {copy.label}
              </p>
            )}
            {copy?.headline && (
              <p className="mt-1 whitespace-pre-line text-[13px] font-semibold leading-tight">
                {copy.headline}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DevicePicker({
  value,
  options,
  onChange,
  disabled,
}: {
  value: Device;
  options: Device[];
  onChange: (device: Device) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {options.map((device) => (
        <Button
          key={device}
          type="button"
          size="sm"
          variant={value === device ? "default" : "outline"}
          className="h-8 rounded-md px-3 text-footnote"
          aria-pressed={value === device}
          disabled={disabled}
          onClick={() => onChange(device)}
        >
          {deviceLabel(device, t)}
        </Button>
      ))}
    </span>
  );
}

function LocalePicker({
  selected,
  onToggle,
  disabled,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {CONTENT_LANGUAGES.map((language) => {
        const on = selected.includes(language.code);
        return (
          <Button
            key={language.code}
            type="button"
            size="sm"
            variant={on ? "default" : "outline"}
            className="h-8 rounded-md px-3 text-footnote"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(language.code)}
          >
            {language.name}
          </Button>
        );
      })}
    </span>
  );
}

function formatUpdatedAt(updatedAt: number, t: T): string {
  if (!updatedAt) return t("home.updatedNow");
  const seconds = Math.max(0, (Date.now() - updatedAt) / 1000);
  if (seconds < 60) return t("home.updatedNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("home.updatedMinutes", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("home.updatedHours", { hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("home.updatedDays", { days });
  return new Date(updatedAt).toLocaleDateString();
}

function chatId() {
  return `home_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
