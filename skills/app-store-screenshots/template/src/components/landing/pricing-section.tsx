"use client";
import { Check } from "lucide-react";
import { PRICING_PLANS } from "./mock-data";
import type { PricingPlan } from "./types";
import { Reveal } from "./reveal";
import { Kicker } from "./kicker";

export function PricingSection({ onSelectPlan }: { onSelectPlan: (plan: PricingPlan) => void }) {
  return (
    <section id="pricing" className="border-t border-black/[0.06] bg-[#F5F5F7] py-24 text-black dark:border-white/[0.06] dark:bg-[#111113] dark:text-white">
      <Reveal className="mx-auto max-w-xl px-6 text-center">
        <Kicker index="09" label="Your workspace" tone="violet" />
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Design and export without a subscription</h2>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Use local Studio without an account. Projects and images stay on your computer.
          AI features use a server-side OpenAI key; manual editing and exports do not require AI.
        </p>
        <ul className="mx-auto mt-8 max-w-sm space-y-3 text-left text-sm">
          {["Editable templates and saved projects", "iPhone, iPad and Android PNG bundles", "Multilingual copy and connected-canvas export"].map((feature) => (
            <li key={feature} className="flex items-center gap-3"><Check className="h-4 w-4 shrink-0" />{feature}</li>
          ))}
        </ul>
        <button type="button" onClick={() => onSelectPlan(PRICING_PLANS[0])} className="btn-press mt-8 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground dark:bg-white dark:text-black">Open the editor</button>
        <p className="mt-4 text-xs text-neutral-500">Team workspaces and billing are not available.</p>
      </Reveal>
    </section>
  );
}
