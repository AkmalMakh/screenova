"use client";
import { accountScope } from "@/lib/account-scope";
import { uploadDataUrl } from "@/lib/upload-client";
export { uploadDataUrl } from "@/lib/upload-client";
import * as React from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { didFail, img, setImage } from "@/lib/image-cache";
import { resolveScreenshot } from "@/lib/locale";
import { localizedUpload } from "@/lib/localized-upload";
import { useT } from "@/lib/ui-i18n";

type Props = {
  label: string;
  value: string;
  locale?: string;
  locales?: string[];
  localizedSlug?: string;
  onChange: (v: string) => void;
};

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ScreenshotPicker({ label, value, locale, locales = [], localizedSlug, onChange }: Props) {
  const { t } = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    setError(null);
  }, [value, locale]);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError(t("picker.formatError"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(t("picker.tooLarge"));
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await fileToDataUrl(file);
    } catch {
      setError(t("picker.readFailed"));
      return;
    }
    // Try to persist to disk so the screenshot survives a git clone.
    // If the upload endpoint is unreachable (e.g. static export), fall back
    // to the inline data URI — still works in the current session.
    setUploading(true);
    const { pattern: localizedPattern, options } = localizedUpload(value, locale, locales, localizedSlug);
    const uploadedPath = await uploadDataUrl(dataUrl, options);
    setUploading(false);
    if (uploadedPath) {
      const savedPattern = uploadedPath.startsWith("/api/assets/") && localizedPattern && locale
        ? uploadedPath.replace(`/localized/${locale}/`, "/localized/{locale}/")
        : localizedPattern || uploadedPath;
      setImage(resolveScreenshot(savedPattern, locale || "en"), dataUrl);
      onChange(savedPattern);
    } else {
      if (accountScope()) {
        setError("Image was not saved to your account. Please try again.");
        return;
      }
      setImage(dataUrl, dataUrl);
      onChange(dataUrl);
    }
  }

  const hasValue = !!value;
  const isData = hasValue && value.startsWith("data:");
  const resolvedValue = hasValue && !isData && locale ? resolveScreenshot(value, locale) : value;
  const previewSrc = isData ? value : hasValue ? img(resolvedValue) : "";
  // Only flag "image not found" when the path is a real URL that we tried and failed.
  const knownMissing = hasValue && !isData && didFail(resolvedValue);
  const valueLabel = uploading
    ? t("picker.saving")
    : !hasValue
      ? t("picker.dropOrPick")
      : isData
        ? t("picker.uploadedNotOnDisk")
        : value.replace(/^.*\/(?=[^/]+\/[^/]+$)/, "…/");

  return (
    <div className="space-y-1">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-sm border p-2 transition-colors ${
          dragging ? "border-primary bg-accent ring-2 ring-primary/30" : "border-input"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) await handleFile(file);
        }}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-muted">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
              onError={() => setError(t("picker.loadFailed"))}
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium">{label}</span>
          <span className="truncate text-xs text-muted-foreground">
            {dragging ? t("picker.dropToUpload") : valueLabel}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={label}
          disabled={uploading}
          className="hidden"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (file) await handleFile(file);
            input.value = "";
          }}
        />
        <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 min-w-0 flex-1"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("picker.pick")}
        </Button>
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              onChange("");
              setError(null);
            }}
            aria-label={t("picker.clearScreenshot")}
            title={t("picker.clear")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        </div>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : knownMissing ? (
        <p className="text-xs text-destructive">
          {t("picker.imageNotFound", { path: resolvedValue })}
        </p>
      ) : null}
    </div>
  );
}
