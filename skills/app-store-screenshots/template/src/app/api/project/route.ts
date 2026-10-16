import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRequest, privateHeaders } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

const projectSchema = z.object({
  appName: z.string(),
  slidesByDevice: z.record(z.string(), z.array(z.object({
    id: z.string().min(1),
    layout: z.string().min(1),
    label: z.union([z.string(), z.record(z.string(), z.string())]),
    headline: z.union([z.string(), z.record(z.string(), z.string())]),
    screenshot: z.string(),
  }).passthrough())),
}).passthrough();
const bundleSchema = z.object({
  version: z.literal(1),
  activeId: z.string().nullable(),
  order: z.array(z.string()),
  projects: z.record(z.string(), projectSchema),
}).passthrough().refine((bundle) =>
  bundle.order.length === new Set(bundle.order).size &&
  bundle.order.length === Object.keys(bundle.projects).length &&
  bundle.order.every((id) => Object.hasOwn(bundle.projects, id)) &&
  (bundle.activeId === null || Object.hasOwn(bundle.projects, bundle.activeId)),
  "Invalid project index",
);
let pendingWrite: Promise<unknown> = Promise.resolve();

function filePath() {
  return path.resolve(process.env.APP_STORE_PROJECT_FILE || path.join(process.cwd(), "app-store-screenshots.json"));
}

function revision(raw: string | null) {
  return raw === null ? "missing" : createHash("sha256").update(raw).digest("hex");
}

async function readFile() {
  try {
    return await fs.readFile(filePath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function GET(req: Request) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  if (access.client) {
    const { data, error } = await access.client.rpc("read_workspace");
    if (error) return NextResponse.json({ ok: false, error: "Cloud projects could not be loaded." }, { status: 503, headers: privateHeaders });
    return NextResponse.json({ ok: true, state: data?.state ?? null, revision: data?.revision ?? "missing", ownerId: access.userId }, { headers: privateHeaders });
  }
  try {
    await pendingWrite;
    const raw = await readFile();
    const state: unknown = raw === null ? null : JSON.parse(raw);
    // Valid JSON can still be a corrupted project (null, an array, or unrelated
    // fields). Never hydrate it as an empty workspace and overwrite the file.
    if (raw !== null && !bundleSchema.safeParse(state).success && !projectSchema.safeParse(state).success) {
      throw new Error("Invalid saved project");
    }
    return NextResponse.json({ ok: true, state, revision: revision(raw) });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Project file could not be read. Your saved file has been preserved." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const access = await authorizeRequest(req);
  if ("response" in access) return access.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!bundleSchema.safeParse(body).success) {
    return NextResponse.json({ ok: false, error: "Invalid project bundle. Saved projects have been preserved." }, { status: 400 });
  }
  if (access.client) {
    const expected = req.headers.get("if-match");
    if (!expected) return NextResponse.json({ ok: false, error: "Reload the workspace before saving." }, { status: 428, headers: privateHeaders });
    if (JSON.stringify(body).length > 16_000_000) return NextResponse.json({ ok: false, error: "Workspace exceeds the beta size limit. Upload images as files instead of inline data." }, { status: 413 });
    const { data, error } = await access.client.rpc("save_workspace", { bundle: body, expected_revision: expected });
    if (error) return NextResponse.json({ ok: false, error: error.code === "40001" ? "Projects changed in another tab. Reload before saving again; your edits remain in this browser." : "Cloud save failed. Your previous projects are preserved." }, { status: error.code === "40001" ? 409 : 503, headers: privateHeaders });
    return NextResponse.json({ ok: true, revision: data }, { headers: privateHeaders });
  }
  const write = pendingWrite.then(async () => {
    const target = filePath();
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const current = await readFile();
      const expected = req.headers.get("if-match");
      if (expected && expected !== revision(current)) {
        return NextResponse.json({ ok: false, error: "Projects changed in another tab. Reload before saving again; your edits remain in this browser." }, { status: 409 });
      }
      const pretty = JSON.stringify(body, null, 2) + "\n";
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(temporary, pretty, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporary, target);
      return NextResponse.json({ ok: true, revision: revision(pretty) });
    } catch {
      return NextResponse.json({ ok: false, error: "Project file could not be saved. Your previous file has been preserved." }, { status: 500 });
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
  });
  pendingWrite = write.then(() => undefined, () => undefined);
  return write;
}
