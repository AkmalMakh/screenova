"use client";
import { accountScope, apiFetch } from "@/lib/account-scope";
import { cloudPayloadTooLarge } from "@/lib/cloud-payload";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { toJpeg, toPng } from "html-to-image";
import {
  BoxSelect,
  Check,
  Eye,
  EyeOff,
  Hand,
  Images,
  MousePointer2,
  MousePointerClick,
  PanelLeftClose,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadDesignMessages, saveDesignMessages, saveDesignReferences } from "@/lib/chat-storage";
import {
  getExportSizes,
  hasTheme,
  supportsLandscape,
  themeById,
} from "@/lib/constants";
import { detectPlatform, nid } from "@/lib/defaults";
import {
  applyDesignProposal,
  cloneProject,
  parseDesignProposal,
  proposalSummary,
  type DesignConversationMessage,
  type DesignProposal,
  type DesignReference,
  type DesignScope,
  type GeneratedVisualAsset,
} from "@/lib/design";
import {
  decorationElementKey,
  isBuiltInElementId,
  isDecorationElementId,
  isTextElementId,
  textElementKey,
} from "@/lib/elements";
import { preloadImages, setImage } from "@/lib/image-cache";
import { resolveLocalizedScreenshot, resolveScreenshot, writeLocalized } from "@/lib/locale";
import { useProject } from "@/lib/storage";
import type {
  BuiltInElementId,
  Device,
  ElementId,
  ElementTransform,
  SelectedElement,
  Slide,
} from "@/lib/types";
import { Inspector } from "./inspector";
import { DesignChatLog, DesignComposer } from "./design-sidebar";
import { NewProjectDialog } from "./new-project-dialog";
import { CommandPalette, type PaletteGroup } from "./command-palette";
import { PreviewStage, type CanvasTool } from "./preview-stage";
import { fileToDataUrl, uploadImage } from "./screenshot-picker";
import { Sidebar } from "./sidebar";
import { buildSlidesFromAnalysis, type SlideAnalysis } from "@/lib/import-slides";
import { deviceLabel, LanguageProvider, useT } from "@/lib/ui-i18n";
import { DeckCanvas, getCanvas, getElementTransform } from "./slide-canvas";
import { parseBulkCopy, planBulkCopy, serializeBulkCopy } from "@/lib/bulk-copy";
import { Toolbar } from "./toolbar";
import { chromeGeometry, useEditorLayout, useElementSize, usePresence } from "./use-editor-layout";


const PALETTE_DEVICES: Device[] = [
  "iphone",
  "ipad",
  "android",
  "android-7",
  "android-10",
  "feature-graphic",
];
type PendingDesign = {
  proposal: DesignProposal;
  state: ReturnType<typeof cloneProject>;
  assistantMessageId: string;
  targetSlideIds: string[];
  createdSlideIds: string[];
};

export function ScreenshotEditor() {
  return (
    <LanguageProvider>
      <Editor />
    </LanguageProvider>
  );
}

function Editor() {
  const { t } = useT();
  const router = useRouter();
  const {
    state,
    setState,
    hydrated,
    savedAt,
    saveError,
    reset,
    resetDevice,
    undo,
    redo,
    projects,
    activeProjectId,
    createProject,
    switchProject,
    renameProject,
    duplicateProject,
    deleteProject,
  } = useProject();
  const [activeSlideId, setActiveSlideId] = React.useState<string | null>(null);
  const [selectedElement, setSelectedElement] = React.useState<SelectedElement | null>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [exportLocaleOverride, setExportLocaleOverride] = React.useState<string | null>(null);
  const [exportSlideIndex, setExportSlideIndex] = React.useState(0);
  const [designMessages, setDesignMessages] = React.useState<DesignConversationMessage[]>([]);
  const [messagesProjectId, setMessagesProjectId] = React.useState<string | null>(null);
  const [designScope, setDesignScope] = React.useState<DesignScope>("current");
  const [selectedSlideIds, setSelectedSlideIds] = React.useState<Set<string>>(new Set());
  const [generatingDesign, setGeneratingDesign] = React.useState(false);
  const [pendingDesign, setPendingDesign] = React.useState<PendingDesign | null>(null);
  const [showProposal, setShowProposal] = React.useState(true);
  const [canvasTool, setCanvasTool] = React.useState<CanvasTool>("select");
  // Panel layout: manual-first by default, remembered per browser. The left
  // slot holds the screens list or the design chat, never both.
  const { layout, showLeft, toggleLeft, setInspector } = useEditorLayout();
  const screensOpen = layout.left === "screens";
  const chatOpen = layout.left === "chat";
  const screenSettingsOpen = layout.inspector;
  const [areaRef, areaSize] = useElementSize<HTMLDivElement>();
  const [composerRef, composerSize] = useElementSize<HTMLDivElement>();
  // Panels slide in from their own edge and leave faster than they arrive.
  const chatPresence = usePresence(chatOpen);
  const screensPresence = usePresence(screensOpen);
  const inspectorPresence = usePresence(screenSettingsOpen);
  const geometry = chromeGeometry(
    areaSize.width,
    layout,
    composerSize.height,
    // The composer is always on from tablet width up; on phones it belongs to the chat sheet.
    areaSize.width >= 640 || chatOpen,
  );
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [importing, setImporting] = React.useState<string | null>(null);
  const exportRef = React.useRef<HTMLDivElement | null>(null);
  const exportInProgress = React.useRef(false);
  const designAbortRef = React.useRef<AbortController | null>(null);

  const currentSlides = state.slidesByDevice[state.device] || [];
  const canonicalActiveSlide =
    currentSlides.find((s) => s.id === activeSlideId) || currentSlides[0] || null;
  const displayState = pendingDesign && showProposal ? pendingDesign.state : state;
  const displaySlides = displayState.slidesByDevice[state.device] || currentSlides;
  const activeSlide =
    displaySlides.find((slide) => slide.id === activeSlideId) || displaySlides[0] || null;
  const theme =
    displayState.customThemesByDevice?.[state.device] ||
    themeById(displayState.themeId, displayState.customTheme);
  const canonicalTheme =
    state.customThemesByDevice?.[state.device] || themeById(state.themeId, state.customTheme);
  const targetSlideIds = React.useMemo(() => {
    if (designScope === "deck") return currentSlides.map((slide) => slide.id);
    if (designScope === "selected") {
      return currentSlides.filter((slide) => selectedSlideIds.has(slide.id)).map((slide) => slide.id);
    }
    return canonicalActiveSlide ? [canonicalActiveSlide.id] : [];
  }, [canonicalActiveSlide, currentSlides, designScope, selectedSlideIds]);

  // Load the design chat of the active project. Declared before the save
  // effect so the guard below never commits the outgoing project's messages
  // under the incoming project's key.
  React.useEffect(() => {
    if (!activeProjectId) return;
    setMessagesProjectId(activeProjectId);
    setDesignMessages(loadDesignMessages(activeProjectId));
  }, [activeProjectId]);

  React.useEffect(() => {
    if (!activeProjectId || messagesProjectId !== activeProjectId) return;
    saveDesignMessages(designMessages, activeProjectId);
  }, [designMessages, messagesProjectId, activeProjectId]);

  // Reset editor-local UI state whenever the active project changes.
  React.useEffect(() => {
    setActiveSlideId(null);
    setSelectedElement(null);
    setSelectedSlideIds(new Set());
    setDesignScope("current");
    setPendingDesign(null);
    setShowProposal(true);
  }, [activeProjectId]);

  React.useEffect(() => {
    const available = new Set(currentSlides.map((slide) => slide.id));
    setSelectedSlideIds((current) => {
      const next = new Set([...current].filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [currentSlides]);

  React.useEffect(() => {
    if (selectedElement && selectedElement.slideId !== activeSlide?.id) {
      setSelectedElement(null);
    }
  }, [activeSlide?.id, selectedElement]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!activeSlide && currentSlides.length > 0) {
      setActiveSlideId(currentSlides[0].id);
    }
  }, [hydrated, currentSlides, activeSlide]);

  React.useEffect(() => {
    if (!supportsLandscape(state.device) && state.orientation !== "portrait") {
      setState((p) => ({ ...p, orientation: "portrait" }));
    }
  }, [state.device, state.orientation, setState]);

  React.useEffect(() => {
    if (
      hydrated &&
      state.themeId &&
      !hasTheme(state.themeId) &&
      state.customTheme?.id !== state.themeId
    ) {
      toast.warning(t("toasts.usingFallbackTheme"), {
        description: `Theme "${state.themeId}" is not defined in src/lib/constants.ts.`,
        duration: 8000,
      });
    }
  }, [hydrated, state.customTheme?.id, state.themeId]);

  const assetPaths = React.useMemo(() => {
    const paths = new Set<string>();
    paths.add("/mockup.png");
    if (state.appIcon) paths.add(state.appIcon);
    // Preload every locale variant so bulk export doesn't race image loads.
    const allSlides: Slide[] = Object.values(state.slidesByDevice).flat();
    for (const s of allSlides) {
      if (s.visualAsset?.src && !s.visualAsset.src.startsWith("data:")) {
        paths.add(s.visualAsset.src);
      }
      const rawPairs: Array<[string | undefined, Partial<Record<string, string>> | undefined]> = [
        [s.screenshot, s.screenshotByLocale],
        [s.screenshotSecondary, s.screenshotSecondaryByLocale],
      ];
      for (const [raw, overrides] of rawPairs) {
        if (!raw || raw.startsWith("data:")) continue;
        if (raw.includes("{locale}") || overrides) {
          for (const loc of state.locales) paths.add(resolveLocalizedScreenshot(raw, overrides, loc));
        } else {
          paths.add(raw);
        }
      }
    }
    return Array.from(paths).sort();
  }, [state.slidesByDevice, state.appIcon, state.locales]);
  const assetSig = assetPaths.join("|");

  React.useEffect(() => {
    if (!hydrated) return;
    preloadImages(assetPaths).finally(() => setReady(true));
    // assetPaths is derived from assetSig; depending on the string keeps the
    // effect from re-firing when slidesByDevice churns without path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, assetSig]);

  // Surface storage failures (quota exceeded etc.) so the user knows their work isn't safe.
  React.useEffect(() => {
    if (saveError) {
      toast.error(t("toasts.loadOrSaveFailed"), {
        description: saveError,
        duration: 8000,
      });
    }
  }, [saveError]);

  // ---------- Mutations ----------

  const patchSlide = React.useCallback(
    (id: string, patch: Partial<Slide>) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        },
      }));
    },
    [setState],
  );

  const reorderSlides = React.useCallback(
    (next: Slide[]) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: { ...prev.slidesByDevice, [prev.device]: next },
      }));
    },
    [setState],
  );

  const deleteSlide = React.useCallback(
    (id: string) => {
      const dev = state.device;
      const slides = state.slidesByDevice[dev] || [];
      const idx = slides.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const snap = slides[idx];
      const fallback = slides[idx + 1] || slides[idx - 1] || null;

      setState((prev) => {
        const cur = prev.slidesByDevice[dev] || [];
        return {
          ...prev,
          slidesByDevice: { ...prev.slidesByDevice, [dev]: cur.filter((s) => s.id !== id) },
        };
      });
      setActiveSlideId((cur) => (cur === id ? fallback?.id || null : cur));

      toast(t("toasts.screenDeleted"), {
        action: {
          label: t("toasts.undo"),
          onClick: () => {
            setState((prev) => {
              const cur = prev.slidesByDevice[dev] || [];
              if (cur.some((s) => s.id === snap.id)) return prev;
              const restored = [...cur.slice(0, idx), snap, ...cur.slice(idx)];
              return {
                ...prev,
                slidesByDevice: { ...prev.slidesByDevice, [dev]: restored },
              };
            });
            setActiveSlideId(snap.id);
          },
        },
        duration: 6000,
      });
    },
    [setState, state.device, state.slidesByDevice],
  );

  const addSlide = React.useCallback(
    (slide: Slide) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: [...(prev.slidesByDevice[prev.device] || []), slide],
        },
      }));
      setActiveSlideId(slide.id);
    },
    [setState],
  );

  const patchLocalized = React.useCallback(
    (slide: Slide, key: "label" | "headline", value: string) => {
      patchSlide(slide.id, {
        [key]: writeLocalized(slide[key], state.locale, value),
      } as Partial<Slide>);
    },
    [patchSlide, state.locale],
  );

  // "Edit copy" opens on the deck's current copy; Apply writes only the rows
  // that changed (untouched headlines keep their line breaks).
  const bulkCopyText = React.useMemo(
    () => serializeBulkCopy(currentSlides, state.locale),
    [currentSlides, state.locale],
  );
  const applyBulkCopy = React.useCallback(
    (input: string) => {
      const pairs = parseBulkCopy(input);
      const { patches, changed } = planBulkCopy(currentSlides, pairs, state.locale);
      if (!changed) return { applied: 0, total: currentSlides.length };
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((slide, index) => {
            const patch = patches.get(index);
            return patch ? { ...slide, ...patch } : slide;
          }),
        },
      }));
      toast.success(
        t("toasts.updatedScreens", { count: changed, locale: state.locale.toUpperCase() }),
      );
      return { applied: changed, total: currentSlides.length };
    },
    [currentSlides, setState, state.locale],
  );

  const patchElementTransform = React.useCallback(
    (slideId: string, elementId: ElementId, transform: ElementTransform) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((slide) => {
            if (slide.id !== slideId) return slide;
            if (isTextElementId(elementId)) {
              const textId = textElementKey(elementId);
              return {
                ...slide,
                textElements: (slide.textElements || []).map((element) =>
                  element.id === textId ? { ...element, transform } : element,
                ),
              };
            }
            if (isDecorationElementId(elementId)) {
              const decorationId = decorationElementKey(elementId);
              return {
                ...slide,
                decorations: (slide.decorations || []).map((element) =>
                  element.id === decorationId ? { ...element, transform } : element,
                ),
              };
            }
            if (!isBuiltInElementId(elementId)) return slide;
            return {
              ...slide,
              transforms: {
                ...(slide.transforms || {}),
                [elementId]: transform,
              } as Partial<Record<BuiltInElementId, ElementTransform>>,
            };
          }),
        },
      }));
    },
    [setState],
  );

  const patchTextElementText = React.useCallback(
    (slideId: string, textId: string, value: string) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((slide) =>
            slide.id === slideId
              ? {
                  ...slide,
                  textElements: (slide.textElements || []).map((element) =>
                    element.id === textId
                      ? { ...element, text: writeLocalized(element.text, prev.locale, value) }
                      : element,
                  ),
                }
              : slide,
          ),
        },
      }));
    },
    [setState],
  );

  const duplicateSlide = React.useCallback(
    (id: string) => {
      let newId: string | null = null;
      setState((prev) => {
        const slides = prev.slidesByDevice[prev.device] || [];
        const idx = slides.findIndex((s) => s.id === id);
        if (idx === -1) return prev;
        const src = slides[idx];
        newId = nid();
        const copy: Slide = {
          ...src,
          id: newId,
          label: { ...src.label },
          headline: { ...src.headline },
          transforms: src.transforms
            ? Object.fromEntries(
                Object.entries(src.transforms).map(([key, value]) => [key, { ...value }]),
              )
            : undefined,
          textElements: src.textElements?.map((element) => ({
            ...element,
            id: nid(),
            text: { ...element.text },
            transform: { ...element.transform },
          })),
          decorations: src.decorations?.map((element) => ({
            ...element,
            id: nid(),
            transform: { ...element.transform },
            fill: { ...element.fill, colors: [...element.fill.colors] },
          })),
          visualAsset: src.visualAsset ? { ...src.visualAsset } : undefined,
        };
        const next = [...slides.slice(0, idx + 1), copy, ...slides.slice(idx + 1)];
        return {
          ...prev,
          slidesByDevice: { ...prev.slidesByDevice, [prev.device]: next },
        };
      });
      if (newId) setActiveSlideId(newId);
    },
    [setState],
  );

  async function generateDesign(prompt: string, references: DesignReference[]) {
    if ((!targetSlideIds.length && !references.length) || generatingDesign || pendingDesign) return;
    const requestState = cloneProject(state);
    const requestOwner = accountScope();
    const requestTargets = [...targetSlideIds];
    const userMessage: DesignConversationMessage = {
      id: chatId(),
      role: "user",
      text: prompt,
      createdAt: Date.now(),
      referenceIds: references.map((reference) => reference.id),
      referenceNames: references.map((reference) => reference.name),
    };
    setDesignMessages((messages) => [...messages, userMessage].slice(-50));
    void saveDesignReferences(references).catch(() => undefined);
    setGeneratingDesign(true);
    setSelectedElement(null);
    const controller = new AbortController();
    designAbortRef.current = controller;

    try {
      const renderedPreviews = await captureDesignPreviews(requestTargets);
      const uploadedPaths = new Map<string, Promise<string>>();
      const requestReferences = references.map(({ id, name, mimeType, dataUrl }) => ({ id, name, mimeType, dataUrl }));
      if (requestOwner) {
        for (const image of [...renderedPreviews, ...requestReferences]) {
          if (controller.signal.aborted || accountScope() !== requestOwner) throw new Error("Design request cancelled. Reload if your account changed.");
          const { path: uploaded, error: uploadError } = await uploadImage(image.dataUrl);
          if (!uploaded) throw new Error(uploadError ?? "Could not upload design images. Please retry.");
          image.dataUrl = uploaded;
          if ("id" in image) uploadedPaths.set(image.id, Promise.resolve(uploaded));
        }
      }
      if (controller.signal.aborted || accountScope() !== requestOwner) throw new Error("Design request cancelled. Reload if your account changed.");
      const requestBody = JSON.stringify({
        prompt,
        scope: { type: designScope, slideIds: requestTargets },
        project: requestState,
        renderedPreviews,
        references: requestReferences,
        conversation: designMessages.slice(-12).map(({ role, text }) => ({ role, text })),
      });
      if (requestOwner && cloudPayloadTooLarge(requestBody)) {
        throw new Error("This project is too large for one redesign request. Remove inline images or reduce the project size.");
      }
      const response = await apiFetch("/api/design", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: requestBody,
      });
      const json = (await response.json()) as {
        ok: boolean;
        proposal?: unknown;
        generatedVisualAssets?: unknown;
        error?: string;
      };
      if (controller.signal.aborted || accountScope() !== requestOwner) throw new Error("Design request cancelled. Reload if your account changed.");
      if (!response.ok || !json.ok || !json.proposal) {
        throw new Error(
          json.error || t("toasts.designRequestFailed", { status: response.status }),
        );
      }
      const proposal = parseDesignProposal(json.proposal);
      const generatedVisualAssets = Array.isArray(json.generatedVisualAssets)
        ? (json.generatedVisualAssets as GeneratedVisualAsset[])
        : [];
      const referencesById = new Map(references.map((reference) => [reference.id, reference]));
      const newSlideAssets = await Promise.all(
        (proposal.newSlides || []).map(async (newSlide) => {
          const reference = referencesById.get(newSlide.sourceReferenceId);
          if (!reference) {
            throw new Error(t("toasts.attachmentGone"));
          }
          let upload = uploadedPaths.get(reference.id);
          if (!upload) {
            upload = uploadDesignReference(reference, t);
            uploadedPaths.set(reference.id, upload);
          }
          const screenshot = await upload;
          setImage(screenshot, reference.dataUrl);
          return { slideId: nid(), screenshot };
        }),
      );
      const proposalState = applyDesignProposal(
        requestState,
        proposal,
        requestTargets,
        newSlideAssets,
        generatedVisualAssets,
      );
      const createdSlideIds = newSlideAssets.map((asset) => asset.slideId);
      const affectedSlideIds = [
        ...new Set([
          ...proposal.slidePatches.map((patch) => patch.slideId),
          ...createdSlideIds,
        ]),
      ];
      const assistantMessageId = chatId();
      const assistantMessage: DesignConversationMessage = {
        id: assistantMessageId,
        role: "assistant",
        text: proposalSummary(proposal),
        createdAt: Date.now(),
        proposalStatus: "pending",
      };
      setDesignMessages((messages) => [...messages, assistantMessage].slice(-50));
      setPendingDesign({
        proposal,
        state: proposalState,
        assistantMessageId,
        targetSlideIds: affectedSlideIds,
        createdSlideIds,
      });
      if (createdSlideIds[0]) setActiveSlideId(createdSlideIds[0]);
      setShowProposal(true);
      toast.success(
        createdSlideIds.length ? t("toasts.newScreenReady") : t("toasts.redesignReady"),
      );
    } catch (error) {
      if (controller.signal.aborted) {
        toast(t("toasts.designCancelled"));
      } else {
        const message = error instanceof Error ? error.message : t("toasts.designFailed");
        const failureMessage: DesignConversationMessage = {
          id: chatId(),
          role: "assistant",
          text: message,
          createdAt: Date.now(),
          proposalStatus: "failed",
        };
        setDesignMessages((messages) => [...messages, failureMessage].slice(-50));
        toast.error(t("toasts.generateFailed"), { description: message });
      }
    } finally {
      if (designAbortRef.current === controller) designAbortRef.current = null;
      setGeneratingDesign(false);
    }
  }

  async function captureDesignPreviews(slideIds: string[]) {
    const { cW: canvasWidth, cH: canvasHeight } = getCanvas(state.device, state.orientation);
    await preloadImages(assetPaths, { retryFailed: true });
    await waitForPaint();
    const previews: Array<{ slideId: string; dataUrl: string }> = [];
    for (const slideId of slideIds) {
      const index = currentSlides.findIndex((slide) => slide.id === slideId);
      if (index < 0) throw new Error(t("toasts.renderSelectedFailed", { slideId }));
      setExportSlideIndex(index);
      await waitForPaint();
      const element = exportRef.current;
      if (!element) throw new Error(t("toasts.renderTargetMissing"));
      previews.push({
        slideId,
        dataUrl: await captureSlideForModel(element, canvasWidth, canvasHeight),
      });
    }
    return previews;
  }

  function applyPendingDesign() {
    if (!pendingDesign) return;
    setState(pendingDesign.state, { coalesce: false });
    markProposalStatus(pendingDesign.assistantMessageId, "applied");
    setPendingDesign(null);
    setShowProposal(true);
    toast.success(
      pendingDesign.createdSlideIds.length
        ? t("toasts.addedScreens", { count: pendingDesign.createdSlideIds.length })
        : t("toasts.appliedRedesign", { count: pendingDesign.targetSlideIds.length }),
    );
  }

  function discardPendingDesign() {
    if (!pendingDesign) return;
    markProposalStatus(pendingDesign.assistantMessageId, "discarded");
    setPendingDesign(null);
    setShowProposal(true);
    toast(t("toasts.redesignDiscarded"));
  }

  function markProposalStatus(
    messageId: string,
    proposalStatus: NonNullable<DesignConversationMessage["proposalStatus"]>,
  ) {
    setDesignMessages((messages) =>
      messages.map((message) =>
        message.id === messageId ? { ...message, proposalStatus } : message,
      ),
    );
  }

  // ---------- New project from screenshots ----------

  async function handleCreateProject(name: string, files: File[], locales: string[]) {
    if (importing) return; // double-submit guard
    if (files.length === 0) {
      createProject(name.trim(), locales);
      setImporting(null);
      setImportDialogOpen(false);
      toast.success(t("toasts.projectCreated"));
      return;
    }
    setImporting(t("toasts.uploadingScreens", { count: files.length }));
    try {
      const paths = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await fileToDataUrl(file);
          const { path, error: uploadError } = await uploadImage(dataUrl);
          if (!path) throw new Error(uploadError ?? t("toasts.uploadFailed", { name: file.name }));
          setImage(path, dataUrl); // prime the cache so the canvas paints immediately
          return path;
        }),
      );
      setImporting(t("toasts.analyzingScreens"));
      const response = await apiFetch("/api/design/analyze-screenshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appName: name.trim() || "My App",
          locales,
          screenshots: files.map((file, index) => ({ name: file.name, path: paths[index] })),
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        slides?: SlideAnalysis[];
        error?: string;
      };
      if (!response.ok || !json.ok || !json.slides?.length) {
        throw new Error(json.error || t("toasts.analysisFailed", { status: response.status }));
      }
      const created = createProject(name.trim(), locales);
      const slides = buildSlidesFromAnalysis(json.slides, paths, created.locales, created.device);
      // Replace the new project's starter deck for the current device.
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: slides,
        },
      }));
      if (slides[0]) setActiveSlideId(slides[0].id);
      toast.success(t("toasts.projectCreatedFromScreens", { count: slides.length }));
      setImportDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toasts.importFailed");
      toast.error(t("toasts.createFromScreensFailed"), { description: message });
    } finally {
      setImporting(null);
    }
  }

  // ---------- Keyboard shortcuts ----------

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as HTMLElement).isContentEditable);
      if (exporting || generatingDesign || pendingDesign) return;

      // Command palette and panel toggles work everywhere, including inputs.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        toggleLeft("screens");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "2") {
        e.preventDefault();
        setInspector((open) => !open);
        return;
      }

      if (e.key === "Escape") {
        setSelectedElement(null);
        if (target && "blur" in target && typeof target.blur === "function") target.blur();
        return;
      }

      // Let focused inputs and contenteditable text keep their native undo,
      // redo, selection, and deletion behavior.
      if (inEditable) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (!currentSlides.length) return;

      // A selected element owns the arrow and delete keys, like Figma/Sketch:
      // arrows nudge it (Shift = 10×), Delete/Backspace removes text, shapes
      // and badges. Nothing else happens on the same key press.
      if (selectedElement && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const slide = currentSlides.find((s) => s.id === selectedElement.slideId);
        const id = selectedElement.elementId;
        if (slide && e.key.startsWith("Arrow")) {
          const current = getElementTransform(slide, state.device, state.orientation, id);
          if (current) {
            e.preventDefault();
            // One step is one point at the export's @3x scale; Shift is ten.
            const unit = Math.max(1, Math.round(getCanvas(state.device, state.orientation).cW / 440));
            const step = unit * (e.shiftKey ? 10 : 1);
            const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
            const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
            patchElementTransform(slide.id, id, { ...current, x: current.x + dx, y: current.y + dy });
          }
          return;
        }
        if (slide && (e.key === "Backspace" || e.key === "Delete")) {
          if (isTextElementId(id)) {
            e.preventDefault();
            const next = (slide.textElements || []).filter((el) => el.id !== textElementKey(id));
            patchSlide(slide.id, { textElements: next.length ? next : undefined });
            setSelectedElement(null);
          } else if (isDecorationElementId(id)) {
            e.preventDefault();
            const next = (slide.decorations || []).filter((el) => el.id !== decorationElementKey(id));
            patchSlide(slide.id, { decorations: next.length ? next : undefined });
            setSelectedElement(null);
          }
          return;
        }
      }

      // Marked screens on a free (isolated) canvas: the stage nudges them with
      // the arrows, so the arrows must not also jump to another screen.
      const nudgingScreens = selectedSlideIds.size > 0 && !state.connectedCanvas;
      const idx = activeSlide ? currentSlides.findIndex((s) => s.id === activeSlide.id) : -1;
      if ((e.key === "ArrowDown" && !nudgingScreens) || (e.key === "j" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const next = currentSlides[Math.min(currentSlides.length - 1, idx + 1)];
        if (next) setActiveSlideId(next.id);
      } else if ((e.key === "ArrowUp" && !nudgingScreens) || (e.key === "k" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const next = currentSlides[Math.max(0, idx - 1)];
        if (next) setActiveSlideId(next.id);
      } else if ((e.key === "d" || e.key === "D") && (e.metaKey || e.ctrlKey)) {
        if (activeSlide) {
          e.preventDefault();
          duplicateSlide(activeSlide.id);
        }
      } else if ((e.key === "Backspace" || e.key === "Delete") && (e.metaKey || e.ctrlKey)) {
        // Cmd+Delete removes the screen, never while an element is selected.
        if (activeSlide && !selectedElement) {
          e.preventDefault();
          deleteSlide(activeSlide.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlide, currentSlides, duplicateSlide, deleteSlide, exporting, generatingDesign, pendingDesign, undo, redo, toggleLeft, setInspector, selectedElement, selectedSlideIds, state.connectedCanvas, state.device, state.orientation, patchElementTransform, patchSlide]);

  // ---------- Export ----------

  // Wait two animation frames so React's render → browser layout/paint of the
  // off-screen container settles before html-to-image snapshots it. One frame
  // is occasionally not enough on slower machines.
  function waitForPaint() {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  async function exportAll() {
    if (exportInProgress.current || generatingDesign || pendingDesign || importing) return;
    exportInProgress.current = true;
    setExporting("0/1");
    try {
    if (!currentSlides.length) {
      toast.error(t("toasts.noScreensToExport"));
      return;
    }

    const sizes = getExportSizes(state.device, state.orientation);
    if (!sizes.length) {
      toast.error(t("toasts.nothingToExport"));
      return;
    }
    const locales = state.locales;
    await preloadImages(assetPaths, { retryFailed: true });
    await waitForPaint();

    const missingScreens = currentSlides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide }) => slideNeedsScreenshot(state.device, slide) && !slide.screenshot);
    const reusedBackScreens = currentSlides
      .map((slide, index) => ({ slide, index }))
      .filter(
        ({ slide }) =>
          state.device !== "feature-graphic" &&
          slide.layout === "two-devices" &&
          slide.screenshot &&
          !slide.screenshotSecondary,
      );
    if (missingScreens.length > 0 || reusedBackScreens.length > 0) {
      const details = [
        missingScreens.length
          ? t("toasts.screensEmptyDevice", { count: missingScreens.length })
          : null,
        reusedBackScreens.length
          ? t("toasts.twoDeviceReuse", { count: reusedBackScreens.length })
          : null,
      ].filter(Boolean);
      toast.warning(t("toasts.exportPlaceholders"), {
        description: details.join(" "),
        duration: 7000,
      });
    }

    // Make sure custom fonts are loaded before snapshot so typography in PNG
    // matches what's on screen.
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }

    const { cW, cH } = getCanvas(state.device, state.orientation);
    const platform = detectPlatform(state.device);
    const zip = new JSZip();
    const totalUnits = sizes.length * locales.length * currentSlides.length;
    let unit = 0;
    let okCount = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const locale of locales) {
      setExportLocaleOverride(locale);
      await waitForPaint();

      for (const size of sizes) {
        for (let i = 0; i < currentSlides.length; i++) {
          const slide = currentSlides[i];
          unit += 1;
          setExporting(`${unit}/${totalUnits}`);
          setExportSlideIndex(i);
          await waitForPaint();
          const el = exportRef.current;
          if (!el) {
            failed += 1;
            errors.push(`${locale} ${size.w}×${size.h} screen ${i + 1}: render target missing`);
            continue;
          }
          try {
            const dataUrl = await captureSlide(el, cW, cH, size.w, size.h);
            const base64 = dataUrl.split(",")[1] || "";
            const filename = `${String(i + 1).padStart(2, "0")}-${slide.layout}.png`;
            const path = `${platform}/${state.device}/${size.w}x${size.h}/${locale}/${filename}`;
            zip.file(path, base64, { base64: true });
            okCount += 1;
          } catch (e) {
            failed += 1;
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${locale} ${size.w}×${size.h} screen ${i + 1}: ${msg}`);
            console.error("Export failed", { slideId: slide.id, locale, size }, e);
          }
        }
      }
    }

    setExportLocaleOverride(null);

    if (okCount > 0) {
      try {
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(state.appName)}-${platform}-${state.device}-${stamp()}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) {
        toast.error(t("toasts.bundleFailed"));
        console.error(e);
        return;
      }
    }

    const summary = `${t("toasts.localeCount", { count: locales.length })} × ${t("toasts.sizeCount", { count: sizes.length })}`;
    if (failed === 0) {
      toast.success(t("toasts.exportedPngs", { count: okCount, summary }));
    } else if (okCount === 0) {
      toast.error(t("toasts.rendersFailedAll", { count: failed }), {
        description: errors.slice(0, 3).join("\n"),
      });
    } else {
      toast.error(t("toasts.rendersFailedSome", { count: failed, total: totalUnits }), {
        description: errors.slice(0, 3).join("\n"),
      });
    }
    } catch (error) {
      toast.error(t("toasts.bundleFailed"));
      console.error("Export failed", error);
    } finally {
      exportInProgress.current = false;
      setExportLocaleOverride(null);
      setExporting(null);
    }
  }

  async function captureSlide(
    el: HTMLElement,
    sourceW: number,
    sourceH: number,
    exportW: number,
    exportH: number,
  ) {
    // html-to-image needs the node at (0,0). Let the library scale the source
    // canvas into the requested output dimensions; CSS transforms leave
    // transparent gutters when export aspect ratios differ by a few pixels.
    const prev = {
      left: el.style.left,
      top: el.style.top,
      position: el.style.position,
      transform: el.style.transform,
      transformOrigin: el.style.transformOrigin,
      zIndex: el.style.zIndex,
    };
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.position = "absolute";
    el.style.transform = "none";
    el.style.transformOrigin = "top left";
    el.style.zIndex = "-1";
    try {
      const dataUrl = await toPng(el, {
        width: sourceW,
        height: sourceH,
        canvasWidth: exportW,
        canvasHeight: exportH,
        pixelRatio: 1,
        cacheBust: false,
        // Editor typefaces use system font stacks; landing webfonts are unrelated.
        skipFonts: true,
        backgroundColor: "#ffffff",
      });
      return dataUrl;
    } finally {
      el.style.left = prev.left || "-99999px";
      el.style.top = prev.top || "0px";
      el.style.position = prev.position || "absolute";
      el.style.transform = prev.transform;
      el.style.transformOrigin = prev.transformOrigin;
      el.style.zIndex = prev.zIndex;
    }
  }

  // ---------- Render ----------

  if (!hydrated || !ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const { cW, cH } = getCanvas(state.device, state.orientation);
  const busy = !!exporting || generatingDesign || !!pendingDesign || !!importing;

  // ⌘K command palette — flat action list grouped for scanning.
  const paletteGroups: PaletteGroup[] = [
    {
      label: t("palette.group.navigate"),
      items: [
        { id: "palette-home", label: t("palette.action.home"), run: () => router.push("/") },
        {
          id: "palette-new-project",
          label: t("palette.action.newProject"),
          run: () => setImportDialogOpen(true),
        },
        {
          id: "palette-export",
          label: t("palette.action.export"),
          run: () => void exportAll(),
          disabled: !!exporting || currentSlides.length === 0,
        },
      ],
    },
    {
      label: t("palette.group.view"),
      items: [
        {
          id: "palette-screens",
          label: t("palette.action.screens"),
          hint: screensOpen ? t("palette.on") : t("palette.off"),
          run: () => toggleLeft("screens"),
        },
        {
          id: "palette-settings",
          label: t("palette.action.settings"),
          hint: screenSettingsOpen ? t("palette.on") : t("palette.off"),
          run: () => setInspector((open) => !open),
        },
        {
          id: "palette-connected",
          label: t("palette.action.connected"),
          hint: state.connectedCanvas ? t("palette.on") : t("palette.off"),
          run: () => setState((p) => ({ ...p, connectedCanvas: !p.connectedCanvas })),
        },
      ],
    },
    {
      label: t("palette.group.device"),
      items: PALETTE_DEVICES.map((device) => ({
        id: `palette-device-${device}`,
        label: deviceLabel(device, t),
        hint: state.device === device ? t("palette.current") : undefined,
        run: () => setState((p) => ({ ...p, device })),
      })),
    },
    {
      label: t("palette.group.edit"),
      items: [
        { id: "palette-undo", label: t("palette.action.undo"), hint: "⌘Z", run: undo },
        { id: "palette-redo", label: t("palette.action.redo"), hint: "⇧⌘Z", run: redo },
        {
          id: "palette-duplicate",
          label: t("palette.action.duplicate"),
          hint: "⌘D",
          run: () => activeSlide && duplicateSlide(activeSlide.id),
          disabled: !activeSlide,
        },
        {
          id: "palette-delete",
          label: t("palette.action.delete"),
          hint: "⌘⌫",
          run: () => activeSlide && deleteSlide(activeSlide.id),
          disabled: !activeSlide,
        },
      ],
    },
  ];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <EditorToaster bottom={geometry.phone ? 16 : geometry.canvas.bottom + 16} />
      <Toolbar
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={switchProject}
        onCreateProject={() => setImportDialogOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onRenameProject={renameProject}
        onDuplicateProject={duplicateProject}
        onDeleteProject={deleteProject}
        appName={state.appName}
        setAppName={(v) => setState((p) => ({ ...p, appName: v }))}
        connectedCanvas={state.connectedCanvas}
        setConnectedCanvas={(v) => setState((p) => ({ ...p, connectedCanvas: v }))}
        locale={state.locale}
        setLocale={(v) => setState((p) => ({ ...p, locale: v }))}
        locales={state.locales}
        device={state.device}
        setDevice={(v) => setState((p) => ({ ...p, device: v }))}
        orientation={state.orientation}
        setOrientation={(v) => setState((p) => ({ ...p, orientation: v }))}
        onExport={exportAll}
        bulkCopyText={bulkCopyText}
        onBulkCopy={applyBulkCopy}
        onResetAll={() => {
          reset();
          setActiveSlideId(null);
          toast.success(t("toasts.resetAllDevices"));
        }}
        onResetDevice={() => {
          resetDevice(state.device);
          setActiveSlideId(null);
          toast.success(t("toasts.resetDevice", { device: deviceLabel(state.device, t) }));
        }}
        exporting={exporting}
        savedAt={savedAt}
        saveError={saveError}
        busy={busy}
      />

      <NewProjectDialog
        open={importDialogOpen}
        onOpenChange={(next) => {
          // Block Escape/overlay/X mid-import — the import must finish.
          if (!next && importing) return;
          setImportDialogOpen(next);
        }}
        importing={importing}
        onSubmit={handleCreateProject}
      />

      <div ref={areaRef} className="relative flex-1 overflow-hidden">
        {/* Full-bleed deck canvas — everything else floats above it, laid out
            by chromeGeometry so no panel, HUD or composer overlaps another. */}
        <main className="absolute inset-0">
          {activeSlide && currentSlides.length > 0 ? (
            <PreviewStage
              slides={displaySlides}
              activeSlideId={activeSlide.id}
              device={state.device}
              orientation={state.orientation}
              theme={theme}
              locale={state.locale}
              appName={state.appName}
              appIcon={state.appIcon}
              connectedCanvas={state.connectedCanvas}
              insets={geometry.canvas}
              selectedElement={selectedElement}
              tool={canvasTool}
              onToolChange={setCanvasTool}
              selectedIds={selectedSlideIds}
              onSelectedIdsChange={setSelectedSlideIds}
              onScreenOffsetCommit={(slideId, offset) =>
                patchSlide(slideId, { canvasOffset: offset ?? undefined })
              }
              onActiveSlideChange={setActiveSlideId}
              onLabelChange={(slide, v) => patchLocalized(slide, "label", v)}
              onHeadlineChange={(slide, v) => patchLocalized(slide, "headline", v)}
              onTextElementTextChange={patchTextElementText}
              onElementChange={patchElementTransform}
              onSelectElement={(element) => {
                setSelectedElement(element);
                if (element?.elementId === "device" || element?.elementId === "deviceSecondary") {
                  setActiveSlideId(element.slideId);
                  setInspector(true);
                }
              }}
              editable={!busy}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 shadow-sm">
                <MousePointerClick className="h-4 w-4" />
              </span>
              <p className="font-medium text-foreground">{t("toasts.noScreenSelected")}</p>
              <p className="text-xs">{t("toasts.addScreenHint")}</p>
            </div>
          )}
        </main>

        {/* Design chat — floating, collapsible (Stitch's agent panel). */}
        {chatPresence.mounted && (
          <section
            aria-label={t("designSidebar.title")}
            data-state={chatPresence.state}
            className={cn(PANEL_SURFACE, PANEL_MOTION_LEFT, "absolute inset-x-3 top-3 z-30 flex max-h-[45vh] flex-col sm:inset-x-auto sm:left-4 sm:top-4 sm:max-h-none sm:w-80")}
            style={geometry.phone ? undefined : { bottom: geometry.panelBottom }}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-footnote font-semibold tracking-tight">
                  {t("designSidebar.title")}
                </h2>
                <p className="truncate text-caption text-muted-foreground">
                  {t("designSidebar.subtitle")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-sm"
                // The chat borrowed the left slot from the screens list; give it back.
                onClick={() => showLeft(window.innerWidth < 640 ? null : "screens")}
                aria-label={t("designSidebar.collapse")}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <DesignChatLog messages={designMessages} generating={generatingDesign} />
          </section>
        )}
        {!chatOpen && (
          <button
            type="button"
            onClick={() => showLeft("chat")}
            className={cn(PANEL_SURFACE, "absolute left-4 top-4 z-30 inline-flex h-9 items-center gap-2 px-3 text-footnote font-medium transition-[background-color,left] duration-short ease-out hover:bg-accent motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95", (screensOpen || screenSettingsOpen) && "hidden sm:inline-flex")}
            style={geometry.phone ? undefined : { left: geometry.leftEdge + 16 }}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            {t("designSidebar.expand")}
          </button>
        )}

        {/* Tool rail — right edge, vertically centered (Stitch's toolbar). */}
        <div className={cn(PANEL_SURFACE, "absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1 p-1")}>
          <Button
            type="button"
            variant={canvasTool === "select" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-sm"
            onClick={() => setCanvasTool("select")}
            aria-pressed={canvasTool === "select"}
            aria-label={t("toolbar.toolSelect")}
            title={t("toolbar.toolSelect")}
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={canvasTool === "marquee" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-sm"
            onClick={() => setCanvasTool("marquee")}
            aria-pressed={canvasTool === "marquee"}
            aria-label={t("toolbar.toolMarquee")}
            title={t("toolbar.toolMarquee")}
          >
            <BoxSelect className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={canvasTool === "pan" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-sm"
            onClick={() => setCanvasTool("pan")}
            aria-pressed={canvasTool === "pan"}
            aria-label={t("toolbar.toolPan")}
            title={t("toolbar.toolPan")}
          >
            <Hand className="h-4 w-4" />
          </Button>
          <span aria-hidden className="mx-1 my-0.5 h-px bg-border" />
          <Button
            type="button"
            variant={screensOpen ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-sm"
            onClick={() => toggleLeft("screens")}
            aria-pressed={screensOpen}
            aria-controls="screens-panel"
            aria-label={screensOpen ? t("toolbar.hideScreens") : t("toolbar.showScreens")}
            title={screensOpen ? t("toolbar.hideScreens") : t("toolbar.showScreens")}
          >
            <Images className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={screenSettingsOpen ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-sm"
            onClick={() => setInspector((open) => !open)}
            aria-pressed={screenSettingsOpen}
            aria-controls="screen-settings-panel"
            aria-label={
              screenSettingsOpen ? t("toolbar.hideSettings") : t("toolbar.showSettings")
            }
            title={screenSettingsOpen ? t("toolbar.hideSettings") : t("toolbar.showSettings")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Floating right panels, anchored beside the rail. */}
        {(screensPresence.mounted || inspectorPresence.mounted) && (
          <div className="contents">
            {screensPresence.mounted && (
              <section
                id="screens-panel"
                aria-label={t("toolbar.screens")}
                data-state={screensPresence.state}
                className={cn(PANEL_SURFACE, PANEL_MOTION_LEFT, "absolute bottom-32 right-[76px] top-3 z-20 flex w-[184px] max-w-[78vw] flex-col sm:left-4 sm:right-auto sm:top-4")}
                style={geometry.phone ? undefined : { bottom: geometry.panelBottom }}
              >
                <Sidebar
                  slides={displaySlides}
                  activeId={activeSlide?.id || null}
                  device={state.device}
                  orientation={state.orientation}
                  theme={theme}
                  locale={state.locale}
                  appName={state.appName}
                  appIcon={state.appIcon}
                  connectedCanvas={state.connectedCanvas}
                  disabled={busy}
                  selectedForDesign={selectedSlideIds}
                  showDesignSelection={designScope === "selected"}
                  onToggleDesignSelection={(id) =>
                    setSelectedSlideIds((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onReorder={reorderSlides}
                  onSelect={setActiveSlideId}
                  onDelete={deleteSlide}
                  onDuplicate={duplicateSlide}
                  onAdd={addSlide}
                />
              </section>
            )}
            {inspectorPresence.mounted && (
              <section
                id="screen-settings-panel"
                aria-label={t("toolbar.settings")}
                data-state={inspectorPresence.state}
                className={cn(PANEL_SURFACE, PANEL_MOTION_RIGHT, "absolute bottom-32 right-[76px] top-3 z-20 flex w-[250px] max-w-[78vw] flex-col sm:top-4")}
                style={
                  geometry.phone
                    ? undefined
                    : { bottom: geometry.panelBottom, right: geometry.inspectorRight }
                }
              >
                {activeSlide && !pendingDesign && !generatingDesign ? (
                  <Inspector
                    slide={activeSlide}
                    artworkColor={activeSlide.inverted ? theme.fgAlt : theme.fg}
                    device={state.device}
                    orientation={state.orientation}
                    locale={state.locale}
                    locales={state.locales}
                    selectedElementId={
                      selectedElement?.slideId === activeSlide.id
                        ? selectedElement.elementId
                        : null
                    }
                    onChange={(patch) => patchSlide(activeSlide.id, patch)}
                    onSelectElement={(elementId) =>
                      setSelectedElement(
                        elementId ? { slideId: activeSlide.id, elementId } : null,
                      )
                    }
                  />
                ) : pendingDesign || generatingDesign ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 text-primary shadow-sm">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <p className="font-medium text-foreground">
                      {pendingDesign ? t("design.reviewProposal") : t("design.creatingRedesign")}
                    </p>
                    <p className="text-xs">
                      {pendingDesign ? t("design.reviewHint") : t("design.pausedHint")}
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 shadow-sm">
                      <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    <p className="font-medium text-foreground">{t("toasts.nothingToInspect")}</p>
                    <p className="text-xs">{t("toasts.settingsWillAppear")}</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* AI proposal review — floats top-center, above everything. */}
        {pendingDesign && (
          <div
            className="absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border/80 bg-card p-1.5 shadow-pop motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2"
            style={
              geometry.phone
                ? undefined
                : { left: `calc(${geometry.leftEdge}px + (100% - ${geometry.leftEdge + geometry.rightEdge}px) / 2)` }
            }
          >
            <div className="mr-1 hidden items-center gap-1.5 px-2 text-caption font-medium sm:flex">
              <Eye className="h-3.5 w-3.5" /> {t("design.aiPreview")}
            </div>
            <Button
              type="button"
              size="sm"
              variant={!showProposal ? "default" : "ghost"}
              className="h-8 text-footnote"
              onClick={() => setShowProposal(false)}
            >
              <EyeOff className="h-3.5 w-3.5" /> {t("design.before")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={showProposal ? "default" : "ghost"}
              className="h-8 text-footnote"
              onClick={() => setShowProposal(true)}
            >
              <Eye className="h-3.5 w-3.5" /> {t("design.after")}
            </Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <Button type="button" size="sm" className="h-8 text-footnote" onClick={applyPendingDesign}>
              <Check className="h-3.5 w-3.5" /> {t("design.apply")}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={discardPendingDesign}
              title={t("design.discardRedesign")}
              aria-label={t("design.discardRedesign")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Composer — floating bottom center (Stitch's prompt bar). */}
        <div
          className={cn("absolute inset-x-3 bottom-3 z-30 sm:block", !chatOpen && "hidden")}
          style={
            geometry.phone
              ? undefined
              : { left: geometry.composer.left, right: geometry.composer.right, bottom: 20 }
          }
        >
          <div ref={composerRef} className="mx-auto w-full max-w-[640px]">
          <DesignComposer
            scope={designScope}
            onScopeChange={(scope) => {
              setDesignScope(scope);
              if (scope === "selected") showLeft("screens");
            }}
            targetCount={targetSlideIds.length}
            generating={generatingDesign}
            onSubmit={generateDesign}
            onCancel={() => designAbortRef.current?.abort()}
            disabled={busy}
          />
          </div>
        </div>
      </div>

      {/* Off-screen export container — full-resolution canvases for html-to-image. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {currentSlides.length > 0 && (
          <div
            ref={exportRef}
            style={{
              width: cW,
              height: cH,
              overflow: "hidden",
              position: "absolute",
              left: -99999,
              top: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -exportSlideIndex * cW,
                top: 0,
                width: cW * currentSlides.length,
                height: cH,
              }}
            >
              <DeckCanvas
                slides={currentSlides}
                device={state.device}
                orientation={state.orientation}
                theme={canonicalTheme}
                locale={exportLocaleOverride ?? state.locale}
                appName={state.appName}
                appIcon={state.appIcon}
                connectedCanvas={state.connectedCanvas}
                hideEmpty
              />
            </div>
          </div>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        groups={paletteGroups}
      />
    </div>
  );
}

// Toasts rise from the bottom center, just above the AI composer: clear of
// the toolbar's Export button and both side panels. Follows the workspace
// theme (the html class), which the toggle can flip at any time.
function EditorToaster({ bottom }: { bottom: number }) {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("screenova-dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return (
    <Toaster
      position="bottom-center"
      offset={{ bottom }}
      mobileOffset={{ bottom: 16 }}
      theme={dark ? "dark" : "light"}
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "rounded-lg font-sans shadow-pop", title: "text-footnote font-medium", description: "text-caption" } }}
    />
  );
}

// Every floating editor surface (panels, rail, pill) shares one material:
// opaque card, hairline border, the subtle card shadow. No backdrop blur —
// it repainted under every pan frame.
const PANEL_SURFACE = "overflow-hidden rounded-lg border border-border/80 bg-card shadow-card";
// Panel motion (DESIGN.md: explain panel changes): 200ms ease-out in from the
// panel's own edge, 120ms ease-in out; a leaving panel never takes clicks.
const PANEL_MOTION =
  "ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-short data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-micro data-[state=closed]:ease-in data-[state=closed]:fill-mode-forwards";
const PANEL_MOTION_LEFT = `${PANEL_MOTION} data-[state=open]:slide-in-from-left-3 data-[state=closed]:slide-out-to-left-3`;
const PANEL_MOTION_RIGHT = `${PANEL_MOTION} data-[state=open]:slide-in-from-right-3 data-[state=closed]:slide-out-to-right-3`;

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "screenshots"
  );
}

async function captureSlideForModel(el: HTMLElement, sourceW: number, sourceH: number) {
  const scale = Math.min(1, 1024 / Math.max(sourceW, sourceH));
  const outputW = Math.max(1, Math.round(sourceW * scale));
  const outputH = Math.max(1, Math.round(sourceH * scale));
  const prev = {
    left: el.style.left,
    top: el.style.top,
    position: el.style.position,
    transform: el.style.transform,
    transformOrigin: el.style.transformOrigin,
    zIndex: el.style.zIndex,
  };
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.position = "absolute";
  el.style.transform = "none";
  el.style.transformOrigin = "top left";
  el.style.zIndex = "-1";
  try {
    return await toJpeg(el, {
      width: sourceW,
      height: sourceH,
      canvasWidth: outputW,
      canvasHeight: outputH,
      pixelRatio: 1,
      quality: 0.82,
      cacheBust: false,
      skipFonts: true,
      backgroundColor: "#ffffff",
    });
  } finally {
    el.style.left = prev.left || "-99999px";
    el.style.top = prev.top || "0px";
    el.style.position = prev.position || "absolute";
    el.style.transform = prev.transform;
    el.style.transformOrigin = prev.transformOrigin;
    el.style.zIndex = prev.zIndex;
  }
}

async function uploadDesignReference(
  reference: DesignReference,
  t: ReturnType<typeof useT>["t"],
): Promise<string> {
  const { path, error: uploadError } = await uploadImage(reference.dataUrl);
  if (!path) throw new Error(uploadError ?? t("toasts.saveReferenceFailed", { name: reference.name }));
  return path;
}

function chatId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function slideNeedsScreenshot(device: Device, slide: Slide) {
  if (device === "feature-graphic") return false;
  return slide.layout !== "no-device" && slide.layout !== "feature-graphic";
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
