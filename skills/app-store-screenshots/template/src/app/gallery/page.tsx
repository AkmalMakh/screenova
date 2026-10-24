import type { Metadata } from "next";
import Link from "next/link";
import { GalleryHeader } from "@/components/gallery/gallery-header";
import { DEVICE_LABEL } from "@/lib/constants";
import { listGalleryPosts } from "@/lib/gallery-store";
import type { GalleryPostSummary } from "@/lib/gallery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Gallery — Screenova",
  description: "App Store screenshot designs shared by Screenova makers. Open one as a template and add your own screenshots.",
};

export default async function GalleryPage() {
  let posts: GalleryPostSummary[] | null = null;
  try {
    posts = await listGalleryPosts();
  } catch {
    posts = null;
  }
  return (
    <div className="min-h-svh bg-background text-foreground">
      <GalleryHeader />
      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-8 sm:px-6">
        <h1 className="text-title1 font-semibold tracking-tight">Gallery</h1>
        <p className="mt-2 max-w-2xl text-subhead text-muted-foreground">
          Screenshot designs shared by Screenova makers. Open one as a template: you get its layout, colors and type, and add your own screenshots.
        </p>
        {posts === null ? (
          <p role="status" className="mt-10 rounded-lg border border-border bg-card p-6 text-subhead text-muted-foreground">
            The gallery is unavailable right now. Try again in a moment.
          </p>
        ) : posts.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-title3 font-semibold">No designs yet</p>
            <p className="mt-1 text-subhead text-muted-foreground">Publish yours from the editor with the Publish button.</p>
            <Link href="/studio" className="mt-4 inline-flex h-10 items-center rounded-sm bg-primary px-4 text-footnote font-semibold text-primary-foreground hover:bg-primary/90">
              Open Studio
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <GalleryCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function GalleryCard({ post }: { post: GalleryPostSummary }) {
  const shown = Math.min(post.previewCount, 3);
  return (
    <Link
      href={`/gallery/${post.id}`}
      className="group block overflow-hidden rounded-lg border border-border bg-card shadow-card transition-[box-shadow,border-color] duration-short ease-out hover:border-foreground/20 hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-56 items-end justify-center gap-2 overflow-hidden bg-muted/60 px-4 pt-4">
        {Array.from({ length: shown }, (_, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={`/gallery/${post.id}/preview/${index}`}
            alt=""
            loading="lazy"
            className="h-full w-auto min-w-0 rounded-t-sm object-cover object-top shadow-sm"
          />
        ))}
      </div>
      <div className="p-4">
        <p className="truncate text-title3 font-semibold">{post.title}</p>
        <p className="mt-1 text-caption text-muted-foreground">
          {DEVICE_LABEL[post.device] ?? post.device} · {post.screenCount} {post.screenCount === 1 ? "screen" : "screens"}
        </p>
      </div>
    </Link>
  );
}
