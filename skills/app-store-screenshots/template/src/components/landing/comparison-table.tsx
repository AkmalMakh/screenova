"use client";
import React from 'react';
import { Check, X } from 'lucide-react';
import { COMPARISON_ROWS } from './mock-data';
import { Reveal } from './reveal';
import { Kicker } from './kicker';

export const ComparisonTable: React.FC = () => {
  return (
    <section className="border-t border-black/[0.06] bg-[#F5F5F7] py-24 text-black dark:border-white/[0.06] dark:bg-[#111113] dark:text-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker index="05" label="Screenova vs. AppScreens" tone="violet" />
          <h2 className="mx-auto mt-4 max-w-md text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-white">
            A template picker vs. an AI that starts from your app
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Most generators hand you a fixed template library. Screenova hands you an editable,
            git-owned deck drafted from your actual screenshots.
          </p>
        </Reveal>

        <Reveal className="mt-14 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-black/[0.08] dark:border-white/[0.08]">
                <th className="w-1/3 bg-black/[0.02] px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-neutral-500 dark:bg-white/[0.02] dark:text-neutral-500">
                  Feature
                </th>
                <th className="w-1/3 border-x border-black/[0.08] bg-black/[0.03] px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-black dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white">
                  Screenova
                </th>
                <th className="w-1/3 bg-black/[0.02] px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-neutral-500 dark:bg-white/[0.02] dark:text-neutral-500">
                  AppScreens
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={idx} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="px-6 py-4 text-[13px] font-medium text-neutral-700 dark:text-neutral-300">{row.feature}</td>

                  <td className="border-x border-black/[0.06] bg-black/[0.02] px-6 py-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
                    {typeof row.storeCanvas === 'boolean' ? (
                      <Check className="h-4 w-4 stroke-[3] text-[#006FE6] dark:text-[#409CFF]" />
                    ) : (
                      <span className="text-[12px] font-semibold text-[#006FE6] dark:text-[#409CFF]">{row.storeCanvas}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-[13px] text-neutral-500 dark:text-neutral-500">
                    {typeof row.traditionalTools === 'boolean' ? (
                      <X className="h-4 w-4 text-neutral-300 dark:text-neutral-700" />
                    ) : (
                      <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-500">{row.traditionalTools}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        <p className="mt-4 text-center text-[12px] text-neutral-400 dark:text-neutral-600">
          AppScreens details based on their publicly listed pricing and feature pages.
        </p>
      </div>
    </section>
  );
};
