import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { authorizeRequest, type Access } from "@/lib/supabase/access";
import { storeAsset } from "@/lib/supabase/assets";
import { isDesignImageSource, resolveDesignImage } from "@/lib/supabase/design-images";
import {
  designProposalResponseSchema,
  normalizeDesignResponse,
  type DesignRequest,
  type DesignProposal,
  type GeneratedVisualAsset,
} from "@/lib/design";
import { CANVAS } from "@/lib/constants";
import type { ProjectState, Slide } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_PROMPT_LENGTH = 4_000;
const MAX_CONVERSATION_MESSAGES = 12;
const MAX_REFERENCES = 3;
const GENERATED_ASSET_DIR = path.join("public", "screenshots", "generated-ai");
const GENERATED_ASSET_PUBLIC_PREFIX = "/screenshots/generated-ai";

const SYSTEM_PROMPT = `You are the design engine inside an App Store screenshot editor.
Return an editable design proposal, never a rasterized final image and never code.

Goals:
- Make the requested screens feel like one intentional, premium campaign.
- Preserve existing product screenshots and their locale mappings exactly.
- When the user asks to add or create a screen from an attachment, create it in newSlides and use that attachment's exact sourceReferenceId.
- If the request only asks to add or create screens, leave slidePatches empty and theme null unless the user explicitly asks to change existing screens too.
- Use concise, outcome-led App Store copy that remains readable at thumbnail size.
- Vary composition across adjacent screens while maintaining a consistent visual system.
- Prefer a small number of purposeful editable decorations over visual clutter.
- When the user explicitly asks for generated artwork, imagery, or a visual background, set visualAssetPrompt on the relevant patch or new slide. Otherwise use null.

Hard constraints:
- Only patch the supplied existing slide IDs. Never invent or request a destination slide ID; the editor assigns IDs to new slides.
- Treat attachments as visual references unless the user's request clearly asks to make one a new screen's primary product screenshot.
- A new slide must reference an attachment supplied in the request. Do not put screenshot paths in the response.
- visualAssetPrompt describes a full-canvas atmospheric backdrop only. It must request no words, letters, logos, UI, device frames, or app screenshots; those remain editable editor layers.
- Request no more than three generated visual assets in one proposal. Use visualAssetOpacity to keep text and devices readable.
- Coordinates are full-resolution canvas pixels and are local to each screen.
- Keep important text and devices inside the screen bounds. Decorative elements may bleed slightly.
- Use only the supported layouts and decoration kinds in the response schema.
- Do not invent new screenshot paths, app features, testimonials, prices, or factual claims.
- Return complete replacement arrays when textElements or decorations are present.
- Every response field is required. Use null for any optional change you do not want to make.
- Return empty slidePatches or newSlides arrays when that operation is not needed.
- label, headline, and custom text values are plain strings for the active locale.
- headlineFontFamily may be modern, editorial, geometric, rounded, mono, or null to preserve it.
- Use unique element IDs within each slide.
- Keep decoration z-index below text where possible; devices normally use z-index 3 and captions 4.
- All colors must be six-digit hex values.`;

export async function POST(req: Request) {
  const access = await authorizeRequest(req, "ai");
  if ("response" in access) return access.response;
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OpenAI is not configured. Add OPENAI_API_KEY to .env.local." },
      { status: 503 },
    );
  }

  let body: DesignRequest;
  try {
    body = (await req.json()) as DesignRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON request." }, { status: 400 });
  }

  const validation = validateRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  try {
    // Sequential resolution bounds transient memory when redesigning a full deck.
    let imageBytes = 0;
    for (const image of [...body.renderedPreviews, ...body.references]) {
      image.dataUrl = await resolveDesignImage(access, image.dataUrl);
      imageBytes += image.dataUrl.length;
      if (imageBytes > 90_000_000) throw new Error("Images too large");
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Design images are unavailable, invalid, or too large. Please upload them again." }, { status: 400 });
  }

  const { project, targetSlides } = validation;
  const userContent: OpenAI.Responses.ResponseInputContent[] = [
    {
      type: "input_text",
      text: buildDesignBrief(body, project, targetSlides),
    },
  ];

  for (const preview of body.renderedPreviews) {
    userContent.push({
      type: "input_text",
      text: `CURRENT SCREEN PREVIEW — slideId: ${preview.slideId}`,
    });
    userContent.push({ type: "input_image", image_url: preview.dataUrl, detail: "auto" });
  }
  for (const reference of body.references) {
    userContent.push({
      type: "input_text",
      text: `ATTACHMENT — sourceReferenceId: ${reference.id}; filename: ${reference.name}`,
    });
    userContent.push({ type: "input_image", image_url: reference.dataUrl, detail: "auto" });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_DESIGN_MODEL || "gpt-5.6-terra";

  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.responses.parse(
          {
            model,
            instructions: SYSTEM_PROMPT,
            input: [{ role: "user", content: userContent }],
            reasoning: { effort: "medium" },
            text: {
              format: zodTextFormat(
                designProposalResponseSchema,
                "app_store_design_proposal",
              ),
            },
            store: false,
          },
          { signal: req.signal },
        );
        if (!response.output_parsed) {
          throw new Error("The model returned no structured proposal.");
        }
        const normalizedProposal = normalizeDesignResponse(response.output_parsed, project.locale);
        const proposal =
          normalizedProposal.slidePatches.length === 0
            ? { ...normalizedProposal, theme: undefined }
            : normalizedProposal;
        assertProposalScope(proposal.targetSlideIds, body.scope.slideIds);
        assertNewSlideReferences(
          proposal.newSlides?.map((slide) => slide.sourceReferenceId) || [],
          body.references.map((reference) => reference.id),
        );
        const generatedVisualAssets = await generateVisualAssets(client, proposal, project, access);
        return NextResponse.json({ ok: true, proposal, generatedVisualAssets });
      } catch (error) {
        lastError = error;
        if (!isRetryableStructureError(error) || attempt === 1) throw error;
      }
    }
    throw lastError;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      const status = error.status || 502;
      const message =
        status === 401
          ? "The OpenAI API key was rejected."
          : status === 429
            ? "OpenAI is rate-limited right now. Try again shortly."
            : status >= 500
              ? "OpenAI could not generate a design right now. Try again."
              : error.message;
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    if (req.signal.aborted) {
      return NextResponse.json({ ok: false, error: "Design request cancelled." }, { status: 499 });
    }
    const message = error instanceof Error ? error.message : "Design generation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

function validateRequest(
  value: DesignRequest,
):
  | { ok: true; project: ProjectState; targetSlides: Slide[] }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Missing request body." };
  if (typeof value.prompt !== "string" || !value.prompt.trim()) {
    return { ok: false, error: "Write a design prompt first." };
  }
  if (value.prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: `Prompt is too long (maximum ${MAX_PROMPT_LENGTH} characters).` };
  }
  if (!value.project || typeof value.project !== "object") {
    return { ok: false, error: "Missing project state." };
  }
  const project = value.project as ProjectState;
  if (!Object.hasOwn(CANVAS, project.device) || typeof project.locale !== "string") {
    return { ok: false, error: "Invalid device or project language." };
  }
  const slides = project.slidesByDevice?.[project.device];
  if (!Array.isArray(slides)) return { ok: false, error: "Active deck is invalid." };
  if (slides.some((slide) => !slide || typeof slide.id !== "string")) {
    return { ok: false, error: "Active deck is invalid." };
  }
  if (!value.scope || !["current", "selected", "deck"].includes(value.scope.type)) {
    return { ok: false, error: "Invalid design scope." };
  }
  if (!Array.isArray(value.scope.slideIds)) {
    return { ok: false, error: "Invalid screen selection." };
  }
  if (value.scope.slideIds.length > 20 || value.scope.slideIds.some((id) => typeof id !== "string")) {
    return { ok: false, error: "Select at most 20 valid screens." };
  }
  const requestedIds = new Set(value.scope.slideIds);
  if (requestedIds.size !== value.scope.slideIds.length) {
    return { ok: false, error: "Design scope contains duplicate screens." };
  }
  const targetSlides = slides.filter((slide) => requestedIds.has(slide.id));
  if (targetSlides.length !== requestedIds.size) {
    return { ok: false, error: "Design scope includes an unknown screen." };
  }
  if (!Array.isArray(value.renderedPreviews) || value.renderedPreviews.length !== targetSlides.length) {
    return { ok: false, error: "A rendered preview is required for every target screen." };
  }
  if (value.renderedPreviews.some((preview) => !preview || typeof preview.slideId !== "string")) {
    return { ok: false, error: "Invalid rendered preview." };
  }
  const previewIds = new Set(value.renderedPreviews.map((preview) => preview.slideId));
  if (previewIds.size !== requestedIds.size || [...requestedIds].some((id) => !previewIds.has(id))) {
    return { ok: false, error: "Rendered previews do not match the selected screens." };
  }
  if (!Array.isArray(value.references) || value.references.length > MAX_REFERENCES) {
    return { ok: false, error: `Attach at most ${MAX_REFERENCES} reference images.` };
  }
  if (value.references.some((reference) => !reference || typeof reference !== "object")) {
    return { ok: false, error: "Invalid attachment." };
  }
  if (value.conversation !== undefined && (!Array.isArray(value.conversation) || value.conversation.some(
    (message) => !message || !["user", "assistant"].includes(message.role) || typeof message.text !== "string",
  ))) {
    return { ok: false, error: "Invalid conversation." };
  }
  if (value.scope.slideIds.length === 0 && value.references.length === 0) {
    return { ok: false, error: "Select a screen or attach an image to create one." };
  }
  const referenceIds = new Set(value.references.map((reference) => reference.id));
  if (
    referenceIds.size !== value.references.length ||
    value.references.some(
      (reference) =>
        typeof reference.id !== "string" ||
        !reference.id.trim() ||
        reference.id.length > 120 ||
        typeof reference.name !== "string" ||
        !reference.name.trim(),
    )
  ) {
    return { ok: false, error: "One or more attachment identifiers are invalid." };
  }
  const images = [
    ...value.renderedPreviews.map((preview) => preview.dataUrl),
    ...value.references.map((reference) => reference.dataUrl),
  ];
  if (
    images.some(
      (dataUrl) =>
        !isDesignImageSource(dataUrl),
    )
  ) {
    return { ok: false, error: "One or more images are invalid or larger than 8 MB." };
  }
  return { ok: true, project, targetSlides };
}

function buildDesignBrief(body: DesignRequest, project: ProjectState, slides: Slide[]): string {
  const canvas = CANVAS[project.device];
  const dimensions =
    project.orientation === "landscape" && canvas.wL && canvas.hL
      ? { width: canvas.wL, height: canvas.hL }
      : { width: canvas.w, height: canvas.h };
  const conversation = (body.conversation || [])
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((message) => `${message.role}: ${message.text.slice(0, 1_500)}`)
    .join("\n");
  const safeSlides = slides.map((slide) => ({
    id: slide.id,
    layout: slide.layout,
    label: slide.label,
    headline: slide.headline,
    headlineFontFamily: slide.headlineFontFamily || "modern",
    inverted: !!slide.inverted,
    transforms: slide.transforms || {},
    textElements: slide.textElements || [],
    decorations: slide.decorations || [],
    hasPrimaryScreenshot: !!slide.screenshot,
    hasSecondaryScreenshot: !!slide.screenshotSecondary,
    hasGeneratedVisualAsset: !!slide.visualAsset,
  }));

  return `USER REQUEST\n${body.prompt.trim()}\n\nPROJECT CONTEXT\n${JSON.stringify(
    {
      appName: project.appName,
      device: project.device,
      orientation: project.orientation,
      activeLocale: project.locale,
      connectedCanvas: project.connectedCanvas,
      canvas: dimensions,
      scope: body.scope,
      theme:
        project.customThemesByDevice?.[project.device] ||
        project.customTheme ||
        { id: project.themeId },
      slides: safeSlides,
      attachments: body.references.map((reference) => ({
        sourceReferenceId: reference.id,
        filename: reference.name,
      })),
    },
    null,
    2,
  )}\n\nRECENT CONVERSATION\n${conversation || "None"}\n\nIMAGE ORDER\nThe first ${
    body.renderedPreviews.length
  } image(s) are the current rendered target screens in slide order. The remaining ${
    body.references.length
  } image(s) are attachments. If the user asks to create a screen from an attachment, use its sourceReferenceId in newSlides so the editor can save it as the primary screenshot.`;
}

function assertProposalScope(proposed: string[], allowed: string[]) {
  const allowedIds = new Set(allowed);
  if (proposed.some((id) => !allowedIds.has(id))) {
    throw new Error("The model attempted to edit a screen outside the selected scope.");
  }
}

function assertNewSlideReferences(proposed: string[], supplied: string[]) {
  const suppliedIds = new Set(supplied);
  if (proposed.some((id) => !suppliedIds.has(id))) {
    throw new Error("The model attempted to create a screen from an unknown attachment.");
  }
}

async function generateVisualAssets(
  client: OpenAI,
  proposal: DesignProposal,
  project: ProjectState,
  access: Access,
): Promise<GeneratedVisualAsset[]> {
  const requests: Array<
    | { targetType: "existing"; targetId: string; prompt: string }
    | { targetType: "new"; targetIndex: number; prompt: string }
  > = [
    ...proposal.slidePatches.flatMap((patch) =>
      patch.visualAssetPrompt
        ? [{ targetType: "existing" as const, targetId: patch.slideId, prompt: patch.visualAssetPrompt }]
        : [],
    ),
    ...(proposal.newSlides || []).flatMap((slide, targetIndex) =>
      slide.visualAssetPrompt
        ? [{ targetType: "new" as const, targetIndex, prompt: slide.visualAssetPrompt }]
        : [],
    ),
  ];
  if (!requests.length) return [];

  const canvas = CANVAS[project.device];
  const width =
    project.orientation === "landscape" && canvas.wL ? canvas.wL : canvas.w;
  const height =
    project.orientation === "landscape" && canvas.hL ? canvas.hL : canvas.h;
  const size = generatedImageSize(width, height);
  return Promise.all(
    requests.map(async (request) => {
      const generatedPath = await generateVisualAsset(client, request.prompt, size, access);
      return request.targetType === "existing"
        ? { targetType: "existing", targetId: request.targetId, path: generatedPath }
        : { targetType: "new", targetIndex: request.targetIndex, path: generatedPath };
    }),
  );
}

function generatedImageSize(width: number, height: number): string {
  const scale = Math.min(1, 1_536 / Math.max(width, height));
  let outputWidth = Math.max(16, Math.round((width * scale) / 16) * 16);
  let outputHeight = Math.max(16, Math.round((height * scale) / 16) * 16);
  if (outputWidth * outputHeight < 655_360) {
    const boost = Math.sqrt(655_360 / (outputWidth * outputHeight));
    outputWidth = Math.ceil((outputWidth * boost) / 16) * 16;
    outputHeight = Math.ceil((outputHeight * boost) / 16) * 16;
  }
  return `${outputWidth}x${outputHeight}`;
}

async function generateVisualAsset(client: OpenAI, prompt: string, size: string, access: Access): Promise<string> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const finalPrompt = [
    "Create a premium full-canvas visual backdrop for an App Store screenshot campaign.",
    prompt,
    "No text, letters, numbers, logos, UI, screenshots, device frames, badges, or watermarks.",
    "Keep the composition restrained with useful negative space and strong readability for foreground typography and a product device.",
  ].join(" ");
  const cacheKey = createHash("sha256")
    .update(JSON.stringify({ model, size, prompt: finalPrompt, quality: "medium" }))
    .digest("hex")
    .slice(0, 24);
  const publicPath = `${GENERATED_ASSET_PUBLIC_PREFIX}/${cacheKey}.jpg`;
  const absolutePath = path.join(process.cwd(), GENERATED_ASSET_DIR, `${cacheKey}.jpg`);

  try {
    if (access.client) throw new Error("Private assets do not use the shared local cache");
    await fs.access(absolutePath);
    return publicPath;
  } catch {
    // Generate the content-addressed asset when it is not already cached.
  }

  const result = await client.images.generate({
    model,
    prompt: finalPrompt,
    size,
    quality: "medium",
    output_format: "jpeg",
    output_compression: 88,
    background: "opaque",
  });
  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new Error("GPT Image returned no visual asset.");
  if (access.client) return storeAsset(access, Buffer.from(encoded, "base64"), "image/jpeg");
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(encoded, "base64"));
  return publicPath;
}

function isRetryableStructureError(error: unknown) {
  if (error instanceof OpenAI.APIError) return false;
  return error instanceof Error;
}
