import { NextResponse } from "next/server";
import { z } from "zod";
import { designConfigError, generateDesign } from "@/lib/design-model";
import { CONTENT_LANGUAGES } from "@/lib/locale";
import { report, requestIdOf } from "@/lib/ops";
import { aiErrorResponse } from "@/lib/openai-errors";
import { authorizeRequest } from "@/lib/supabase/access";
import { MAX_COPY_ITEMS, MAX_COPY_LENGTH, type Translations } from "@/lib/translate-copy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LANGUAGE_CODES = CONTENT_LANGUAGES.map((language) => language.code) as [string, ...string[]];
const languageName = (code: string) => CONTENT_LANGUAGES.find((language) => language.code === code)?.name ?? code;

const requestSchema = z.object({
  appName: z.string().trim().max(80).optional(),
  source: z.enum(LANGUAGE_CODES),
  targets: z.array(z.enum(LANGUAGE_CODES)).min(1).max(LANGUAGE_CODES.length),
  items: z
    .array(z.object({
      id: z.string().regex(/^t\d{1,4}$/),
      kind: z.enum(["label", "headline", "text"]),
      text: z.string().trim().min(1).max(MAX_COPY_LENGTH),
    }))
    .min(1)
    .max(MAX_COPY_ITEMS),
});

const replySchema = z.object({
  items: z.array(z.object({ id: z.string(), text: z.string().max(MAX_COPY_LENGTH * 2) })),
});

function prompt(appName: string, source: string, target: string) {
  return `You localize App Store screenshot captions${appName ? ` for the app "${appName}"` : ""}. Rewrite every item from ${languageName(source)} into ${languageName(target)} the way a native ${languageName(target)} App Store marketer would write it: natural, idiomatic and persuasive, never word for word.
- Keep each item about as long as its source: it has to fit the same text box on the screenshot.
- Items of kind "label" are short eyebrow keywords shown in capitals. Keep them to one to three words.
- Keep the app name, brand and product names as they are. Copy numbers, units and symbols exactly.
- Keep line breaks where the source has them.
- Return every id exactly once, with only the ${languageName(target)} text.`;
}

// Adding languages in the editor. One call per language, in parallel, so
// seven languages take about as long as one; a language that fails is
// reported back and the rest still land.
export async function POST(req: Request) {
  const access = await authorizeRequest(req, "ai_edit");
  if ("response" in access) return access.response;
  const configError = designConfigError();
  if (configError) return NextResponse.json({ ok: false, error: configError }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON request." }, { status: 400 });
  }
  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return NextResponse.json({ ok: false, error: issue ? issue.message : "Invalid request." }, { status: 400 });
  }
  const { appName = "", source, items } = validation.data;
  const targets = [...new Set(validation.data.targets)].filter((target) => target !== source);
  if (!targets.length) return NextResponse.json({ ok: true, translations: {}, failed: [] });

  const ids = new Map(items.map((item) => [item.id, item.text]));
  const content = [{ type: "text" as const, text: JSON.stringify({ items: items.map(({ id, kind, text }) => ({ id, kind, text })) }) }];
  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const reply = await generateDesign({
        task: "edit",
        system: prompt(appName, source, target),
        content,
        schema: replySchema,
        name: "localized_captions",
        signal: req.signal,
      });
      const written: Array<[string, string]> = [];
      for (const entry of reply?.items ?? []) {
        const original = ids.get(entry.id);
        const text = entry.text.trim();
        if (original && text) written.push([original, text]);
      }
      if (!written.length) throw new Error(`The AI returned no ${languageName(target)} text.`);
      return { target, written };
    }),
  );

  const translations: Translations = {};
  const failed: string[] = [];
  let firstError: unknown;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failed.push(targets[index]);
      firstError ??= result.reason;
      return;
    }
    for (const [original, text] of result.value.written) {
      (translations[original] ??= {})[result.value.target] = text;
    }
  });

  if (failed.length === targets.length) {
    const providerFailure = aiErrorResponse(firstError, "The AI could not write these languages right now. Try again.", req);
    if (providerFailure) return providerFailure;
    if (req.signal.aborted) return NextResponse.json({ ok: false, error: "Cancelled." }, { status: 499 });
    report("ai_translate_failed", firstError, { requestId: requestIdOf(req) });
    return NextResponse.json({ ok: false, error: "The AI could not write these languages right now. Try again." }, { status: 502 });
  }
  if (failed.length) console.warn("screenova_translate_partial", { failed, reason: firstError instanceof Error ? firstError.message : String(firstError) });
  return NextResponse.json({ ok: true, translations, failed });
}
