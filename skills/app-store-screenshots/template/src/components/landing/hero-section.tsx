"use client";
import React, { useState } from 'react';
import { ArrowRight, ChevronRight, PenLine, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Kicker } from './kicker';
import { ease } from './theme';

const DECK_SLIDES = [
  '/deck/01-hero.webp',
  '/deck/02-split-landscape.webp',
  '/deck/03-device-bottom.webp',
  '/deck/04-two-devices.webp',
];

interface HeroSectionProps {
  onGenerate: (prompt: string) => void;
  onStart?: () => void;
  onSelectPreset?: (presetId: string) => void;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: ease.out } },
};

export const HeroSection: React.FC<HeroSectionProps> = ({ onGenerate, onStart }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Primary CTA routes into the real app; the chips and showcase below demo
    // the interactive studio modal with the typed prompt.
    (onStart ?? onGenerate)(prompt.trim() || 'Make this feel like a calm premium wellness app.');
  };

  const samplePrompts = [
    'Calm premium wellness app',
    'Bolder type, dark cinematic palette',
    'New campaign from a workout screenshot',
    'Midnight backdrop, soft violet light',
  ];

  return (
    <section id="hero-section" className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 bg-[#FAF9F6] text-black dark:bg-[#07080a] dark:text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl px-4 sm:px-6 text-center"
      >
        <motion.div variants={item}>
          <Kicker index="01" label="AI App Store Deck Builder" tone="violet" />
        </motion.div>

        {/* Hero Title — outcome-first: what you get, not the mechanism */}
        <motion.h1
          variants={item}
          className="mx-auto mt-7 max-w-3xl text-[2.15rem] font-semibold leading-[1.08] tracking-[-0.03em] text-black sm:text-6xl sm:leading-[1.08] md:text-[4.2rem] dark:text-white"
        >
          Raw app screens, turned{' '}
          <span className="font-serif-headline font-normal italic text-[#5241C4] dark:text-[#c9c1fb]">
            high-converting
          </span>{' '}
          store pages.
        </motion.h1>

        {/* Hero Subtitle — stays close to what the product actually does */}
        <motion.p
          variants={item}
          className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-neutral-600 sm:text-base dark:text-neutral-400"
        >
          Photorealistic device frames, editorial copy, and layouts that reflow for seven
          App Store &amp; Play Store locales — drafted straight from your real screenshots.
        </motion.p>

        {/* Interactive Prompt Input Bar */}
        <motion.div variants={item} className="mx-auto mt-9 max-w-xl">
          <form
            onSubmit={handleSubmit}
            className="group relative flex items-center rounded-full border border-black/[0.12] bg-white p-1.5 pl-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 [transition-timing-function:var(--ease-out)] focus-within:border-black/25 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:focus-within:border-white/25 dark:focus-within:bg-white/[0.06]"
          >
            <PenLine className="h-4 w-4 shrink-0 text-neutral-400 transition-colors group-focus-within:text-[#5241C4] dark:text-neutral-500 dark:group-focus-within:text-[#a89bff]" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a design direction…"
              className="w-full bg-transparent px-3 text-[13px] text-black placeholder:text-neutral-400 focus:outline-none dark:text-white dark:placeholder:text-neutral-500"
            />
            <button
              type="submit"
              id="hero-generate-btn"
              className="btn-press flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <span>Design with AI</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Quick inspiration chips */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(p);
                  onGenerate(p);
                }}
                className="btn-press rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[11px] text-neutral-600 transition-colors hover:border-black/20 hover:text-black dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-neutral-400 dark:hover:border-white/20 dark:hover:text-white"
              >
                {p}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Live Interactive Deck Showcase */}
        <motion.div variants={item} className="relative mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.25)] dark:border-white/[0.08] dark:bg-[#0a0b0e] dark:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
            {/* Top workspace bar */}
            <div className="flex h-12 items-center justify-between border-b border-black/[0.06] px-5 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">MoteCalendar · 9-screen deck, real output</span>
              </div>
              <button
                onClick={() => onGenerate('MoteCalendar calm editorial')}
                className="btn-press flex cursor-pointer items-center gap-1 rounded-full bg-black/[0.05] px-3 py-1 text-[11px] font-medium text-neutral-700 hover:bg-black/[0.09] dark:bg-white/[0.06] dark:text-neutral-200 dark:hover:bg-white/10"
              >
                <span>Open editor</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {/* Main deck ribbon */}
            <div
              onClick={() => onGenerate('MoteCalendar calm editorial')}
              className="group relative cursor-pointer overflow-x-auto bg-[#F1F0EC] p-6 transition-colors duration-200 sm:p-10 dark:bg-transparent"
            >
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-b-[28px] bg-black/0 opacity-0 transition-all duration-200 [transition-timing-function:var(--ease-out)] group-hover:bg-black/30 group-hover:opacity-100 dark:group-hover:bg-black/40">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[12px] font-semibold text-black shadow-2xl">
                  Open the interactive studio
                </span>
              </div>

              <div className="flex items-center justify-center gap-5">
                {DECK_SLIDES.map((src, idx) => (
                  <div
                    key={src}
                    className={`transform overflow-hidden rounded-[26px] border border-black/[0.06] shadow-xl transition-all duration-300 [transition-timing-function:var(--ease-out)] hover:-translate-y-2 dark:border-white/10 dark:shadow-2xl ${
                      idx === 0 ? 'z-20 scale-100' : 'hidden scale-90 opacity-80 md:block'
                    } ${idx === 0 ? 'ring-1 ring-black/10 dark:ring-white/20' : ''}`}
                  >
                    <img
                      src={src}
                      alt={`Generated App Store slide ${idx + 1}`}
                      className="h-[420px] w-auto object-cover sm:h-[480px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick info bar — honest facts only, no fabricated rating */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-black/[0.06] px-6 py-4 text-[11px] text-neutral-500 dark:border-white/[0.06] dark:text-neutral-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#5241C4] dark:text-[#a89bff]" />
                Titanium &amp; gold bezels
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#5241C4] dark:text-[#a89bff]" />
                Editorial serif headlines
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#5241C4] dark:text-[#a89bff]" />
                Multi-device compositions
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};
