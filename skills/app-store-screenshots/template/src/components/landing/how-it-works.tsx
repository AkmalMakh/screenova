"use client";
import React from 'react';
import { Reveal, RevealGroup, fadeUp } from './reveal';
import { Kicker } from './kicker';
import { motion } from 'motion/react';

interface Step {
  n: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    n: '01',
    title: 'Upload your real screenshots',
    description:
      'Up to 10 raw captures straight from your app. No staged mockups, no starting from a blank canvas.',
  },
  {
    n: '02',
    title: 'AI drafts the full deck',
    description:
      'A vision model writes the headline, layout, and backdrop direction for every screen — in every locale you pick.',
  },
  {
    n: '03',
    title: 'Everything stays editable',
    description:
      'Generated text, shapes, and gradients remain live canvas elements. Image backdrops can be replaced or removed.',
  },
  {
    n: '04',
    title: 'Reflow across devices & locales',
    description:
      'iPhone, iPad, Android phone and tablet, and the Play Store feature graphic — in 7 languages, automatically.',
  },
  {
    n: '05',
    title: 'Export a bundle you own',
    description:
      'Download your PNG bundle, organized by device and language, and upload it to your store listing.',
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section className="border-t border-black/[0.06] bg-[#F5F5F7] py-24 text-black dark:border-white/[0.06] dark:bg-[#111113] dark:text-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker index="02" label="From screenshots to store page" tone="violet" />
          <h2 className="mx-auto mt-4 max-w-lg text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-white">
            How Screenova works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Five steps, start to export. Start with your real app captures,
            refine the design, and download assets for your store listing.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 divide-y divide-black/[0.06] border-y border-black/[0.06] dark:divide-white/[0.06] dark:border-white/[0.06]">
          {STEPS.map((step) => (
            <motion.div
              key={step.n}
              variants={fadeUp}
              className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:gap-8 sm:py-7"
            >
              <span className="font-sans shrink-0 text-2xl italic text-[#006FE6] sm:w-16 dark:text-[#409CFF]">
                {step.n}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-black sm:text-base dark:text-white">{step.title}</h3>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
};
