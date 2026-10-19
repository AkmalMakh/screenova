import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GalleryActions } from "@/components/gallery/gallery-actions";
import { GalleryHeader } from "@/components/gallery/gallery-header";
import { DEVICE_LABEL } from "@/lib/constants";
import { getGalleryPost } from "@/lib/gallery-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getGalleryPost(id).catch(() => null);
  if (!post) return { title: "Gallery — Screenova" };
  return {
    title: `${post.title} — Screenova Gallery`,
    description: post.description || `An App Store screenshot design for ${DEVICE_LABEL[post.device] ?? post.device}, shared on Screenova.`,
    openGraph: { images: [`/gallery/${post.id}/preview/0`] },
  };
}

export default async function GalleryPostPage({ params }: Props) {
  const { id } = await params;
  let post: Awaited<ReturnType<typeof getGalleryPost>>;
  try {
    post = await getGalleryPost(id);
  } catch {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <GalleryHeader />
        <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
          <p role="status" className="rounded-lg border border-border bg-card p-6 text-subhead text-muted-foreground">
            The gallery is unavailable right now. Try again in a moment.
          </p>
        </main>
      </div>
    );
  }
  if (!post) notFound();
  const published = new Date(post.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
  return (
    <div className="min-h-svh bg-background text-foreground">
      <GalleryHeader />
      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6">
        <Link href="/gallery" className="inline-flex h-9 items-center gap-1.5 rounded-sm text-footnote font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Gallery
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-title1 font-semibold tracking-tight">{post.title}</h1>
            <p className="mt-1 text-footnote text-muted-foreground">
              {DEVICE_LABEL[post.device] ?? post.device} · {post.screenCount} {post.screenCount === 1 ? "screen" : "screens"} · Published {published}
            </p>
            {post.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-subhead">{post.description}</p>}
          </div>
          <GalleryActions id={post.id} title={post.title} />
        </div>
        <div className="mt-8 flex gap-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4">
          {post.previews.map((_, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={`/gallery/${post.id}/preview/${index}`}
              alt={`${post.title}, screen ${index + 1}`}
              className="h-[min(70svh,560px)] w-auto shrink-0 rounded-sm shadow-card"
            />
          ))}
        </div>
        <p className="mt-3 text-caption text-muted-foreground">
          Previews show the publisher&apos;s screenshots. The template you open has empty screenshot slots for your own app.
        </p>
      </main>
    </div>
  );
}
