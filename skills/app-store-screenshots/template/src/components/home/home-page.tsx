"use client";
import { apiFetch } from "@/lib/account-scope";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Menu,
  Plus,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  StudioComposer,
  StudioSidebar,
  STUDIO_TEMPLATES,
  type ComposerReference,
} from "@/components/home/studio-shell";
import { fileToDataUrl, uploadImage } from "@/components/editor/screenshot-picker";
import type { AppStoreLookupResult } from "@/lib/app-store";
import {
  MAX_REFERENCE_SCREENSHOTS,
  MAX_STYLE_REFERENCES,
  themeById,
} from "@/lib/constants";
import { SlideCanvas, getCanvas } from "@/components/editor/slide-canvas";
import { buildSlidesFromAnalysis, buildSuggestedSlides, type SlideAnalysis } from "@/lib/import-slides";
import { CONTENT_LANGUAGES } from "@/lib/locale";
import { useProject } from "@/lib/storage";
import { extractReferenceLinks, normalizeReferenceUrl } from "@/lib/reference-links";
import type { DeckSuggestion } from "@/lib/suggest-deck";
import type { Device, Slide, Theme } from "@/lib/types";
import { buildTemplateSlides, type TemplateEntry } from "@/lib/studio-templates";
import { deviceLabel, LanguageProvider, useT } from "@/lib/ui-i18n";
import type { TranslationKey } from "@/lib/ui-translations/en";
import { cn } from "@/lib/utils";

type T = ReturnType<typeof useT>["t"];

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };
type Attachment = { id: string; name: string; dataUrl: string };

// A reference link plus what the App Store lookup resolved for it. Screenshot
// URLs stay here (page state) — the composer chip only shows icon + name.
type StyleReference = ComposerReference & { screenshotUrls: string[] };

type ImportResult = {
  ok: boolean;
  app: AppStoreLookupResult;
  iconPath: string;
  screenshots: Array<{ name: string; path: string }>;
};

const CHAT_DEVICES: Device[] = ["iphone", "ipad", "android"];
const IMPORT_DEVICES: Device[] = ["iphone", "ipad"];
const MAX_ATTACHMENTS = 10;
const MAX_REFERENCES = MAX_STYLE_REFERENCES;
const MAX_REFERENCE_SHOTS = MAX_REFERENCE_SCREENSHOTS;
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
  const {
    hydrated,
    projects,
    activeProjectId,
    createProject,
    switchProject,
    setState,
  } = useProject();

  // Workspace chrome: the rail is a sheet below lg, and the App Store import
  // is a disclosure rather than a permanent section competing with the composer.
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const draftRef = React.useRef<HTMLTextAreaElement>(null);

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
  const [references, setReferenceState] = React.useState<StyleReference[]>([]);
  const referencesRef = React.useRef<StyleReference[]>([]);
  const ignoredAutoReferences = React.useRef(new Set<string>());
  const referenceLookups = React.useRef(new Map<string, Promise<void>>());
  const [referenceError, setReferenceError] = React.useState<string | null>(null);
  const [deck, setDeck] = React.useState<DeckSuggestion | null>(null);
  const [deckScreenshots, setDeckScreenshots] = React.useState<Array<{ name: string; path: string }>>([]);
  const [deckAppName, setDeckAppName] = React.useState("");
  const [chatDevice, setChatDevice] = React.useState<Device>("iphone");
  const [chatLocales, setChatLocales] = React.useState<string[]>(["en"]);
  const suggestedSlides = React.useMemo(() => deck ? buildSuggestedSlides(deck.slides, deckScreenshots.map(({ path }) => path), chatLocales.length ? chatLocales : ["en"], chatDevice) : [], [deck, deckScreenshots, chatLocales, chatDevice]);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    try {
      const prompt = sessionStorage.getItem("screenova:studio-prompt");
      if (prompt) {
        changeChatDraft(prompt);
        detectDescriptionLinks(prompt, true);
        sessionStorage.removeItem("screenova:studio-prompt");
      }
    } catch { /* The composer also works without browser storage. */ }
  }, []);

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
      const response = await apiFetch("/api/app-store/lookup", {
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
    try {
      const response = await apiFetch("/api/app-store/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link.trim(), device: importDevice }),
      });
      const json = (await response.json()) as Partial<ImportResult> & { error?: string };
      if (!response.ok || !json.ok || !json.screenshots?.length) {
        throw new Error(json.error || t("home.importFailed"));
      }
      const result = json as ImportResult;
      setImporting(t("home.importingDraft"));
      const analysisResponse = await apiFetch("/api/design/analyze-screenshots", {
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
      if (!analysisResponse.ok || !analysis.ok || !analysis.slides?.length) {
        throw new Error(analysis.error || t("home.importFailed"));
      }
      const slides = buildSlidesFromAnalysis(
        analysis.slides,
        result.screenshots.map((screenshot) => screenshot.path),
        locales,
        importDevice,
      );
      createProject(result.app.trackName, locales);
      setState((prev) => ({
        ...prev,
        appName: result.app.trackName,
        appIcon: result.iconPath || prev.appIcon,
        device: importDevice,
        slidesByDevice: { ...prev.slidesByDevice, [importDevice]: slides },
      }));
      router.push("/editor");
    } catch (error) {
      // Only create the project after analysis succeeds; a failed import must
      // not change the active project or discard the user's existing work.
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

  // ---------- Style-reference links ----------

  function setReferences(updater: React.SetStateAction<StyleReference[]>) {
    const next = typeof updater === "function" ? updater(referencesRef.current) : updater;
    referencesRef.current = next;
    setReferenceState(next);
  }

  function addReferenceUrls(urls: string[]): StyleReference[] {
    const next = [...referencesRef.current];
    const added: StyleReference[] = [];
    let limitReached = false;
    for (const href of urls) {
      if (next.some((reference) => reference.url === href)) continue;
      if (next.length >= MAX_REFERENCES) { limitReached = true; continue; }
      const host = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
      const loading = host === "apps.apple.com" || host === "itunes.apple.com";
      const reference = { id: chatId(), url: href, name: host, screenshotUrls: [], loading };
      next.push(reference);
      added.push(reference);
    }
    setReferenceError(limitReached ? t("home.referenceLimit", { count: MAX_REFERENCES }) : null);
    if (added.length) setReferences(next);
    for (const reference of added) {
      if (!reference.loading) continue;
      const lookup = resolveReference(reference.id, reference.url);
      referenceLookups.current.set(reference.id, lookup);
      void lookup.then(() => referenceLookups.current.delete(reference.id));
    }
    return next;
  }

  function detectDescriptionLinks(text: string, complete: boolean) {
    if (chatLoading) return;
    const urls = extractReferenceLinks(text, complete)
      .filter((url) => !ignoredAutoReferences.current.has(url));
    if (urls.length) addReferenceUrls(urls);
  }

  function changeChatDraft(text: string, complete = false) {
    setChatDraft(text);
    const present = new Set(extractReferenceLinks(text));
    for (const url of ignoredAutoReferences.current) {
      if (!present.has(url)) ignoredAutoReferences.current.delete(url);
    }
    detectDescriptionLinks(text, complete);
  }

  // Returns whether the link was accepted, so the composer knows to clear its
  // input. App Store links resolve to icon + screenshots in the background;
  // anything else stays a plain named URL the model gets as text.
  function addReference(raw: string): boolean {
    if (!raw.trim() || chatLoading) return false;
    const href = normalizeReferenceUrl(raw);
    if (!href) {
      setReferenceError(t("home.referenceInvalid"));
      return false;
    }
    ignoredAutoReferences.current.delete(href);
    return addReferenceUrls([href]).some((reference) => reference.url === href);
  }

  async function resolveReference(id: string, href: string) {
    try {
      const response = await apiFetch("/api/app-store/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: href }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        app?: AppStoreLookupResult;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.app) {
        throw new Error(json.error || t("home.referenceFailed"));
      }
      const app = json.app;
      const shots = app.screenshotUrls.length ? app.screenshotUrls : app.ipadScreenshotUrls;
      setReferences((current) =>
        current.map((reference) =>
          reference.id === id
            ? {
                ...reference,
                name: app.trackName,
                iconUrl: app.artworkUrl100 || undefined,
                screenshotUrls: shots.slice(0, MAX_REFERENCE_SHOTS),
                loading: false,
              }
            : reference,
        ),
      );
    } catch (error) {
      // Keep the chip as a plain link reference — the URL still informs the model.
      setReferences((current) =>
        current.map((reference) =>
          reference.id === id ? { ...reference, loading: false } : reference,
        ),
      );
      if (referencesRef.current.some((reference) => reference.id === id)) {
        setReferenceError(error instanceof Error ? error.message : t("home.referenceFailed"));
      }
    }
  }

  function removeReference(id: string) {
    const reference = referencesRef.current.find((entry) => entry.id === id);
    if (reference) ignoredAutoReferences.current.add(reference.url);
    setReferences((current) => current.filter((reference) => reference.id !== id));
    setReferenceError(null);
  }

  async function submitChat(text: string) {
    const value = text.trim();
    if (!value || chatLoading) return;
    detectDescriptionLinks(value, true);
    setChatDraft("");
    setAttachError(null);
    const userMessage: ChatMessage = { id: chatId(), role: "user", text: value };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatLoading(true);
    try {
      // An immediate Send must include the resolved App Store screenshots,
      // not just an unresolved URL chip from a paste moments earlier.
      await Promise.all([...referenceLookups.current.values()]);
      const styleReferences = referencesRef.current;
      // Upload the attached screenshots first so the model can see them.
      const screenshots = [...deckScreenshots];
      if (screenshots.length + attachments.length > MAX_ATTACHMENTS) {
        throw new Error(t("home.attachTooMany", { count: MAX_ATTACHMENTS }));
      }
      for (const attachment of attachments) {
        const { path: uploaded, error: uploadError } = await uploadImage(attachment.dataUrl);
        if (!uploaded) {
          throw new Error(uploadError ?? t("home.uploadFailed", { name: attachment.name }));
        }
        screenshots.push({ name: attachment.name, path: uploaded });
      }
      const response = await apiFetch("/api/design/suggest-deck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-12).map(({ role, text: messageText }) => ({ role, text: messageText })),
          locales: chatLocales,
          device: chatDevice,
          // Deliberately unset: the route derives the count from the reference
          // deck's screen count and the attached screenshots. Sending a fixed
          // number here is what pinned every deck to 5 screens.
          screenshots: screenshots.length ? screenshots : undefined,
          styleReferences: styleReferences.length
            ? styleReferences.map(({ name, url, screenshotUrls }) => ({
                name,
                url,
                ...(screenshotUrls.length ? { screenshotUrls } : {}),
              }))
            : undefined,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; deck?: DeckSuggestion; error?: string };
      if (!response.ok || !json.ok || !json.deck?.slides?.length) {
        throw new Error(json.error || t("home.chatFailed"));
      }
      setDeck(json.deck);
      setDeckScreenshots(screenshots);
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
    const slides = suggestedSlides;
    createProject(deckAppName.trim(), locales);
    setState((prev) => ({
      ...prev,
      appName: deckAppName.trim(),
      connectedCanvas: false,
      locale: DECK_LOCALE(deck, locales),
      themeId: deck.themeId,
      // The AI palette wins over the built-in fallback — same mechanism the
      // editor's design proposals use (customThemesByDevice beats themeId).
      ...(deck.customTheme
        ? {
            customThemesByDevice: {
              ...(prev.customThemesByDevice || {}),
              [chatDevice]: { ...deck.customTheme, id: `ai-custom-${chatDevice}` },
            },
          }
        : {}),
      device: chatDevice,
      slidesByDevice: { ...prev.slidesByDevice, [chatDevice]: slides },
    }));
    router.push("/editor");
  }

  function openProject(id: string) {
    switchProject(id);
    router.push("/editor");
  }

  // Locale toggles keep at least one language selected — an empty set would
  // produce a deck with no copy.
  function toggleLocale(code: string, current: string[]): string[] {
    if (!current.includes(code)) return [...current, code];
    return current.length === 1 ? current : current.filter((entry) => entry !== code);
  }

  function toggleChatLocale(code: string) {
    setChatLocales((current) => toggleLocale(code, current));
  }

  function toggleImportLocale(code: string) {
    setImportLocales((current) => toggleLocale(code, current));
  }

  function startBlank() {
    createProject();
    router.push("/editor");
  }

  function startTemplate(template: TemplateEntry) {
    const locales = chatLocales.length ? chatLocales : ["en"];
    const slides = buildTemplateSlides(template, locales);
    createProject(template.name, locales);
    setState((prev) => ({
      ...prev,
      device: chatDevice,
      themeId: template.themeId,
      slidesByDevice: { ...prev.slidesByDevice, [chatDevice]: slides },
    }));
    router.push("/editor");
  }

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm">{t("home.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Persistent workspace rail. Hidden below lg, where it becomes a sheet. */}
      <aside className="hidden w-[224px] shrink-0 border-r border-border/70 lg:block">
        <StudioSidebar
          projects={projects}
          activeId={activeProjectId}
          onOpenProject={openProject}
          onNewDeck={startBlank}
          onOpenTemplate={startTemplate}
          formatUpdatedAt={formatUpdatedAt}
        />
      </aside>

      <DialogPrimitive.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
          <DialogPrimitive.Content onCloseAutoFocus={(event) => { event.preventDefault(); menuButtonRef.current?.focus(); }} aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-border/70 bg-card pt-8 shadow-pop">
            <DialogPrimitive.Title className="sr-only">{t("home.openMenu")}</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label={t("home.closeMenu")} className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-sm hover:bg-muted"><X className="h-4 w-4" /></DialogPrimitive.Close>
            <StudioSidebar
              projects={projects}
              activeId={activeProjectId}
              onOpenProject={(id) => {
                setSidebarOpen(false);
                openProject(id);
              }}
              onNewDeck={() => { setSidebarOpen(false); startBlank(); }}
              onOpenTemplate={(template) => { setSidebarOpen(false); startTemplate(template); }}
              formatUpdatedAt={formatUpdatedAt}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 bg-card shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-sm lg:hidden"
              ref={menuButtonRef}
              onClick={() => setSidebarOpen(true)}
              aria-label={t("home.openMenu")}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span className="truncate text-footnote font-semibold tracking-tight lg:hidden">
              {t("home.brand")}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 rounded-sm px-3 text-footnote font-medium"
              onClick={() => setImportOpen((value) => !value)}
              aria-expanded={importOpen}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("home.importCta")}</span>
              <span className="sm:hidden">{t("home.fetch")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 rounded-sm px-3 text-footnote font-medium"
              onClick={startBlank}
              aria-label={t("home.blankCardTitle")}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("home.blankCardTitle")}</span>
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
            <h1 className="text-title1 font-semibold tracking-tight sm:text-[34px] sm:leading-[1.15]">
              {t("home.welcome")}
            </h1>
            <p className="mt-3 max-w-2xl text-body text-muted-foreground">{t("home.subtitle")}</p>

            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
            <div>
              <StudioComposer
                draft={chatDraft}
                onDraftChange={changeChatDraft}
                onDetectReferenceLinks={detectDescriptionLinks}
                onSubmit={(text) => void submitChat(text)}
                loading={chatLoading}
                draftRef={draftRef}
                attachments={attachments}
                attachError={attachError}
                onAttachClick={() => fileRef.current?.click()}
                onRemoveAttachment={removeAttachment}
                device={chatDevice}
                onDeviceChange={setChatDevice}
                deviceOptions={CHAT_DEVICES}
                locales={chatLocales}
                onToggleLocale={toggleChatLocale}
                references={references}
                referenceError={referenceError}
                onAddReference={addReference}
                onRemoveReference={removeReference}
              />
              <input
                ref={fileRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                hidden
                disabled={chatLoading}
                onChange={(event) => {
                  void addFiles(event.currentTarget.files);
                }}
              />
            </div>

            {chatMessages.length === 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTION_CHIPS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="rounded-sm border border-border/80 bg-card px-3 py-2 text-footnote text-muted-foreground transition-colors duration-150 ease-out hover:border-border hover:text-foreground"
                    onClick={() => void submitChat(t(key))}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            ) : (
              <div ref={chatScrollRef} className="mt-6 space-y-3">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-line rounded-lg px-3.5 py-2 text-subhead leading-relaxed",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("home.chatThinking")}
                  </div>
                )}
              </div>
            )}

            </div>
            <aside className="hidden overflow-hidden rounded-lg border border-border bg-card xl:block" aria-label={t("home.inspiration")}>
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <span className="text-footnote font-medium">{STUDIO_TEMPLATES[0].name}</span>
                <button type="button" className="rounded-sm px-3 text-footnote text-primary" onClick={() => startTemplate(STUDIO_TEMPLATES[0])} aria-label={STUDIO_TEMPLATES[0].name}><ArrowRight className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-muted p-4">
                {["01-hero", "02-split-landscape", "03-device-bottom"].map((name, index) => <img key={name} src={`/deck/${name}.webp`} alt={`${STUDIO_TEMPLATES[0].name} ${index + 1}`} className="h-auto w-full rounded-xs" />)}
              </div>
              <p className="p-4 text-caption text-muted-foreground">{t("home.slideCount", { count: STUDIO_TEMPLATES[0].slides })}</p>
            </aside>
            </div>
            {importOpen && (
              <section className="mt-8" aria-label={t("home.linkSectionTitle")}>
                <h2 className="mb-3 text-title3 font-semibold tracking-tight">
                  {t("home.linkSectionTitle")}
                </h2>
                <div className="rounded-lg border border-border/80 bg-card p-4 shadow-card">
                  {!lookupApp ? (
                    <form onSubmit={submitLookup} className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={link}
                          onChange={(event) => setLink(event.target.value)}
                          placeholder={t("home.linkPlaceholder")}
                          className="h-10 min-w-0 flex-1 rounded-sm text-subhead"
                          aria-label={t("home.linkLabel")}
                          disabled={linkLoading}
                        />
                        <Button
                          type="submit"
                          className="h-10 shrink-0 rounded-sm px-4 text-footnote font-medium"
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
                      {linkError && <p className="text-caption text-destructive">{linkError}</p>}
                    </form>
                  ) : (
                    <LookupResult
                      app={lookupApp}
                      device={importDevice}
                      onDeviceChange={setImportDevice}
                      locales={importLocales}
                      onToggleLocale={toggleImportLocale}
                      importing={importing}
                      importError={importError}
                      onImport={() => void importApp()}
                      onReset={resetLookup}
                    />
                  )}
                </div>
              </section>
            )}

            {deck && (
              <div className="mt-8">
                <DeckPreview
                  deck={deck}
                  slides={suggestedSlides}
                  appName={deckAppName}
                  onAppNameChange={setDeckAppName}
                  device={chatDevice}
                  onDeviceChange={setChatDevice}
                  locales={chatLocales}
                  onToggleLocale={toggleChatLocale}
                  loading={chatLoading}
                  onOpenEditor={openDeckInEditor}
                />
              </div>
            )}

            {projects.length > 0 && (
              <section className="mt-10" aria-label={t("home.recentTitle")}>
                <h2 className="mb-4 text-title2 font-semibold tracking-tight">{t("home.recentTitle")}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {projects.slice(0, 6).map((project) => (
                    <button key={project.id} type="button" onClick={() => openProject(project.id)}
                      className="flex min-h-24 items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/50">
                      <span className="min-w-0"><span className="block truncate text-title3 font-semibold">{project.name}</span>
                        <span className="mt-1 block text-caption text-muted-foreground">{formatUpdatedAt(project.updatedAt, t)}</span></span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className="mt-10" aria-label={t("home.inspiration")}>
              <h2 className="mb-3 text-title3 font-semibold tracking-tight">
                {t("home.inspiration")}
              </h2>
              <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
                {STUDIO_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => startTemplate(tpl)}
                    className="lift-hover group w-[168px] shrink-0 snap-start overflow-hidden rounded-lg border border-border/80 bg-card text-left shadow-card"
                  >
                    <img
                      src={tpl.thumb}
                      alt=""
                      loading="lazy"
                      className="aspect-[9/19] w-full object-cover"
                    />
                    <span className="block px-3 py-2.5">
                      <span className="block truncate text-footnote font-medium">{tpl.name}</span>
                      <span className="block truncate text-caption text-muted-foreground">
                        {t("home.slideCount", { count: tpl.slides })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------- Deck preview ----------

function DeckPreview({
  deck,
  slides,
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
  slides: Slide[];
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
  const theme = deck.customTheme ?? themeById(deck.themeId);

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
        {slides.map((slide, index) => (
          <div
            key={index}
            className="fade-up"
            style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
          >
            <DeckSlideCard
              slide={slide}
              locale={DECK_LOCALE(deck, locales)}
              theme={theme}
              appName={appName}
              device={device}
            />
          </div>
        ))}
      </div>

      <section
        aria-label={t("home.openEditor")}
        className="overflow-hidden rounded-lg border border-border bg-card shadow-card"
      >
        <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
          <div className="space-y-2">
            <Label htmlFor="deck-app-name" className="block text-footnote font-medium">
              {t("home.appNameLabel")}
            </Label>
            <Input
              id="deck-app-name"
              value={appName}
              onChange={(event) => onAppNameChange(event.target.value)}
              maxLength={60}
              className="h-10 rounded-sm text-base"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <span id="deck-device-label" className="block text-footnote font-medium">
              {t("home.device")}
            </span>
            <DevicePicker
              value={device}
              options={CHAT_DEVICES}
              onChange={onDeviceChange}
              disabled={loading}
              labelledBy="deck-device-label"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-baseline justify-between gap-3">
              <span id="deck-languages-label" className="block text-footnote font-medium">
                {t("home.languages")}
              </span>
              <span className="text-caption tabular-nums text-muted-foreground">
                {locales.length}/{CONTENT_LANGUAGES.length}
              </span>
            </div>
            <LocalePicker
              selected={locales}
              onToggle={onToggleLocale}
              disabled={loading}
              labelledBy="deck-languages-label"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border bg-background/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-muted-foreground">{t("home.languagesHint")}</p>
          <Button
            type="button"
            className="h-10 shrink-0 gap-2 rounded-sm px-5"
            onClick={onOpenEditor}
            disabled={loading || !appName.trim()}
          >
            {t("home.openEditor")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </section>
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
            className="h-14 w-14 shrink-0 rounded-lg border bg-muted object-cover"
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
                className="aspect-[9/19] w-full rounded-sm border bg-muted object-cover"
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

function DeckSlideCard({ slide, locale, theme, appName, device }: {
  slide: Slide; locale: string; theme: Theme; appName: string; device: Device;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const { cW, cH } = getCanvas(device, "portrait");
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} data-suggestion-slide={slide.id}
      className="relative overflow-hidden rounded-lg ring-1 ring-border/70"
      style={{ aspectRatio: `${cW} / ${cH}` }}>
      <div style={{ width: cW, height: cH, transform: `scale(${width / cW})`, transformOrigin: "top left" }}>
        <SlideCanvas slide={slide} device={device} orientation="portrait" theme={theme}
          locale={locale} appName={appName} hideEmpty />
      </div>
    </div>
  );
}

function DevicePicker({
  value,
  options,
  onChange,
  disabled,
  labelledBy,
}: {
  value: Device;
  options: Device[];
  onChange: (device: Device) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const { t } = useT();
  // One choice from a few: a segmented control, not a row of primary buttons
  // (DESIGN.md: one blue primary action per surface).
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="inline-flex h-10 items-center gap-0.5 rounded-sm bg-muted p-0.5"
    >
      {options.map((device) => {
        const on = value === device;
        return (
          <button
            key={device}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(device)}
            className={cn(
              "h-full whitespace-nowrap rounded-xs px-3.5 text-footnote font-medium transition-[background-color,color,box-shadow] duration-micro ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              on
                ? "bg-card text-foreground shadow-[0_1px_2px_hsl(240_10%_8%/0.12)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {deviceLabel(device, t)}
          </button>
        );
      })}
    </div>
  );
}

function LocalePicker({
  selected,
  onToggle,
  disabled,
  labelledBy,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  // Several choices: toggle chips on the soft selected surface, with a check
  // so the state never rests on color alone.
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {CONTENT_LANGUAGES.map((language) => {
        const on = selected.includes(language.code);
        return (
          <button
            key={language.code}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(language.code)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-xs border px-3 text-footnote font-medium transition-[background-color,border-color,color] duration-micro ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              on
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-foreground/25",
            )}
          >
            {on && <Check className="h-3.5 w-3.5" aria-hidden />}
            {language.name}
          </button>
        );
      })}
    </div>
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
