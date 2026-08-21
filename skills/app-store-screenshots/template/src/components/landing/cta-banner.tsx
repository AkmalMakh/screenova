"use client";
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './reveal';
import { Kicker } from './kicker';

interface CtaBannerProps {
  onStart: () => void;
}

export const CtaBanner: React.FC<CtaBannerProps> = ({ onStart }) => {
  return (
    <section className="border-t border-black/[0.06] bg-[#FAF9F6] py-24 text-black dark:border-white/[0.06] dark:bg-[#07080a] dark:text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-[28px] border border-black/[0.08] bg-white px-6 py-16 text-center sm:px-12 sm:py-20 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="relative z-10 mx-auto max-w-xl">
            <Kicker index="10" label="Launch ready in minutes" tone="gold" />

            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-black sm:text-4xl md:text-5xl dark:text-white">
              Your app deserves an{' '}
              <span className="font-serif-headline font-normal italic text-[#5241C4] dark:text-[#a89bff]">editorial</span> showcase.
            </h2>
            <p className="mt-5 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              Skip weeks of manual mockup alignment in Figma. Upload your raw screens and let
              Screenova build your complete campaign.
            </p>

            <div className="mt-9 flex justify-center">
              <button
                onClick={onStart}
                id="cta-start-designing-btn"
                className="btn-press group inline-flex cursor-pointer items-center gap-2 rounded-full bg-black px-7 py-3.5 text-[13px] font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <span>Launch interactive studio</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
