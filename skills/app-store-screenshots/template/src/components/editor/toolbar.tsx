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
  RotateCcw,
  UnfoldHorizontal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  return (
    <div className="glass sticky top-0 z-40 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border/70 px-4 py-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => router.push("/")}
        title={t("toolbar.home")}
        aria-label={t("toolbar.home")}
        disabled={props.busy}
      >
        <Home className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs text-muted-foreground"
        onClick={props.onOpenPalette}
        title={t("toolbar.commands")}
        aria-label={t("toolbar.commands")}
        disabled={props.busy}
      >
        <Command className="h-3.5 w-3.5" />
        K
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

      <span aria-hidden className="mx-1 h-5 w-px bg-border" />

      <Input
        value={props.appName}
        onChange={(e) => props.setAppName(e.target.value)}
        className="h-8 w-40 border-dashed text-sm font-semibold focus-visible:border-input focus-visible:border-solid focus-visible:bg-background"
        placeholder={t("toolbar.appName")}
        aria-label={t("toolbar.appName")}
        title={t("toolbar.appNameHint")}
        disabled={props.busy}
      />

      <span aria-hidden className="mx-1 h-5 w-px bg-border" />

      <Button
        type="button"
        variant={props.connectedCanvas ? "secondary" : "outline"}
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
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

      <span aria-hidden className="mx-1 h-5 w-px bg-border" />

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
          <TabsTrigger value="ios" className="h-7 px-3 text-xs" disabled={props.busy}>
            iOS
          </TabsTrigger>
          <TabsTrigger value="android" className="h-7 px-3 text-xs" disabled={props.busy}>
            Android
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Select
        value={props.device}
        onValueChange={(v) => props.setDevice(v as Device)}
        disabled={props.busy}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
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
          <SelectTrigger className="h-8 w-32 text-xs">
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
          <SelectTrigger className="h-8 w-20 text-xs">
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

      {/* UI language (editor chrome) — separate from the content locale above. */}
      <Select
        value={lang}
        onValueChange={(v) => setLang(v as UiLang)}
        disabled={props.busy}
      >
        <SelectTrigger
          className="h-8 w-32 gap-1 text-xs"
          aria-label={t("toolbar.interfaceLanguage")}
          title={t("toolbar.interfaceLanguage")}
        >
          <Languages className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UI_LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SaveStatus savedAt={props.savedAt} saveError={props.saveError} />
        <span aria-hidden className="h-5 w-px bg-border" />
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            setBulkResult(null);
            setCopyOpen(true);
          }}
          title={t("toolbar.bulkCopyHint")}
          disabled={props.busy}
        >
          <FileText className="h-4 w-4" />
          {t("toolbar.copy")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setResetOpen(true)}
          title={t("toolbar.resetHint")}
          aria-label={t("toolbar.reset")}
          disabled={props.busy}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          onClick={props.onExport}
          disabled={!!props.exporting}
          size="sm"
          className="h-8"
          title={t("toolbar.exportHint")}
        >
          <Download className="h-4 w-4" />
          {props.exporting
            ? t("toolbar.exporting", { progress: props.exporting })
            : t("toolbar.exportBundle")}
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
              rows={12}
              // Example CONTENT (brand copy) — intentionally not translated.
              placeholder={"Header | Subheader\nJust say it. It files itself. | Speak once - MoteCalendar sorts it into the right calendar\nOne sentence. Five outcomes. | Tasks, expenses, diary, cycle, shifts - detected automatically"}
              className="font-mono text-xs"
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
    </div>
  );
}

function SaveStatus({ savedAt, saveError }: { savedAt: number | null; saveError: string | null }) {
  const { t } = useT();
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (saveError) {
    return (
      <span
        className="flex items-center gap-1 text-xs text-destructive"
        title={saveError}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> {t("toolbar.saveFailed")}
      </span>
    );
  }

  if (!savedAt) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Cloud className="h-3.5 w-3.5" /> {t("toolbar.notSavedYet")}
      </span>
    );
  }
  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  const label =
    seconds < 5
      ? t("toolbar.saved")
      : seconds < 60
        ? t("toolbar.savedSeconds", { seconds })
        : seconds < 3600
          ? t("toolbar.savedMinutes", { minutes: Math.round(seconds / 60) })
          : t("toolbar.savedHours", { hours: Math.round(seconds / 3600) });
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-green-500" /> {label}
    </span>
  );
}
