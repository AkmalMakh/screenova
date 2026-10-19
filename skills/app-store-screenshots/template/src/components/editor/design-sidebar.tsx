"use client";

import * as React from "react";
import {
  ImagePlus,
  Loader2,
  Paperclip,
  Send,
  Wand2,
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

/* The design-with-AI surface is split Stitch-style: the chat log floats as a
   collapsible panel over the canvas, and the composer is a separate floating
   bar at the bottom center. They share nothing but the shell's handlers. */

export function DesignChatLog({
  messages,
  generating,
}: {
  messages: DesignConversationMessage[];
  generating: boolean;
}) {
  const { t } = useT();
  const messageEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generating]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/25 p-4">
          <p className="text-caption font-medium">{t("designSidebar.tryDirection")}</p>
          <div className="mt-2 space-y-1.5 text-caption leading-relaxed text-muted-foreground">
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
                "max-w-[92%] rounded-lg px-3 py-2.5 text-footnote leading-relaxed",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "border border-border/80 bg-background text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
              {message.referenceNames?.length ? (
                <p className="mt-1.5 truncate text-caption opacity-70">
                  {message.referenceNames.join(", ")}
                </p>
              ) : null}
              {message.proposalStatus && (
                <p className="mt-1.5 text-caption font-semibold uppercase tracking-wide opacity-65">
                  {t(
                    `design.proposalStatus.${message.proposalStatus}` as TranslationKey,
                  )}
                </p>
              )}
            </div>
          ))}
          {generating && (
            <div className="flex max-w-[92%] items-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-2.5 text-footnote text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("designSidebar.generating")}
            </div>
          )}
        </div>
      )}
      <div ref={messageEndRef} />
    </div>
  );
}

export function DesignComposer({
  scope,
  onScopeChange,
  targetCount,
  generating,
  onSubmit,
  onCancel,
  disabled,
}: {
  scope: DesignScope;
  onScopeChange: (scope: DesignScope) => void;
  targetCount: number;
  generating: boolean;
  onSubmit: (prompt: string, references: DesignReference[]) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const [prompt, setPrompt] = React.useState("");
  const [references, setReferences] = React.useState<DesignReference[]>([]);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const inspirationRef = React.useRef<HTMLInputElement>(null);
  const hasInspiration = references.some((reference) => reference.purpose === "inspiration");

  async function submit(text = prompt) {
    // An inspiration image says what to do on its own: send needs no typing.
    const value = text.trim() || (hasInspiration ? t("designSidebar.matchReferencePrompt") : "");
    if (!value || generating || disabled || (targetCount === 0 && references.length === 0)) return;
    setPrompt("");
    const attached = references;
    setReferences([]);
    await onSubmit(value, attached);
  }

  // One click: restyle the target screen(s) like the attached image. Any text
  // the user already typed is kept as extra direction after the instruction.
  const canMatchReference = references.length > 0 && targetCount > 0 && !generating && !disabled;
  function matchReference() {
    const extra = prompt.trim();
    void submit(`${t("designSidebar.matchReferencePrompt")}${extra ? `\n\n${extra}` : ""}`);
  }

  async function addFiles(files: FileList | File[] | null, purpose?: DesignReference["purpose"]) {
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
        ...(purpose ? { purpose } : {}),
      });
    }
    setReferences((current) => [...current, ...next].slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
    if (inspirationRef.current) inspirationRef.current.value = "";
  }

  return (
    <div className="rounded-lg border border-border/80 bg-card p-2 shadow-pop transition-[border-color] focus-within:border-primary/40">
      {references.length > 0 && (
        <div className="mb-1 flex gap-1.5 overflow-x-auto px-1 pt-1">
          {references.map((reference) => (
            <div
              key={reference.id}
              className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-border/70"
            >
              <img src={reference.dataUrl} alt={reference.name} className="h-full w-full object-cover" />
              {reference.purpose === "inspiration" && (
                <span
                  role="img"
                  aria-label={t("designSidebar.inspirationTag")}
                  title={t("designSidebar.inspirationTag")}
                  className="absolute bottom-0.5 left-0.5 grid h-4 w-4 place-items-center rounded-xs bg-primary text-primary-foreground shadow-sm"
                >
                  <ImagePlus className="h-2.5 w-2.5" aria-hidden />
                </span>
              )}
              <button
                type="button"
                className="absolute right-0 top-0 rounded-bl-sm bg-black/70 p-0.5 text-white"
                onClick={() => setReferences((items) => items.filter((item) => item.id !== reference.id))}
                aria-label={t("designSidebar.removeReference", { name: reference.name })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {targetCount > 0 && (
            <Button
              type="button"
              variant="outline"
              className="ml-1 h-9 shrink-0 gap-1.5 self-center rounded-sm px-3 text-footnote"
              onClick={matchReference}
              disabled={!canMatchReference}
              title={t("designSidebar.matchReferenceHint")}
            >
              <Wand2 className="h-4 w-4" aria-hidden />
              {t("designSidebar.matchReference")}
            </Button>
          )}
        </div>
      )}

      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value.slice(0, 4000))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        onPaste={(event) => {
          const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
          if (images.length === 0) return;
          event.preventDefault();
          void addFiles(images);
        }}
        rows={2}
        className="min-h-12 resize-none border-0 p-2 text-subhead shadow-none focus-visible:ring-0"
        placeholder={t("designSidebar.composerPlaceholder")}
        aria-label={t("designSidebar.composerPlaceholder")}
        disabled={generating || disabled}
      />

      {attachmentError && (
        <p className="px-2 pb-1 text-caption text-destructive">{attachmentError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 px-1 pb-1 pt-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-sm"
          onClick={() => fileRef.current?.click()}
          disabled={generating || disabled || references.length >= 3}
          aria-label={t("designSidebar.attachHint")}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          data-design-attachments
          onChange={(event) => void addFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 gap-1.5 rounded-sm px-2.5 text-footnote"
          onClick={() => inspirationRef.current?.click()}
          disabled={generating || disabled || references.length >= 3 || targetCount === 0}
          title={t("designSidebar.addInspirationHint")}
          aria-label={t("designSidebar.addInspirationHint")}
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("designSidebar.addInspiration")}</span>
        </Button>
        <input
          ref={inspirationRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          data-design-inspiration
          onChange={(event) => void addFiles(event.target.files, "inspiration")}
        />

        <div
          role="group"
          aria-label={t("designSidebar.scopeLabel")}
          className="inline-flex h-9 min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-sm bg-muted/70 p-0.5"
        >
          {(["current", "selected", "deck"] as DesignScope[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={scope === item}
              onClick={() => onScopeChange(item)}
              disabled={generating || disabled}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-xs px-2.5 text-footnote font-medium capitalize transition-colors disabled:opacity-50",
                scope === item
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item === "deck"
                ? t("designSidebar.scopeDeck")
                : item === "selected"
                  ? t("designSidebar.scopeSelected")
                  : t("designSidebar.scopeCurrent")}
            </button>
          ))}
        </div>

        <span className={cn("hidden text-caption text-muted-foreground", references.length === 0 && "md:inline")}>
          {t("designSidebar.targets", { count: targetCount })}
          {references.length > 0
            ? t("designSidebar.attachments", { count: references.length })
            : ""}
        </span>

        {generating ? (
          <Button
            type="button"
            variant="outline"
            className="ml-auto h-9 shrink-0 rounded-sm px-3 text-footnote"
            onClick={onCancel}
          >
            {t("designSidebar.cancel")}
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            className="ml-auto h-9 w-9 shrink-0 rounded-full"
            onClick={() => void submit()}
            disabled={(!prompt.trim() && !hasInspiration) || (targetCount === 0 && references.length === 0) || disabled}
            aria-label={t("designSidebar.generateRedesign")}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
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
