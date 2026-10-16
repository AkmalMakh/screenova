import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/supabase/access";
import { z } from "zod";
import { normalizeLookupResult, parseAppStoreUrl } from "@/lib/app-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKUP_TIMEOUT_MS = 15_000;

const requestSchema = z.object({
  url: z.string().trim().min(8).max(500),
});

export async function POST(req: Request) {
  const access = await authorizeRequest(req, "import");
  if ("response" in access) return access.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON request." }, { status: 400 });
  }

  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { ok: false, error: "Enter an App Store link first." },
      { status: 400 },
    );
  }
  const link = parseAppStoreUrl(validation.data.url);
  if (!link) {
    return NextResponse.json(
      { ok: false, error: "That doesn't look like an App Store link." },
      { status: 400 },
    );
  }

  const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(link.appId)}&country=${encodeURIComponent(link.country)}`;
  try {
    const response = await fetch(lookupUrl, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `The App Store lookup failed (HTTP ${response.status}).` },
        { status: 502 },
      );
    }
    const app = normalizeLookupResult((await response.json()) as unknown, link);
    if (!app) {
      return NextResponse.json(
        { ok: false, error: "No app found for that link." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, app });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The App Store lookup failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
