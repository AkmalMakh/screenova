"use client";
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Reveal, RevealGroup, fadeUp } from './reveal';
import { Kicker } from './kicker';
import { motion } from 'motion/react';
import { ease } from './theme';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'Do I need an account to use Screenova?',
    a: 'No login on the Free tier. It’s a self-hosted editor — your project state lives in a git-trackable JSON file plus a localStorage mirror, so it’s yours from the start.',
  },
  {
    q: 'Do I need my own OpenAI key?',
    a: 'On Free, yes — the AI redesign chat calls OpenAI directly from your own .env.local key. Pro adds managed hosting and AI credits, so you can skip local setup and API keys entirely.',
  },
  {
    q: 'If the AI generates a background, can I still edit it afterward?',
    a: 'Yes. Generated decorations — gradients, shapes, ellipses — stay live canvas elements. Nothing gets flattened into a raster image, so you can keep adjusting after the AI hands it off.',
  },
  {
    q: 'Which devices and languages are covered?',
    a: 'iPhone, iPad, Android phone, Android tablet (7” and 10”, portrait and landscape), and the 1024×500 Play Store feature graphic — 6 device targets. Content locales: English, German, Spanish, French, Chinese, Japanese, and Korean.',
  },
  {
    q: 'Can Screenova publish straight to App Store Connect or Google Play?',
    a: 'Not yet — exports are upload-ready, correctly-sized bundles organized by device and locale, but you upload them yourself through App Store Connect or Play Console. Direct publishing isn’t built.',
  },
  {
    q: 'Does Screenova run continuous experiments and learn what works, like a paywall-optimization tool would?',
    a: 'Not yet. Today, Screenova drafts multiple directions and you run them as Product Page Optimization treatments in App Store Connect yourself. A continuous loop — Screenova reading back which treatments won and drafting the next round automatically — is on the roadmap, not shipped.',
  },
  {
    q: 'How is this different from picking a template in Figma, Canva, or a screenshot tool?',
    a: 'Template pickers give you a fixed layout you rebuild per device and per language. Screenova’s AI drafts a deck from your actual screenshots, reflows it across every size and locale automatically, and keeps a connected canvas so elements can cross screen boundaries — see the comparison above for specifics.',
  },
  {
    q: 'Where does my project live?',
    a: 'In your own git repo. The Skill scaffolds the editor into your existing codebase — there’s no hosted account holding your project hostage.',
  },
];

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-t border-black/[0.06] bg-[#FAF9F6] py-24 text-black dark:border-white/[0.06] dark:bg-[#07080a] dark:text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker index="08" label="Frequently asked" tone="violet" />
          <h2 className="mx-auto mt-4 max-w-md text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-white">
            Questions people actually ask
          </h2>
        </Reveal>

        <RevealGroup className="mt-12 divide-y divide-black/[0.06] border-y border-black/[0.06] dark:divide-white/[0.06] dark:border-white/[0.06]">
          {FAQS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div key={idx} variants={fadeUp} className="py-1">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="btn-press flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[14px] font-semibold text-black sm:text-[15px] dark:text-white">{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 dark:text-neutral-400 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.25, ease: ease.out }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 max-w-2xl text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {item.a}
                  </p>
                </motion.div>
              </motion.div>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
};
