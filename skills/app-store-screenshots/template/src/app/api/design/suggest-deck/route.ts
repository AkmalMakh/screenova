import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildDeckPrompt,
  buildDeckSchema,
  DECK_DEVICE_LAYOUTS,
  DECK_SLIDE_LAYOUTS,
  DEFAULT_DECK_COUNT,
  MAX_DECK_SLIDES,
  MIN_DECK_SLIDES,
  normalizeDeck,
} from "@/lib/suggest-deck";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_MESSAGES = 12;
const MAX_SCREENSHOTS = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Sanity cap for one request: 10 screenshots at the 8MB limit would be ~110MB
// of base64 in the OpenAI payload, which is far beyond what is reasonable.
const MAX_TOTAL_IMAGE_BYTES = 64 * 1024 * 1024;
const localeCode = /^[a-z]{2,8}(-[A-Za-z]{2,8})?$/i;

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4_000),
});

// Only accept paths shaped exactly like what /api/upload produces
// (/screenshots/uploaded/<sha1-hex>.<ext>). Never read anything else off disk.
const screenshotInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  path: z
    .string()
    .regex(/^\/screenshots\/uploaded\/[\w.-]+\.(png|jpe?g|webp)$/i)
    .refine((value) => path.posix.normalize(value) === value && !value.includes(".."), {
      message: "Invalid screenshot path",
    }),
});

const suggestDeckRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  locales: z.array(z.string().trim().regex(localeCode)).min(1).max(7),
  device: z.enum(["iphone", "ipad", "android"]),
  count: z.number().int().min(MIN_DECK_SLIDES).max(MAX_DECK_SLIDES).optional(),
  screenshots: z.array(screenshotInputSchema).min(1).max(MAX_SCREENSHOTS).optional(),
});

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OpenAI is not configured. Add OPENAI_API_KEY to .env.local." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON request." }, { status: 400 });
  }

  const validation = suggestDeckRequestSchema.safeParse(body);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return NextResponse.json(
      { ok: false, error: issue ? issue.message : "Invalid request." },
      { status: 400 },
    );
  }
  const { messages, locales, device, count } = validation.data;
  const screenshots = validation.data.screenshots ?? [];
  const withScreenshots = screenshots.length > 0;
  // One slide per attached screenshot, in order; otherwise the requested count.
  const deckCount = withScreenshots ? screenshots.length : count ?? DEFAULT_DECK_COUNT;
  const layouts = withScreenshots ? DECK_DEVICE_LAYOUTS : DECK_SLIDE_LAYOUTS;
  const responseSchema = buildDeckSchema(locales, deckCount, layouts);

  // The last user message is the description to draft from; earlier turns are
  // conversation context so refinements ("make it bolder") stay grounded.
  const conversation = messages
    .slice(-MAX_MESSAGES)
    .map((message) => `${message.role}: ${message.text.slice(0, 1_500)}`)
    .join("\n\n");

  // Build the input: description first, then one labeled image per screenshot.
  const userContent: OpenAI.Responses.ResponseInputContent[] = [
    {
      type: "input_text",
      text: `DESCRIPTION AND FEEDBACK\n${conversation}`,
    },
  ];
  if (withScreenshots) {
    let totalBytes = 0;
    for (let i = 0; i < screenshots.length; i += 1) {
      const entry = screenshots[i];
      const absPath = path.join(process.cwd(), "public", entry.path.slice(1));
      let buf: Buffer;
      try {
        buf = await fs.readFile(absPath);
      } catch {
        return NextResponse.json(
          { ok: false, error: `Uploaded screenshot ${entry.name} is missing from the server.` },
          { status: 502 },
        );
      }
      if (buf.byteLength > MAX_IMAGE_BYTES) {
        return NextResponse.json({ ok: false, error: "Image too large (>8MB)." }, { status: 413 });
      }
      totalBytes += buf.byteLength;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Screenshots together are too large (>64MB)." },
          { status: 413 },
        );
      }
      const ext = entry.path.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || "png";
      const mime = MIME_BY_EXT[ext] || "image/png";
      userContent.push({
        type: "input_text",
        text: `SCREENSHOT ${i + 1} of ${screenshots.length} — ${entry.name}`,
      });
      userContent.push({
        type: "input_image",
        image_url: `data:${mime};base64,${buf.toString("base64")}`,
        detail: "auto",
      });
    }
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
            instructions: buildDeckPrompt(locales, device, deckCount, screenshots.length),
            input: [{ role: "user", content: userContent }],
            reasoning: { effort: "medium" },
            text: {
              format: zodTextFormat(responseSchema, "app_store_template_deck"),
            },
            store: false,
          },
          { signal: req.signal },
        );
        if (!response.output_parsed) {
          throw new Error("The model returned no template deck.");
        }
        const deck = normalizeDeck(response.output_parsed, locales, deckCount);
        if (!deck) {
          throw new Error("The model returned an invalid template deck.");
        }
        return NextResponse.json({ ok: true, deck });
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
              ? "OpenAI could not draft a template right now. Try again."
              : error.message;
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    if (req.signal.aborted) {
      return NextResponse.json(
        { ok: false, error: "Template generation cancelled." },
        { status: 499 },
      );
    }
    const message = error instanceof Error ? error.message : "Template generation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

function isRetryableStructureError(error: unknown) {
  if (error instanceof OpenAI.APIError) return false;
  return error instanceof Error;
}
