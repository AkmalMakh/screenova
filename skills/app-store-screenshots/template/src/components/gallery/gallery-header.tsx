import Link from "next/link";

export function GalleryHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2" aria-label="Screenova home">
            <span className="font-sans text-[19px] italic">S.</span>
            <span className="text-footnote font-semibold tracking-tight">Screenova</span>
          </Link>
          <Link href="/gallery" className="text-footnote font-medium text-muted-foreground hover:text-foreground">
            Gallery
          </Link>
        </div>
        <Link
          href="/studio"
          className="inline-flex h-9 items-center rounded-sm bg-primary px-4 text-footnote font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Open Studio
        </Link>
      </div>
    </header>
  );
}
