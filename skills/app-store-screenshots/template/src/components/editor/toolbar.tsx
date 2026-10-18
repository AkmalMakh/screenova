"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Cloud,
  Command,
  Download,
  FileText,
  Home,
  Languages,
  MoreHorizontal,
  RotateCcw,
  UnfoldHorizontal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AccountButton } from "@/components/auth/account-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supportsLandscape } from "@/lib/constants";
import { detectPlatform } from "@/lib/defaults";
import type { Device, Orientation, ProjectMeta } from "@/lib/types";
import { deviceLabel, UI_LANGUAGES, useT, type UiLang } from "@/lib/ui-i18n";
import { formatUpdatedAt } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { ProjectSwitcher } from "./project-switcher";

type Props = {
  projects: ProjectMeta[];
  activeProjectId: string | null;
  onSwitchProject: (id: string) => void;
  onCreateProject: () => void;
  onOpenPalette: () => void;
  onRenameProject: (id: string, name: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  appName: string;
  setAppName: (v: string) => void;
  connectedCanvas: boolean;
  setConnectedCanvas: (v: boolean) => void;
  locale: string;
  setLocale: (v: string) => void;
  locales: string[];
  device: Device;
  setDevice: (v: Device) => void;
  orientation: Orientation;
  setOrientation: (v: Orientation) => void;
  onExport: () => void;
  /** The deck's current copy, one "Headline | Subheader" row per screen. */
  bulkCopyText: string;
  onBulkCopy: (input: string) => { applied: number; total: number };
  onResetAll: () => void;
  onResetDevice: () => void;
  exporting: string | null;
  savedAt: number | null;
  saveError: string | null;
  busy: boolean;
};

export function Toolbar(props: Props) {
  const { t, lang, setLang } = useT();
  const router = useRouter();
  const platform = detectPlatform(props.device);
  const hasLandscape = supportsLandscape(props.device);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [bulkInput, setBulkInput] = React.useState("");
  const [bulkResult, setBulkResult] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Track last device per platform so iOS/Android tabs preserve user's choice.
  const lastByPlatform = React.useRef<{ ios: Device; android: Device }>({
    ios: platform === "ios" ? props.device : "iphone",
    android: platform === "android" ? props.device : "android",
  });
  React.useEffect(() => {
    lastByPlatform.current[platform] = props.device;
  }, [platform, props.device]);

  const showLocale = props.locales.length > 1;

  const deviceName = deviceLabel(props.device, t);

  const exportLabel = props.exporting
    ? t("toolbar.exporting", { progress: props.exporting })
    : t("toolbar.exportBundle");

  // One row on tablet and desktop that never wraps: where you are (left),
  // what you are designing (middle, scrolls if it must), status and actions
  // (right). Phones get a deliberate second row for the design controls.
  return (
    <header className="glass sticky top-0 z-40 flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/70 px-3 py-2 sm:flex-nowrap sm:px-4">
      <div className="flex shrink-0 items-center gap-1">
        <AccountButton />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/studio")}
          title={t("toolbar.home")}
          aria-label={t("toolbar.home")}
          disabled={props.busy}
        >
          <Home className="h-4 w-4" />
        </Button>
        <ProjectSwitcher
          projects={props.projects}
          activeId={props.activeProjectId}
          disabled={props.busy}
          onSwitch={props.onSwitchProject}
          onCreate={props.onCreateProject}
          onRename={props.onRenameProject}
          onDuplicate={props.onDuplicateProject}
          onDelete={props.onDeleteProject}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 text-muted-foreground sm:inline-flex"
          onClick={props.onOpenPalette}
          title={`${t("toolbar.commands")} · ⌘K`}
          aria-label={t("toolbar.commands")}
          disabled={props.busy}
        >
          <Command className="h-4 w-4" />
        </Button>
      </div>

      <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block" />

      <ScrollStrip className="order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
        <Input
          value={props.appName}
          onChange={(e) => props.setAppName(e.target.value)}
          className="h-8 w-32 border-dashed font-semibold hover:border-input focus-visible:border-solid xl:w-40"
          placeholder={t("toolbar.appName")}
          aria-label={t("toolbar.appName")}
          title={t("toolbar.appNameHint")}
          disabled={props.busy}
        />

        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        <Tabs
          value={platform}
          onValueChange={(p) => {
            if (props.busy) return;
            const next = p === "ios" ? lastByPlatform.current.ios : lastByPlatform.current.android;
            props.setDevice(next);
          }}
        >
          <TabsList className="h-8 p-0.5">
            {/* iOS / Android are product names — not translated. */}
            <TabsTrigger value="ios" className="h-7 px-3 text-footnote" disabled={props.busy}>
              iOS
            </TabsTrigger>
            <TabsTrigger value="android" className="h-7 px-3 text-footnote" disabled={props.busy}>
              Android
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={props.device}
          onValueChange={(v) => props.setDevice(v as Device)}
          disabled={props.busy}
        >
          <SelectTrigger className="h-8 w-36 text-footnote xl:w-44">
            <SelectValue placeholder={t("toolbar.devicePlaceholder")}>{deviceName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {platform === "ios" ? (
              <>
                <SelectItem value="iphone">{deviceLabel("iphone", t)}</SelectItem>
                <SelectItem value="ipad">{deviceLabel("ipad", t)}</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="android">{deviceLabel("android", t)}</SelectItem>
                <SelectItem value="android-7">{deviceLabel("android-7", t)}</SelectItem>
                <SelectItem value="android-10">{deviceLabel("android-10", t)}</SelectItem>
                <SelectItem value="feature-graphic">
                  {deviceLabel("feature-graphic", t)}
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        {hasLandscape && (
          <Select
            value={props.orientation}
            onValueChange={(v) => props.setOrientation(v as Orientation)}
            disabled={props.busy}
          >
            <SelectTrigger className="h-8 w-32 text-footnote">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">{t("toolbar.portrait")}</SelectItem>
              <SelectItem value="landscape">{t("toolbar.landscape")}</SelectItem>
            </SelectContent>
          </Select>
        )}

        {showLocale && (
          <Select value={props.locale} onValueChange={props.setLocale} disabled={props.busy}>
            <SelectTrigger className="h-8 w-20 text-footnote">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.locales.map((l) => (
                <SelectItem key={l} value={l}>
                  {l.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          variant={props.connectedCanvas ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          onClick={() => props.setConnectedCanvas(!props.connectedCanvas)}
          aria-pressed={props.connectedCanvas}
          title={
            props.connectedCanvas ? t("toolbar.connectedOn") : t("toolbar.connectedOff")
          }
          disabled={props.busy}
        >
          <UnfoldHorizontal className="h-3.5 w-3.5" />
          {props.connectedCanvas ? t("toolbar.connected") : t("toolbar.isolated")}
        </Button>
      </ScrollStrip>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <SaveStatus savedAt={props.savedAt} saveError={props.saveError} />
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2"
          onClick={() => {
            setBulkResult(null);
            setBulkInput(props.bulkCopyText);
            setCopyOpen(true);
          }}
          title={t("toolbar.bulkCopyHint")}
          aria-label={t("toolbar.copy")}
          disabled={props.busy}
        >
          <FileText className="h-4 w-4" />
          <span className="hidden xl:inline">{t("toolbar.copy")}</span>
        </Button>
        <ThemeToggle className="h-8 w-8" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t("toolbar.more")}
              aria-label={t("toolbar.more")}
              disabled={props.busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                {t("toolbar.interfaceLanguage")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as UiLang)}>
                  {UI_LANGUAGES.map((l) => (
                    <DropdownMenuRadioItem key={l.code} value={l.code}>
                      {l.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setResetOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("toolbar.resetHint")}…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          onClick={props.onExport}
          disabled={props.busy}
          size="sm"
          className="ml-1 h-8 gap-1.5 px-2.5 sm:px-3"
          title={t("toolbar.exportHint")}
          aria-label={exportLabel}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{exportLabel}</span>
        </Button>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("toolbar.resetTitle")}</DialogTitle>
            <DialogDescription>
              {t("toolbar.resetDescriptionBefore")}
              <span className="font-medium">{deviceName}</span>
              {t("toolbar.resetDescriptionAfter")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              {t("toolbar.cancel")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResetOpen(false);
                props.onResetDevice();
              }}
            >
              {t("toolbar.resetDeviceOnly", { device: deviceName })}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setResetOpen(false);
                props.onResetAll();
              }}
            >
              {t("toolbar.resetAllDevices")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("toolbar.bulkTitle")}</DialogTitle>
            <DialogDescription>
              {t("toolbar.bulkDescription", { locale: props.locale.toUpperCase() })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={bulkInput}
              onChange={(e) => {
                setBulkInput(e.target.value);
                setBulkResult(null);
              }}
              rows={Math.min(14, Math.max(6, props.bulkCopyText.split("\n").length + 1))}
              placeholder={t("toolbar.bulkPlaceholder")}
              aria-label={t("toolbar.bulkTitle")}
              spellCheck
              className="leading-relaxed"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                if (file) {
                  setBulkInput(await file.text());
                  setBulkResult(null);
                }
                e.currentTarget.value = "";
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {t("toolbar.loadFile")}
              </Button>
              <div className="flex items-center gap-2">
                {bulkResult ? (
                  <span className="text-xs text-muted-foreground">{bulkResult}</span>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => setCopyOpen(false)}>
                  {t("toolbar.cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={!bulkInput.trim() || props.busy}
                  onClick={() => {
                    const result = props.onBulkCopy(bulkInput);
                    setBulkResult(
                      t("toolbar.bulkResult", {
                        applied: result.applied,
                        total: result.total,
                      }),
                    );
                  }}
                >
                  {t("toolbar.apply")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

// The middle toolbar group. Never wraps: when the window is too narrow it
// scrolls sideways (vertical wheel included) and fades the clipped edge so
// it is obvious there is more.
function ScrollStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((current) =>
        current.start === start && current.end === end ? current : { start, end },
      );
    };
    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      el.scrollLeft += event.deltaY;
      event.preventDefault();
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, []);
  const mask =
    edges.start || edges.end
      ? `linear-gradient(to right, ${edges.start ? "transparent, #000 24px" : "#000"}, ${edges.end ? "#000 calc(100% - 24px), transparent" : "#000"})`
      : undefined;
  return (
    <div
      ref={ref}
      className={cn(
        "overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {/* w-max + mx-auto: centered while it fits, scrollable from the start when it does not. */}
      <div className="mx-auto flex w-max items-center gap-2 px-0.5">{children}</div>
    </div>
  );
}

function SaveStatus({ savedAt, saveError }: { savedAt: number | null; saveError: string | null }) {
  const { t } = useT();
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Fixed width and a fixed word: the relative time lives in the tooltip, so
  // the toolbar never reflows as "saved 9s ago" becomes "saved 10s ago".
  const base = "flex w-6 shrink-0 items-center justify-center gap-1.5 text-caption sm:w-auto sm:min-w-[5.5rem] sm:justify-end";
  if (saveError) {
    return (
      <span role="status" className={cn(base, "text-destructive")} title={saveError}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="sr-only sm:not-sr-only">{t("toolbar.saveFailed")}</span>
      </span>
    );
  }
  if (!savedAt) {
    return (
      <span role="status" className={cn(base, "text-muted-foreground")}>
        <Cloud className="h-3.5 w-3.5 shrink-0" />
        <span className="sr-only sm:not-sr-only">{t("toolbar.notSavedYet")}</span>
      </span>
    );
  }
  const when = `${t("toolbar.saved")} · ${formatUpdatedAt(savedAt, t)}`;
  return (
    <span role="status" className={cn(base, "text-muted-foreground")} title={when}>
      {/* Keyed on the save time: the check pops once per real save. */}
      <Check
        key={savedAt}
        className="h-3.5 w-3.5 shrink-0 text-success duration-medium animate-in fade-in-0 zoom-in-50"
      />
      <span className="sr-only sm:not-sr-only">{t("toolbar.saved")}</span>
    </span>
  );
}
