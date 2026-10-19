import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  galleryTemplateSchema,
  type GalleryPostSummary,
  type GalleryPublishInput,
  type GalleryTemplate,
} from "./gallery";
import type { CloudAccess } from "./supabase/access";
import { storageMode, supabaseConfig } from "./supabase/config";
import type { Device } from "./types";

// Public reads use the anonymous key, so Postgres RLS and column grants decide
// what a visitor sees (never the owner or the template). Writes always use the
// signed-in user's client, so RLS decides who may publish or unpublish.

const LIST_LIMIT = 60;
const LIST_COLUMNS = "id, title, description, device, screen_count, previews, created_at";

type LocalPost = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  device: Device;
  screenCount: number;
  template: GalleryTemplate;
  previews: string[];
  hidden: boolean;
  createdAt: string;
};

export const LOCAL_OWNER = "local";

function anonClient() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function galleryFile() {
  return path.resolve(process.env.APP_GALLERY_FILE || path.join(process.cwd(), "gallery.json"));
}

async function readLocal(): Promise<LocalPost[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(galleryFile(), "utf8")) as { posts?: LocalPost[] };
    return Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

let pendingWrite: Promise<unknown> = Promise.resolve();
function updateLocal<T>(change: (posts: LocalPost[]) => { posts: LocalPost[]; result: T }): Promise<T> {
  const run = pendingWrite.then(async () => {
    const { posts, result } = change(await readLocal());
    const target = galleryFile();
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(temporary, JSON.stringify({ version: 1, posts }, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, target);
    return result;
  });
  pendingWrite = run.catch(() => undefined);
  return run;
}

type Row = { id: string; title: string; description: string; device: Device; screen_count: number; previews: string[]; created_at: string };
const summary = (row: Row): GalleryPostSummary => ({
  id: row.id,
  title: row.title,
  description: row.description,
  device: row.device,
  screenCount: row.screen_count,
  previewCount: row.previews.length,
  createdAt: row.created_at,
});

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Visible posts, newest first. Throws when the backing store is unreachable. */
export async function listGalleryPosts(): Promise<GalleryPostSummary[]> {
  if (storageMode() === "local") {
    return (await readLocal())
      .filter((post) => !post.hidden)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, LIST_LIMIT)
      .map((post) => summary({ id: post.id, title: post.title, description: post.description, device: post.device, screen_count: post.screenCount, previews: post.previews, created_at: post.createdAt }));
  }
  const { data, error } = await anonClient()
    .from("gallery_posts")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return (data as Row[]).map(summary);
}

/** One visible post's public card data plus its preview images. */
export async function getGalleryPost(id: string): Promise<(GalleryPostSummary & { previews: string[] }) | null> {
  if (storageMode() === "local") {
    const post = (await readLocal()).find((item) => item.id === id && !item.hidden);
    return post
      ? { ...summary({ id: post.id, title: post.title, description: post.description, device: post.device, screen_count: post.screenCount, previews: post.previews, created_at: post.createdAt }), previews: post.previews }
      : null;
  }
  if (!isUuid(id)) return null;
  const { data, error } = await anonClient().from("gallery_posts").select(LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { ...summary(data as Row), previews: (data as Row).previews } : null;
}

export type GalleryTemplateAccess = {
  template: GalleryTemplate;
  title: string;
  mine: boolean;
  moderator: boolean;
};

/** The reusable template, for signed-in users (and the owner of a hidden post). */
export async function getGalleryTemplate(access: CloudAccess | null, id: string): Promise<GalleryTemplateAccess | null> {
  if (!access) {
    const post = (await readLocal()).find((item) => item.id === id && !item.hidden);
    return post ? { template: post.template, title: post.title, mine: true, moderator: true } : null;
  }
  if (!isUuid(id)) return null;
  const { data, error } = await access.client.from("gallery_posts").select("title, template, owner_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = galleryTemplateSchema.safeParse(data.template);
  if (!parsed.success) return null;
  const { data: moderator } = await access.client.rpc("is_gallery_moderator");
  return { template: parsed.data, title: data.title as string, mine: data.owner_id === access.userId, moderator: moderator === true };
}

export async function publishGalleryPost(access: CloudAccess | null, input: GalleryPublishInput): Promise<string> {
  const row = {
    title: input.title,
    description: input.description,
    device: input.template.device,
    screen_count: input.template.slides.length,
    template: input.template,
    previews: input.previews,
  };
  if (!access) {
    return updateLocal((posts) => {
      const id = randomUUID();
      const post: LocalPost = {
        id,
        ownerId: LOCAL_OWNER,
        title: row.title,
        description: row.description,
        device: row.device,
        screenCount: row.screen_count,
        template: row.template,
        previews: row.previews,
        hidden: false,
        createdAt: new Date().toISOString(),
      };
      return { posts: [post, ...posts], result: id };
    });
  }
  const { data, error } = await access.client.from("gallery_posts").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

/** True when the caller's own post was removed. */
export async function unpublishGalleryPost(access: CloudAccess | null, id: string): Promise<boolean> {
  if (!access) {
    return updateLocal((posts) => {
      const next = posts.filter((post) => post.id !== id);
      return { posts: next, result: next.length !== posts.length };
    });
  }
  if (!isUuid(id)) return false;
  const { data, error } = await access.client.from("gallery_posts").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data || []).length > 0;
}

/** Moderator hide. Returns null when the caller is not a moderator. */
export async function hideGalleryPost(access: CloudAccess | null, id: string): Promise<boolean | null> {
  if (!access) {
    return updateLocal((posts) => {
      const found = posts.some((post) => post.id === id);
      return { posts: posts.map((post) => (post.id === id ? { ...post, hidden: true } : post)), result: found };
    });
  }
  if (!isUuid(id)) return false;
  const { data, error } = await access.client.rpc("hide_gallery_post", { post_id: id });
  if (error) {
    if (error.code === "42501") return null;
    throw error;
  }
  return data === true;
}
