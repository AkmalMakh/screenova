import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { storageMode } from "@/lib/supabase/config";
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

export default async function Page() {
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
