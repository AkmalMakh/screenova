"use client";

import * as React from "react";
import {
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  DesignConversationMessage,
  DesignReference,
  DesignScope,
} from "@/lib/design";
import { useT } from "@/lib/ui-i18n";
import type { TranslationKey } from "@/lib/ui-translations/en";
import { cn } from "@/lib/utils";

type Props = {
  messages: DesignConversationMessage[];
  scope: DesignScope;
  onScopeChange: (scope: DesignScope) => void;
  targetCount: number;
  generating: boolean;
  onSubmit: (prompt: string, references: DesignReference[]) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
};

export function DesignSidebar({
  messages,
  scope,
  onScopeChange,
  targetCount,
  generating,
  onSubmit,
  onCancel,
  disabled,
}: Props) {
  const { t } = useT();
  const [prompt, setPrompt] = React.useState("");
  const [references, setReferences] = React.useState<DesignReference[]>([]);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const messageEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generating]);

  async function submit() {
    const value = prompt.trim();
    if (!value || generating || disabled || (targetCount === 0 && references.length === 0)) return;
    setPrompt("");
    const attached = references;
    setReferences([]);
    await onSubmit(value, attached);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setAttachmentError(null);
    const room = Math.max(0, 3 - references.length);
    const picked = Array.from(files).slice(0, room);
    const next: DesignReference[] = [];
    for (const file of picked) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setAttachmentError(t("designSidebar.formatError"));
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setAttachmentError(t("designSidebar.fileTooLarge", { name: file.name }));
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type as DesignReference["mimeType"],
        dataUrl: await fileToDataUrl(file, t),
      });
    }
    setReferences((current) => [...current, ...next].slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="border-b border-border/70 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight">{t("designSidebar.title")}</h2>
            <p className="text-[11px] text-muted-foreground">{t("designSidebar.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/25 p-4">
            <p className="text-xs font-medium">{t("designSidebar.tryDirection")}</p>
            <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <p>{t("designSidebar.prompt1")}</p>
              <p>{t("designSidebar.prompt2")}</p>
              <p>{t("designSidebar.prompt3")}</p>
              <p>{t("designSidebar.prompt4")}</p>
              <p>{t("designSidebar.prompt5")}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[92%] rounded-xl px-3 py-2.5 text-xs leading-relaxed",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "border bg-background text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.referenceNames?.length ? (
                  <p className="mt-1.5 truncate text-[10px] opacity-70">
                    {message.referenceNames.join(", ")}
                  </p>
                ) : null}
                {message.proposalStatus && (
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-65">
                    {t(
                      `design.proposalStatus.${message.proposalStatus}` as TranslationKey,
                    )}
                  </p>
                )}
              </div>
            ))}
            {generating && (
              <div className="flex max-w-[92%] items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("designSidebar.generating")}
              </div>
            )}
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      <div className="border-t p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {(["current", "selected", "deck"] as DesignScope[]).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={scope === item ? "default" : "outline"}
              className="h-7 rounded-full px-2.5 text-[10px] capitalize"
              onClick={() => onScopeChange(item)}
              disabled={generating || disabled}
            >
              {item === "deck"
                ? t("designSidebar.scopeDeck")
                : item === "selected"
                  ? t("designSidebar.scopeSelected")
                  : t("designSidebar.scopeCurrent")}
            </Button>
          ))}
        </div>
        <div className="rounded-xl border bg-background p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 4000))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={3}
            className="min-h-16 resize-none border-0 p-1 text-xs shadow-none focus-visible:ring-0"
            placeholder={t("designSidebar.composerPlaceholder")}
            disabled={generating || disabled}
          />
          {references.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto">
              {references.map((reference) => (
                <div key={reference.id} className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-md border">
                  <img src={reference.dataUrl} alt={reference.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-0 top-0 rounded-bl bg-black/70 p-0.5 text-white"
                    onClick={() => setReferences((items) => items.filter((item) => item.id !== reference.id))}
                    aria-label={t("designSidebar.removeReference", { name: reference.name })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachmentError && <p className="mb-1 text-[10px] text-destructive">{attachmentError}</p>}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => fileRef.current?.click()}
                disabled={generating || disabled || references.length >= 3}
                title={t("designSidebar.attachHint")}
                aria-label={t("designSidebar.attachHint")}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(event) => void addFiles(event.target.files)}
              />
              <span className="text-[10px] text-muted-foreground">
                {t("designSidebar.targets", { count: targetCount })}
                {references.length > 0
                  ? t("designSidebar.attachments", { count: references.length })
                  : ""}
              </span>
            </div>
            {generating ? (
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
                {t("designSidebar.cancel")}
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => void submit()}
                disabled={!prompt.trim() || (targetCount === 0 && references.length === 0) || disabled}
                aria-label={t("designSidebar.generateRedesign")}
                title={t("designSidebar.generateRedesign")}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
          {t("designSidebar.footnote")}
        </p>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File, t: ReturnType<typeof useT>["t"]) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error || new Error(t("designSidebar.readError")));
    reader.readAsDataURL(file);
  });
}
