import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_SCREENSHOTS = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Sanity cap for one request: 10 screenshots at the 8MB limit would be ~110MB
// of base64 in the OpenAI payload, which is far beyond what is reasonable.
const MAX_TOTAL_IMAGE_BYTES = 64 * 1024 * 1024;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// Only accept paths shaped exactly like what /api/upload produces
// (/screenshots/uploaded/<sha1-hex>.<ext>) or what /api/app-store/import
// writes (/screenshots/app-store/<appId>/<file>.<ext>). Never read anything
// else off disk.
const screenshotInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  path: z
    .string()
    .regex(/^\/screenshots\/(?:uploaded\/[\w.-]+|app-store\/[\w.-]+\/[\w.-]+)\.(png|jpe?g|webp)$/i)
    .refine((value) => path.posix.normalize(value) === value && !value.includes(".."), {
      message: "Invalid screenshot path",
    }),
});

const localeCode = /^[a-z]{2,8}(-[A-Za-z]{2,8})?$/i;

const analyzeScreenshotsRequestSchema = z.object({
  appName: z.string().trim().min(1).max(60),
  locales: z.array(z.string().trim().regex(localeCode)).min(1).max(7),
  screenshots: z.array(screenshotInputSchema).min(1).max(MAX_SCREENSHOTS),
});

const slideLayoutSchema = z.enum([
  "hero",
  "device-bottom",
  "device-top",
  "two-devices",
  "no-device",
]);

const slideCopySchema = z.object({
  label: z.string().trim().min(1).max(40),
  headline: z.string().trim().min(1).max(120),
});

// Structured Outputs requires bounded object keys with
// additionalProperties: false. z.record() emits `propertyNames` (rejected by
// OpenAI), so build a literal-keyed z.object from the REQUEST's locales.
// Any future content language just flows through the request.
function buildResponseSchema(locales: string[]) {
  const copyByLocale: Record<string, typeof slideCopySchema> = {};
  for (const locale of locales) copyByLocale[locale] = slideCopySchema;
  return z.object({
    slides: z
      .array(
        z.object({
          layout: slideLayoutSchema,
          copy: z.object(copyByLocale),
        }),
      )
      .min(1)
      .max(MAX_SCREENSHOTS),
  });
}

function buildSystemPrompt(appName: string, locales: string[]) {
  return `You are the first-draft engine inside an App Store screenshot editor. A user is creating a new project from their product screenshots.

For each supplied screenshot, write exactly one slide:
- label: a short name for the feature or screen shown (≤40 characters). It renders as a small uppercase accent line.
- headline: punchy, outcome-led copy (≤120 characters). It renders as the main text. Keep it readable at thumbnail size.
- layout: the best-fit composition — "hero" for a launch or full-screen shot, "device-bottom" or "device-top" for feature screens, "two-devices" when the shot clearly shows two surfaces, "no-device" for close-ups or cropped detail shots.

Respond with one slide per input screenshot, in the same order — never more, never fewer.

For every slide, write label and headline in EACH of the project's languages: ${locales.join(", ")}. The response's copy object must contain an entry for every one of these locale codes, with no extra codes.

The brand tone is "${appName}". Never invent features, testimonials, prices, or facts beyond what the screenshot shows.`;
}

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

  const validation = analyzeScreenshotsRequestSchema.safeParse(body);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return NextResponse.json(
      { ok: false, error: issue ? issue.message : "Invalid request." },
      { status: 400 },
    );
  }
  const { appName, locales, screenshots } = validation.data;
  const responseSchema = buildResponseSchema(locales);

  // Read the uploaded files back from public/ and build the image inputs.
  const userContent: OpenAI.Responses.ResponseInputContent[] = [];
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

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_DESIGN_MODEL || "gpt-5.6-terra";

  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.responses.parse(
          {
            model,
            instructions: buildSystemPrompt(appName, locales),
            input: [{ role: "user", content: userContent }],
            reasoning: { effort: "medium" },
            text: {
              format: zodTextFormat(responseSchema, "app_store_slide_analysis"),
            },
            store: false,
          },
          { signal: req.signal },
        );
        if (!response.output_parsed) {
          throw new Error("The model returned no slide analysis.");
        }
        if (response.output_parsed.slides.length !== screenshots.length) {
          throw new Error(
            `Expected ${screenshots.length} slides, got ${response.output_parsed.slides.length}.`,
          );
        }
        for (const [index, slide] of response.output_parsed.slides.entries()) {
          for (const code of locales) {
            if (!slide.copy[code]) {
              throw new Error(`Slide ${index + 1} is missing copy for locale ${code}.`);
            }
          }
        }
        return NextResponse.json({ ok: true, slides: response.output_parsed.slides });
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
              ? "OpenAI could not analyze screenshots right now. Try again."
              : error.message;
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    if (req.signal.aborted) {
      return NextResponse.json(
        { ok: false, error: "Screenshot analysis cancelled." },
        { status: 499 },
      );
    }
    const message = error instanceof Error ? error.message : "Screenshot analysis failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

function isRetryableStructureError(error: unknown) {
  if (error instanceof OpenAI.APIError) return false;
  return error instanceof Error;
}
