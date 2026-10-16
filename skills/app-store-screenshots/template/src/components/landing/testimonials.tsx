"use client";
import React from 'react';
import { TESTIMONIALS } from './mock-data';
import { Reveal, RevealGroup, fadeUp } from './reveal';
import { motion } from 'motion/react';
import { Kicker } from './kicker';

export const Testimonials: React.FC = () => {
  return (
    <section className="border-t border-black/[0.06] bg-[#F5F5F7] py-24 text-black dark:border-white/[0.06] dark:bg-[#111113] dark:text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mb-14 text-center">
          <Kicker index="07" label="From the people using it" tone="violet" />
          <h3 className="mx-auto mt-4 max-w-lg text-2xl font-semibold tracking-tight text-black sm:text-3xl dark:text-white">
            Loved by iOS &amp; Android creators
          </h3>
        </Reveal>

        <RevealGroup className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.id}
              variants={fadeUp}
              className="flex flex-col justify-between rounded-2xl border border-black/[0.07] bg-black/[0.02] p-6 transition-colors duration-200 hover:border-black/[0.14] dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/[0.14]"
            >
              <div>
                <p className="text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">&ldquo;{t.quote}&rdquo;</p>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-black/[0.05] text-[12px] font-semibold text-neutral-800 dark:bg-white/[0.05] dark:text-neutral-200">
                  {t.author.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h4 className="text-[12px] font-semibold leading-tight text-black dark:text-white">{t.author}</h4>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-500">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
};
