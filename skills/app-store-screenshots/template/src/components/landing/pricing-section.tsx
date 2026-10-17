"use client";
import React from "react";
import { Check } from "lucide-react";
import { PRICING_PLANS } from "./mock-data";
import type { PricingPlan } from "./types";
import { Reveal } from "./reveal";
import { Kicker } from "./kicker";
import { SectionHeading } from "./section-heading";

export function PricingSection({ onSelectPlan, cloud = false }: { onSelectPlan: (plan: PricingPlan) => void; cloud?: boolean }) {
  return (
    <section id="pricing" className="border-t border-border bg-background py-24 text-foreground">
      <Reveal className="mx-auto max-w-xl px-6 text-center">
        <Kicker index="09" label="Your workspace" tone="violet" />
        <SectionHeading className="mt-4">{cloud ? "Your private design workspace" : "Design and export without a subscription"}</SectionHeading>
        <p className="mt-4 text-subhead text-muted-foreground">
          {cloud
            ? "Sign in to save designs and images privately under your account. AI generation has daily usage limits; manual editing and exports do not require AI."
            : "Use local Studio without an account. Projects and images stay on your computer. AI features use a server-side OpenAI key; manual editing and exports do not require AI."}
        </p>
        <ul className="mx-auto mt-8 max-w-sm space-y-3 text-left text-sm">
          {["Editable templates and saved projects", "iPhone, iPad and Android PNG bundles", "Multilingual copy and connected-canvas export"].map((feature) => (
            <li key={feature} className="flex items-center gap-3"><Check aria-hidden="true" className="h-4 w-4 shrink-0" />{feature}</li>
          ))}
        </ul>
        <button type="button" onClick={() => onSelectPlan(PRICING_PLANS[0])} className="btn-press mt-8 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open Studio</button>
        <p className="mt-4 text-xs text-muted-foreground">Team workspaces and billing are not available.</p>
      </Reveal>
    </section>
  );
}
