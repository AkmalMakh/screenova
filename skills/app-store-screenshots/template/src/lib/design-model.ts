import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

// One way for every design route to ask a model for a structured design.
//
// DESIGN_PROVIDER=anthropic sends design work to Claude. First drafts (a new
// deck, an App Store import) go to Opus at high effort: that draft is the
// moment a new user decides whether Screenova is worth it. Measured on a real
// import, Fable 5.1 drew a nearly identical deck at 2.4x the cost and slower,
// so Opus is the default (ANTHROPIC_DRAFT_MODEL switches it). Chat edits go
// back and forth, so they use a faster model. Anything else keeps OpenAI, which is
// also where background artwork always goes: Claude does not generate images.

export type DesignTask = "draft" | "edit";
export type DesignPart =
  | { type: "text"; text: string }
  | { type: "image"; url: string; detail?: "auto" | "high" };

type ClaudeSpec = { env: string; fallback: string; effort: "medium" | "high"; maxTokens: number; cacheSystem: boolean };

const CLAUDE: Record<DesignTask, ClaudeSpec> = {
  // Draft prompts change with every request's languages and screen count, so
  // caching them would only pay the cache-write premium.
  draft: { env: "ANTHROPIC_DRAFT_MODEL", fallback: "claude-opus-5-5", effort: "high", maxTokens: 64_000, cacheSystem: false },
  edit: { env: "ANTHROPIC_EDIT_MODEL", fallback: "claude-sonnet-5-5", effort: "medium", maxTokens: 32_000, cacheSystem: true },
};

// Claude bills images by area. A phone screenshot's UI text stays legible at
// this long edge, at well under half the tokens of a full-resolution capture.
export const CLAUDE_IMAGE_EDGE = 1568;
const CLAUDE_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function designProvider(): "anthropic" | "openai" {
  return process.env.DESIGN_PROVIDER === "anthropic" ? "anthropic" : "openai";
}

export function designModel(task: DesignTask): string {
  if (designProvider() === "openai") return process.env.OPENAI_DESIGN_MODEL || "gpt-5.6-terra";
  return process.env[CLAUDE[task].env] || CLAUDE[task].fallback;
}

/** Null when the configured provider has its key; otherwise copy for a 503. */
export function designConfigError(): string | null {
  if (designProvider() === "anthropic") {
    return process.env.ANTHROPIC_API_KEY ? null : "Claude is not configured. Add ANTHROPIC_API_KEY to .env.local.";
  }
  return process.env.OPENAI_API_KEY ? null : "OpenAI is not configured. Add OPENAI_API_KEY to .env.local.";
}

/** A provider rejected or failed the call; retrying the same request won't help. */
export function isProviderError(error: unknown): boolean {
  return error instanceof OpenAI.APIError || error instanceof Anthropic.APIError;
}

export async function generateDesign<Schema extends z.ZodType>(request: {
  task: DesignTask;
  system: string;
  content: DesignPart[];
  schema: Schema;
  name: string;
  signal?: AbortSignal;
}): Promise<z.infer<Schema> | null> {
  return designProvider() === "anthropic" ? viaClaude(request) : viaOpenAI(request);
}

async function viaOpenAI<Schema extends z.ZodType>({ task, system, content, schema, name, signal }: {
  task: DesignTask; system: string; content: DesignPart[]; schema: Schema; name: string; signal?: AbortSignal;
}): Promise<z.infer<Schema> | null> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const started = Date.now();
  const response = await client.responses.parse(
    {
      model: designModel(task),
      instructions: system,
      input: [{
        role: "user",
        content: content.map((part) => part.type === "text"
          ? { type: "input_text" as const, text: part.text }
          : { type: "input_image" as const, image_url: part.url, detail: part.detail ?? "auto" }),
      }],
      reasoning: { effort: "medium" },
      text: { format: zodTextFormat(schema, name) },
      store: false,
    },
    { signal },
  );
  console.info("screenova_ai_usage", {
    task,
    model: response.model,
    ms: Date.now() - started,
    input: response.usage?.input_tokens ?? null,
    cacheRead: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    output: response.usage?.output_tokens ?? null,
    thinking: response.usage?.output_tokens_details?.reasoning_tokens ?? null,
  });
  return (response.output_parsed as z.infer<Schema> | null) ?? null;
}

// Claude's guaranteed-JSON mode compiles the schema into a grammar with a size
// limit. The full deck schema (copy per language, transforms, decorations)
// exceeds it, so those schemas fall back to plain JSON with the schema in the
// prompt, validated by the same zod schema here. Remembered per schema name so
// only the first request on an instance pays for the refused call.
const PROMPTED_SCHEMAS = new Set<string>();
const GRAMMAR_TOO_LARGE = /grammar is too large|schema is too (?:large|complex)/i;

async function viaClaude<Schema extends z.ZodType>({ task, system, content, schema, name, signal }: {
  task: DesignTask; system: string; content: DesignPart[]; schema: Schema; name: string; signal?: AbortSignal;
}): Promise<z.infer<Schema> | null> {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const part of content) {
    blocks.push(part.type === "text" ? { type: "text", text: part.text } : await claudeImage(part.url));
  }
  if (!PROMPTED_SCHEMAS.has(name)) {
    try {
      const message = await callClaude(task, system, blocks, signal, zodOutputFormat(schema));
      return (message.parsed_output as z.infer<Schema> | null) ?? null;
    } catch (error) {
      if (!(error instanceof Anthropic.APIError && error.status === 400 && GRAMMAR_TOO_LARGE.test(error.message))) throw error;
      PROMPTED_SCHEMAS.add(name);
    }
  }
  const instructions = `${system}

RESPONSE FORMAT
Reply with exactly one JSON object and nothing else: no prose, no code fences. Every property in the schema is required; use null where the schema allows it. It must validate against this JSON Schema:
${JSON.stringify(z.toJSONSchema(schema))}`;
  const message = await callClaude(task, instructions, blocks, signal);
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model returned no design.");
  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("The model returned a design that isn't valid JSON.");
  }
  let parsed = schema.safeParse(value);
  // A two-minute draft shouldn't be thrown away because a summary ran past
  // its length limit: trim, clamp and cut what overran, then check again.
  for (let round = 0; !parsed.success && round < 3 && repairOverruns(value, parsed.error.issues); round += 1) {
    parsed = schema.safeParse(value);
  }
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`The model returned an invalid design${issue ? ` (${issue.path.join(".") || "root"}: ${issue.code}, ${issue.message})` : ""}.`);
  }
  return parsed.data;
}

/** Fixes length and range overruns in place; true when anything changed. */
export function repairOverruns(value: unknown, issues: z.core.$ZodIssue[]): boolean {
  let changed = false;
  for (const issue of issues) {
    if (issue.code !== "too_big" && issue.code !== "too_small") continue;
    const key = issue.path[issue.path.length - 1];
    let parent: unknown = value;
    for (const step of issue.path.slice(0, -1)) parent = (parent as Record<PropertyKey, unknown> | null)?.[step as PropertyKey];
    if (parent === null || typeof parent !== "object" || key === undefined) continue;
    const container = parent as Record<PropertyKey, unknown>;
    const current = container[key as PropertyKey];
    const limit = Number(issue.code === "too_big" ? issue.maximum : issue.minimum);
    if (!Number.isFinite(limit)) continue;
    if (issue.code === "too_big" && typeof current === "string") container[key as PropertyKey] = current.slice(0, limit).trimEnd();
    else if (issue.code === "too_big" && Array.isArray(current)) container[key as PropertyKey] = current.slice(0, limit);
    else if (typeof current === "number") container[key as PropertyKey] = issue.code === "too_big" ? Math.min(current, limit) : Math.max(current, limit);
    else continue;
    changed = true;
  }
  return changed;
}

async function callClaude(
  task: DesignTask,
  system: string,
  blocks: Anthropic.ContentBlockParam[],
  signal: AbortSignal | undefined,
  format?: ReturnType<typeof zodOutputFormat>,
) {
  const spec = CLAUDE[task];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // Streamed so a long, high-effort draft never trips the SDK's limit on
  // non-streaming calls; only the final message is used.
  const started = Date.now();
  const stream = client.messages.stream(
    {
      model: designModel(task),
      max_tokens: spec.maxTokens,
      system: [{ type: "text", text: system, ...(spec.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}) }],
      messages: [{ role: "user", content: blocks }],
      output_config: { effort: spec.effort, ...(format ? { format } : {}) },
    },
    { signal },
  );
  const message = await stream.finalMessage();
  // One line per call in the server log: what each draft and edit really costs.
  console.info("screenova_ai_usage", {
    task,
    model: message.model,
    mode: format ? "structured" : "prompted",
    ms: Date.now() - started,
    input: message.usage.input_tokens,
    cacheRead: message.usage.cache_read_input_tokens ?? 0,
    cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
    output: message.usage.output_tokens,
    thinking: message.usage.output_tokens_details?.thinking_tokens ?? null,
    stop: message.stop_reason,
  });
  if (message.stop_reason === "max_tokens") throw new Error("The design ran too long and was cut off. Try fewer screens or languages.");
  if (message.stop_reason === "refusal") throw new Error("Claude declined to design this. Try different screenshots or wording.");
  return message;
}

// Data URLs (uploads, previews) are shrunk and inlined; remote App Store
// reference images are fetched by Anthropic, as OpenAI fetched them before.
async function claudeImage(url: string): Promise<Anthropic.ImageBlockParam> {
  if (/^https?:\/\//i.test(url)) return { type: "image", source: { type: "url", url } };
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
  if (!match) throw new Error("A design image could not be read.");
  const { mime, data } = await fitForClaude(match[1].toLowerCase(), Buffer.from(match[2], "base64"));
  return { type: "image", source: { type: "base64", media_type: mime, data: data.toString("base64") } };
}

export async function fitForClaude(mime: string, input: Buffer): Promise<{ mime: Anthropic.Base64ImageSource["media_type"]; data: Buffer }> {
  const { default: sharp } = await import("sharp");
  const image = sharp(input, { failOn: "none" });
  const { width = 0, height = 0 } = await image.metadata();
  const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
  if (Math.max(width, height) <= CLAUDE_IMAGE_EDGE && CLAUDE_MEDIA.has(normalized)) {
    return { mime: normalized as Anthropic.Base64ImageSource["media_type"], data: input };
  }
  const data = await image
    .resize({ width: CLAUDE_IMAGE_EDGE, height: CLAUDE_IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return { mime: "image/jpeg", data };
}
