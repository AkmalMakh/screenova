"use client";
import React from 'react';
import { Check, X } from 'lucide-react';
import { COMPARISON_ROWS } from './mock-data';
import { Reveal } from './reveal';
import { Kicker } from './kicker';

export const ComparisonTable: React.FC = () => {
  return (
    <section className="border-t border-border bg-background py-24 text-foreground">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker index="05" label="Screenova vs. AppScreens" tone="violet" />
          <h2 className="mx-auto mt-4 max-w-md text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            A template picker vs. an AI that starts from your app
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Most generators hand you a fixed template library. Screenova hands you an editable,
            git-owned deck drafted from your actual screenshots.
          </p>
        </Reveal>

        <Reveal className="mt-14 overflow-hidden rounded-2xl border border-border">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="w-1/3 bg-muted/50 px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Feature
                </th>
                <th className="w-1/3 border-x border-border bg-muted px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-foreground">
                  Screenova
                </th>
                <th className="w-1/3 bg-muted/50 px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AppScreens
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={idx} className="transition-colors hover:bg-muted/50">
                  <td className="px-6 py-4 text-[13px] font-medium text-foreground">{row.feature}</td>

                  <td className="border-x border-border bg-muted/50 px-6 py-4">
                    {typeof row.storeCanvas === 'boolean' ? (
                      <Check className="h-4 w-4 stroke-[3] text-primary" />
                    ) : (
                      <span className="text-[12px] font-semibold text-primary">{row.storeCanvas}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-[13px] text-muted-foreground">
                    {typeof row.traditionalTools === 'boolean' ? (
                      <X className="h-4 w-4 text-muted-foreground/50" />
                    ) : (
                      <span className="text-[12px] font-medium text-muted-foreground">{row.traditionalTools}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          AppScreens details based on their publicly listed pricing and feature pages.
        </p>
      </div>
    </section>
  );
};
