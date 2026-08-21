"use client";
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { PRICING_PLANS } from './mock-data';
import { PricingPlan } from './types';
import { Reveal, RevealGroup, fadeUp } from './reveal';
import { Kicker } from './kicker';
import { motion } from 'motion/react';

interface PricingSectionProps {
  onSelectPlan: (plan: PricingPlan) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan }) => {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="border-t border-black/[0.06] bg-[#FAF9F6] py-24 text-black dark:border-white/[0.06] dark:bg-[#07080a] dark:text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker index="09" label="Transparent plans" tone="violet" />
          <h2 className="mx-auto mt-4 max-w-md text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-white">
            Simple, predictable pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Design for free. Upgrade when you&apos;re ready to export high-converting App Store
            bundles.
          </p>

          <div className="mt-8 inline-flex items-center rounded-full border border-black/[0.08] bg-white p-1 dark:border-white/[0.08] dark:bg-white/[0.02]">
            <button
              onClick={() => setIsAnnual(false)}
              className={`btn-press cursor-pointer rounded-full px-4 py-1.5 text-[12px] font-semibold ${
                !isAnnual ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`btn-press flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold ${
                isAnnual ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <span>Annual</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                  isAnnual ? 'bg-white/15 text-white dark:bg-black/10 dark:text-black' : 'bg-black/[0.06] text-neutral-600 dark:bg-white/10 dark:text-neutral-300'
                }`}
              >
                −20%
              </span>
            </button>
          </div>
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3 md:items-stretch">
          {PRICING_PLANS.map((plan) => {
            const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;

            return (
              <motion.div
                key={plan.id}
                variants={fadeUp}
                className={`relative flex flex-col justify-between rounded-[24px] p-7 transition-colors duration-200 ${
                  plan.popular
                    ? 'border border-black/20 bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] md:-translate-y-2 dark:border-white/20 dark:bg-white/[0.04] dark:shadow-none'
                    : 'border border-black/[0.08] bg-white hover:border-black/[0.18] dark:border-white/[0.07] dark:bg-white/[0.015] dark:hover:border-white/[0.14]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-black px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-white dark:text-black">
                      Most popular
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold text-black dark:text-white">{plan.name}</h3>
                  <p className="mt-1.5 min-h-[32px] text-[12px] text-neutral-500">{plan.tagline}</p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="font-serif-headline text-4xl italic text-black dark:text-white">${price}</span>
                    <span className="text-[12px] font-medium text-neutral-500">/month</span>
                  </div>

                  <ul className="mt-6 space-y-3 border-t border-black/[0.06] pt-6 dark:border-white/[0.06]">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2.5 text-[12px] text-neutral-700 dark:text-neutral-300">
                        <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5] text-[#5241C4] dark:text-[#a89bff]" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <button
                    onClick={() => onSelectPlan(plan)}
                    className={`btn-press w-full cursor-pointer rounded-full py-2.5 text-[12px] font-semibold ${
                      plan.popular
                        ? 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200'
                        : 'border border-black/15 bg-transparent text-black hover:border-black/30 dark:border-white/15 dark:text-white dark:hover:border-white/30'
                    }`}
                  >
                    {plan.ctaText}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
};
