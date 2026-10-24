import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { storageMode } from "@/lib/supabase/config";
import { strayAuthReturn } from "@/lib/supabase/stray-auth-return";
import { listGalleryPosts } from "@/lib/gallery-store";
import type { GalleryPostSummary } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Screenova — The AI design workspace for app stores",
  description:
    "Screenova — The AI design workspace for app stores. Turn raw app screenshots into beautiful App Store and Google Play campaigns.",
  openGraph: {
    title: "Screenova — The AI design workspace for app stores",
    description:
      "Screenova — The AI design workspace for app stores. Turn raw app screenshots into high-converting mobile campaigns.",
    type: "website",
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  // A sign-in that Supabase returned to the Site URL instead of /auth/callback
  // (redirect allow-list slip) still completes: hand its code to the callback.
  const stray = strayAuthReturn(toSearchParams(await searchParams));
  if (stray) redirect(stray);

  // The landing's template row shows real public designs; examples stand in
  // when the gallery is empty or unreachable.
  let posts: GalleryPostSummary[] = [];
  try {
    posts = (await listGalleryPosts()).slice(0, 12);
  } catch {
    posts = [];
  }
  return <LandingPage cloud={storageMode() === "supabase"} posts={posts} />;
}

function toSearchParams(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") result.set(key, first);
  }
  return result;
}
