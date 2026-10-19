"use client";
import * as React from "react";
import Link from "next/link";
import { MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Globe,
  Languages,
  Layers,
  Maximize,
  Pencil,
  Plus,
  Smartphone,
  Sparkles,
  Tablet,
  Wand2,
} from "lucide-react";
import type { GalleryPostSummary } from "@/lib/gallery";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { cn } from "@/lib/utils";
import { FAQ } from "./faq";
import { Reveal, RevealGroup, fadeUp } from "./reveal";
import { motion } from "motion/react";

/**
 * Screenova marketing landing — the public home page. A dark, prompt-first
 * layout: the hero composer hands its prompt and device to the real Studio
 * (/studio), and the template row shows real public gallery designs.
 */

type LandingDevice = "iphone" | "ipad" | "android";

const DEVICES: Array<{ value: LandingDevice; label: string; icon: typeof Smartphone }> = [
  { value: "iphone", label: "iPhone", icon: Smartphone },
  { value: "ipad", label: "iPad", icon: Tablet },
  { value: "android", label: "Android", icon: Smartphone },
];

const PROMPTS = [
  "A calm calendar app for busy parents",
  "A habit tracker with streaks and gentle reminders",
  "A budget planner that makes saving feel easy",
  "A language app with five-minute daily lessons",
];

const EXAMPLES = [
  { id: "deck", name: "MoteCalendar", screens: ["/deck/01-hero.webp", "/deck/02-split-landscape.webp", "/deck/03-device-bottom.webp"], count: 9 },
  { id: "deck-b", name: "Soft minimal", screens: ["/deck-b/01-hero.webp", "/deck-b/02-single.webp", "/deck-b/03-two-devices.webp"], count: 3 },
  { id: "deck-c", name: "Bold contrast", screens: ["/deck-c/01-hero.webp", "/deck-c/02-single.webp", "/deck-c/03-two-devices.webp"], count: 3 },
];

const FEATURES = [
  { icon: Wand2, title: "Describe it, get a deck", body: "Tell Screenova about your app. It drafts headlines, layouts and a palette for every screen." },
  { icon: Sparkles, title: "Match any reference", body: "Add a screenshot you love as inspiration and redesign a screen in that style, with your own content." },
  { icon: Languages, title: "Seven languages", body: "English, German, Spanish, French, Chinese, Japanese and Korean, translated in place on every screen." },
  { icon: Maximize, title: "Exact store sizes", body: "iPhone, iPad, Android phone and tablet, plus the Play feature graphic, exported upload-ready." },
  { icon: Pencil, title: "Edit everything", body: "Headlines, device frames, backgrounds and shapes stay editable. AI gives you a start, never a lock-in." },
  { icon: Globe, title: "Share to the gallery", body: "Publish a design for others to reuse as a template. Your screenshots stay private." },
];

const STEPS = ["Reading your app", "Writing headlines", "Picking a palette", "Framing devices", "Translating screens"];

const PROMPT_KEY = "screenova:studio-prompt";
const DEVICE_KEY = "screenova:studio-device";

export function LandingPage({ cloud = false, posts = [] }: { cloud?: boolean; posts?: GalleryPostSummary[] }) {
  const router = useRouter();

  const openStudio = (prompt?: string, device?: LandingDevice) => {
    try {
      if (prompt?.trim()) sessionStorage.setItem(PROMPT_KEY, prompt.trim());
      if (device) sessionStorage.setItem(DEVICE_KEY, device);
    } catch { /* storage is optional */ }
    router.push("/studio");
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="screenova-landing landing-dark min-h-screen bg-black text-white antialiased">
        <Navbar onStart={() => openStudio()} />
        <main>
          <Hero cloud={cloud} onSubmit={openStudio} />
          <DemoCard />
          <TemplateRow posts={posts} />
          <Features />
          <ClosingCta onStart={() => openStudio()} />
          <FAQ cloud={cloud} />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

// ---------- Navbar ----------

function Navbar({ onStart }: { onStart: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-black via-black/70 to-transparent">
      <nav aria-label="Main" className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-[72px]">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Screenova home">
          <span className="text-[24px] font-medium tracking-[-0.02em]">Screenova</span>
          <span className="rounded-full border border-white/80 px-2 py-px text-[11px] font-medium uppercase tracking-wide">Beta</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/gallery" className="hidden h-10 rounded-full px-3 text-[15px] text-white/80 transition-colors hover:text-white sm:inline-flex">
            Gallery
          </Link>
          <button type="button" onClick={onStart} className="btn-press h-10 rounded-full bg-white px-6 text-[15px] font-medium text-black hover:bg-white/90">
            Try now
          </button>
        </div>
      </nav>
    </header>
  );
}

// ---------- Hero ----------

function Hero({ cloud, onSubmit }: { cloud: boolean; onSubmit: (prompt: string, device: LandingDevice) => void }) {
  const [prompt, setPrompt] = React.useState("");
  const [device, setDevice] = React.useState<LandingDevice>("iphone");

  function submit(text = prompt) {
    onSubmit(text.trim() || PROMPTS[0], device);
  }

  return (
    <section id="hero-section" className="relative overflow-hidden pb-16 pt-36 sm:pb-24 sm:pt-48">
      <div aria-hidden className="landing-dots absolute inset-0" />
      <div aria-hidden className="landing-aurora" />
      <div className="relative mx-auto max-w-[1440px] px-5 text-center sm:px-8">
        <h1 className="mx-auto max-w-[900px] text-[48px] font-normal leading-[1.02] tracking-[-0.035em] sm:text-[80px] lg:text-[96px]">
          Screenshots at the speed of AI
        </h1>
        <p className="mx-auto mt-6 max-w-[620px] text-[17px] leading-relaxed text-white/85 sm:text-[22px]">
          Turn your app into App Store and Google Play screenshots people want to tap.
        </p>

        <form
          className="landing-composer relative mx-auto mt-16 max-w-[850px] rounded-[24px] border border-white/15 p-2 text-left shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:mt-24"
          onSubmit={(event) => { event.preventDefault(); submit(); }}
        >
          <label htmlFor="hero-direction" className="sr-only">Describe your app</label>
          <textarea
            id="hero-direction"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            rows={4}
            placeholder="What app shall we make screenshots for?"
            className="block min-h-[120px] w-full resize-none bg-transparent px-4 pt-3 text-[18px] leading-relaxed text-white outline-none placeholder:text-white/55 sm:min-h-[150px] sm:text-[20px]"
          />
          <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
            <button
              type="button"
              onClick={() => submit()}
              aria-label="Add screenshots in Studio"
              title="Add screenshots in Studio"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-5 w-5" />
            </button>
            <div role="group" aria-label="Device" className="inline-flex h-11 items-center gap-0.5 rounded-full bg-white/[0.07] p-1">
              {DEVICES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={device === value}
                  onClick={() => setDevice(value)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] transition-colors",
                    device === value ? "bg-white/15 text-white" : "text-white/65 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <button
              id="hero-generate-btn"
              type="submit"
              aria-label="Design with AI"
              title="Design with AI"
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-white/90"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </form>

        <div className="mx-auto mt-5 flex max-w-[850px] gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:justify-center">
          {PROMPTS.slice(0, 3).map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => { setPrompt(text); submit(text); }}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-[14px] text-white/85 backdrop-blur transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-w-[200px] truncate">{text}</span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-[14px] text-white/60">
          {cloud
            ? "Free during the beta. Sign in with Google or GitHub."
            : "Use local Studio without an account. Projects stay on your computer."}
        </p>
      </div>
    </section>
  );
}

// ---------- Demo card ----------

function DemoCard() {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStep((value) => (value + 1) % STEPS.length), 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section aria-label="How Screenova works" className="px-3 py-12 sm:px-6 sm:py-20">
      <Reveal className="relative mx-auto max-w-[1392px] overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1d1a26] via-[#121218] to-[#0b0f1c] sm:rounded-[40px]">
        <div aria-hidden className="landing-dots-large absolute inset-0 opacity-60" />
        <div className="relative grid items-center gap-10 p-6 sm:p-12 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:p-20">
          <div>
            <span aria-hidden className="landing-eyes inline-flex h-14 w-28 items-center justify-center gap-3 rounded-full bg-white sm:h-[72px] sm:w-[180px]">
              <span className="h-3 w-3 rounded-full bg-black sm:h-4 sm:w-4" />
              <span className="h-3 w-3 rounded-full bg-black sm:h-4 sm:w-4" />
            </span>
            <h2 className="landing-gradient-text mt-8 text-[44px] font-normal leading-[1.02] tracking-[-0.03em] sm:text-[72px]">
              One sentence. A whole deck.
            </h2>
            <p className="mt-6 max-w-[460px] text-[17px] leading-relaxed text-white/70">
              Describe your app once. Screenova writes the story, picks the palette and frames every
              screen, then hands you a deck you can edit down to the pixel.
            </p>
            <div className="mt-8 inline-flex h-14 items-center gap-3 rounded-full bg-[#3a2f63]/80 px-6 text-[18px] text-white sm:h-16 sm:text-[22px]" aria-live="polite">
              <Sparkles className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
              <span key={step} className="landing-step">{STEPS[step]}</span>
            </div>
          </div>
          <div className="relative flex items-end justify-center gap-3 sm:gap-5">
            {EXAMPLES[0].screens.map((src, index) => (
              <img
                key={src}
                src={src}
                width={520}
                height={1125}
                alt={`MoteCalendar screenshot ${index + 1}`}
                className={cn(
                  "w-[30%] max-w-[190px] rounded-[14px] shadow-[0_24px_60px_rgba(0,0,0,0.6)]",
                  index === 1 ? "-translate-y-6" : "translate-y-2",
                )}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---------- Templates ----------

function TemplateRow({ posts }: { posts: GalleryPostSummary[] }) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: true, end: false });
  const measure = React.useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setEdges({ start: row.scrollLeft <= 4, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 4 });
  }, []);
  React.useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function page(direction: 1 | -1) {
    const row = rowRef.current;
    if (!row) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: smooth ? "smooth" : "auto" });
  }

  const cards = posts.length
    ? posts.map((post) => ({
      key: post.id,
      href: `/gallery/${post.id}`,
      kind: `${post.device === "ipad" ? "iPad" : post.device === "iphone" ? "iPhone" : "Android"} template`,
      name: post.title,
      screens: Array.from({ length: Math.min(3, post.previewCount) }, (_, index) => `/gallery/${post.id}/preview/${index}`),
    }))
    : EXAMPLES.map((example) => ({
      key: example.id,
      href: "/studio",
      kind: `Example · ${example.count} screens`,
      name: example.name,
      screens: example.screens,
    }));

  return (
    <section aria-labelledby="templates-title" className="py-12 sm:py-20">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 id="templates-title" className="text-[32px] font-normal tracking-[-0.02em] sm:text-[44px]">
            {posts.length ? "Get started with the gallery" : "Get started with an example"}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/gallery" className="mr-2 hidden text-[15px] text-white/75 hover:text-white sm:inline">See all</Link>
            <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label="Previous templates"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label="Next templates"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      <div ref={rowRef} onScroll={measure} className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:px-12 xl:px-[max(48px,calc((100vw-1344px)/2))]">
        {cards.map((card) => (
          <Link key={card.key} href={card.href} className="group w-[300px] shrink-0 snap-start sm:w-[480px]">
            <span className="relative flex aspect-[4/3] items-end justify-center gap-3 overflow-hidden rounded-[20px] bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-6 pt-10 ring-1 ring-white/10 transition-transform duration-300 ease-out group-hover:-translate-y-1">
              {card.screens.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  className={cn("w-[29%] rounded-t-[12px] object-cover object-top", index === 1 ? "translate-y-0" : "translate-y-5")}
                />
              ))}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-4 pt-12 text-left">
                <span className="block text-[12px] text-white/65">{card.kind}</span>
                <span className="block truncate text-[16px] font-medium">{card.name}</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------- Features ----------

function Features() {
  return (
    <section aria-label="Features" className="px-5 py-12 sm:px-12 sm:py-20">
      <RevealGroup className="mx-auto grid max-w-[1344px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <motion.div key={title} variants={fadeUp} className="flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-7">
            <span className="landing-feature-icon flex h-14 w-14 items-center justify-center rounded-2xl">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h3 className="text-[26px] font-normal tracking-[-0.01em]">{title}</h3>
              <p className="mt-3 text-[16px] leading-relaxed text-white/70">{body}</p>
            </div>
          </motion.div>
        ))}
      </RevealGroup>
    </section>
  );
}

// ---------- Closing CTA ----------

function ClosingCta({ onStart }: { onStart: () => void }) {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden py-28 text-center sm:py-40">
      <div aria-hidden className="landing-aurora landing-aurora-low" />
      <div className="relative mx-auto max-w-[720px] px-5">
        <h2 id="cta-title" className="text-[40px] font-normal leading-tight tracking-[-0.03em] sm:text-[56px]">
          Your next release deserves better screenshots
        </h2>
        <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-white/80">
          Describe your app, refine every screen and export for both stores. No design skills needed.
        </p>
        <button type="button" onClick={onStart} className="btn-press mt-10 h-14 rounded-full bg-[#1f1f23] px-8 text-[18px] font-medium text-white ring-1 ring-white/15 hover:bg-[#2a2a30]">
          Start designing
        </button>
      </div>
    </section>
  );
}

// ---------- Footer ----------

function Footer() {
  return (
    <footer className="px-5 pb-10 pt-16 sm:px-12">
      <div className="mx-auto flex max-w-[1344px] flex-wrap items-center justify-between gap-6 text-[14px] text-white/70">
        <span className="flex items-center gap-2 text-white">
          <Layers className="h-4 w-4" aria-hidden />
          Screenova
          <span className="text-white/50">© {new Date().getFullYear()}</span>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/gallery" className="hover:text-white">Gallery</Link>
          <Link href="/studio" className="hover:text-white">Studio</Link>
          <a href={SUPPORT_MAILTO} title={`Email ${SUPPORT_EMAIL}`} className="hover:text-white">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
