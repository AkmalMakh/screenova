"use client";
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './reveal';
import { Kicker } from './kicker';
import { SectionHeading } from './section-heading';

interface CtaBannerProps {
  onStart: () => void;
}

export const CtaBanner: React.FC<CtaBannerProps> = ({ onStart }) => {
  return (
    <section className="border-t border-border bg-background py-24 text-foreground">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="relative z-10 mx-auto max-w-xl">
            <Kicker index="10" label="Launch ready in minutes" tone="gold" />

            <SectionHeading className="mt-5 md:text-[48px]">
              Start with the screenshots you{' '}
              <span className="font-sans font-semibold text-primary">already have</span>.
            </SectionHeading>
            <p className="mt-5 text-subhead text-muted-foreground">
              Skip weeks of manual mockup alignment in Figma. Upload your raw screens and let
              Screenova build your complete campaign.
            </p>

            <div className="mt-9 flex justify-center">
              <button
                onClick={onStart}
                id="cta-start-designing-btn"
                className="btn-press group inline-flex cursor-pointer items-center gap-2 rounded-sm bg-primary px-7 py-3.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 "
              >
                <span>Open Studio</span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
