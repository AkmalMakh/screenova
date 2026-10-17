"use client";
import * as React from "react";
import { Image as ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTENT_LANGUAGES } from "@/lib/locale";
import { useT } from "@/lib/ui-i18n";

const MAX_FILES = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const ACCEPT_ATTR = "image/png,image/jpeg,image/webp";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Progress label while screenshots are uploading/analyzing; null when idle.
  importing: string | null;
  onSubmit: (name: string, files: File[], locales: string[]) => void;
};

export function NewProjectDialog({ open, onOpenChange, importing, onSubmit }: Props) {
  const { t, lang } = useT();
  // Default NAME is user data (becomes the persisted project name) — not translated.
  const [name, setName] = React.useState("New project");
  const [files, setFiles] = React.useState<File[]>([]);
  const [urls, setUrls] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedLocales, setSelectedLocales] = React.useState<string[]>(["en"]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Mirror of urls so close/unmount cleanups never read stale arrays.
  const urlsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  // Reset everything when the dialog closes. On open, preselect the current UI
  // language plus English.
  React.useEffect(() => {
    if (open) {
      setSelectedLocales(lang === "en" ? ["en"] : [lang, "en"]);
      return;
    }
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
    setUrls([]);
    setFiles([]);
    setError(null);
    setName("New project");
  }, [open, lang]);

  // Revoke all preview URLs on unmount.
  React.useEffect(() => {
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  function addFiles(next: FileList | null) {
    if (!next || importing) return;
    setError(null);
    const added: File[] = [];
    const addedUrls: string[] = [];
    for (const file of Array.from(next)) {
      if (files.length + added.length >= MAX_FILES) {
        setError(t("newProject.maxFilesError", { count: MAX_FILES }));
        break;
      }
      if (!ACCEPTED.includes(file.type)) {
        setError(t("newProject.formatError"));
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(t("newProject.fileTooLarge", { name: file.name }));
        continue;
      }
      added.push(file);
      addedUrls.push(URL.createObjectURL(file));
    }
    if (added.length) {
      setFiles((current) => [...current, ...added]);
      setUrls((current) => [...current, ...addedUrls]);
    }
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(urls[index]);
    setUrls((current) => current.filter((_, i) => i !== index));
    setFiles((current) => current.filter((_, i) => i !== index));
    setError(null);
  }

  const busy = !!importing;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newProject.title")}</DialogTitle>
          <DialogDescription>{t("newProject.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              className="h-8 text-sm"
              aria-label={t("newProject.nameA11y")}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("newProject.languages")}</Label>
            <div className="flex flex-wrap gap-1">
              {CONTENT_LANGUAGES.map((language) => {
                const selected = selectedLocales.includes(language.code);
                return (
                  <Button
                    key={language.code}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="h-7 rounded-full px-2.5 text-[10px]"
                    aria-pressed={selected}
                    disabled={busy}
                    onClick={() => {
                      setSelectedLocales((current) => {
                        if (current.includes(language.code)) {
                          // Always keep at least one language selected.
                          if (current.length === 1) return current;
                          return current.filter((code) => code !== language.code);
                        }
                        return [...current, language.code];
                      });
                    }}
                  >
                    {language.name}
                  </Button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">{t("newProject.languagesHint")}</p>
          </div>

          <button
            type="button"
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-5 text-muted-foreground transition-colors hover:bg-muted/40 disabled:pointer-events-none"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
            disabled={busy}
          >
            <ImageIcon className="h-5 w-5" />
            <span className="text-xs">
              {t("newProject.dropzone", { count: MAX_FILES })}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            hidden
            disabled={busy}
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              // Reset so selecting the same file again re-fires the change event.
              event.currentTarget.value = "";
            }}
          />

          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="group relative overflow-hidden rounded-sm border">
                  <img
                    src={urls[index]}
                    alt={file.name}
                    className="aspect-video h-full w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-0.5 h-6 w-6 rounded bg-background/80 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                    onClick={() => removeFile(index)}
                    disabled={busy}
                    title={t("newProject.removeFile", { name: file.name })}
                    aria-label={t("newProject.removeFile", { name: file.name })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("newProject.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onSubmit(name, files, selectedLocales)}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {importing}
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                {files.length > 0
                  ? t("newProject.createAndDraft", { count: files.length })
                  : t("newProject.createProject")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
