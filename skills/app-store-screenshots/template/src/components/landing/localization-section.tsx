"use client";
import React, { useState } from 'react';
import { Check, Globe2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LanguageCode } from './types';
import { SAMPLE_CAMPAIGNS } from './mock-data';
import { AppStoreSlideCard } from './app-store-slide-card';
import { Reveal } from './reveal';
import { Kicker } from './kicker';
import { ease } from './theme';
import { SectionHeading } from './section-heading';

export const LocalizationSection: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('en');

  const heroSlide = SAMPLE_CAMPAIGNS[0].slides[0];

  const languages: { code: LanguageCode; label: string; native: string; isBase?: boolean }[] = [
    { code: 'en', label: 'English', native: 'English', isBase: true },
    { code: 'ko', label: 'Korean', native: '한국어' },
    { code: 'ja', label: 'Japanese', native: '日本語' },
    { code: 'de', label: 'German', native: 'Deutsch' },
    { code: 'es', label: 'Spanish', native: 'Español' },
    { code: 'fr', label: 'French', native: 'Français' },
  ];

  return (
    <section className="border-t border-border bg-background py-24 text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left */}
          <Reveal className="lg:col-span-6">
            <Kicker index="04" label="Worldwide readiness" tone="violet" align="left" />

            <SectionHeading className="mt-4">
              Adaptive multi-locale reflow
            </SectionHeading>
            <p className="mt-4 text-subhead text-muted-foreground">
              German copy expands by 30%. Japanese and Korean need their own line-break rules.
              Screenova reflows hierarchy and phrasing automatically, so every locale looks
              hand-crafted, not translated.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {languages.map((lang) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLang(lang.code)}
                    className={`btn-press flex cursor-pointer items-center justify-between rounded-lg border p-3.5 text-left transition-colors duration-200 ${
                      isSelected
                        ? 'border-foreground/25 bg-muted'
                        : 'border-border bg-transparent hover:border-foreground/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-sm border transition-colors duration-200 ${
                          isSelected
                            ? 'border-transparent bg-foreground text-background'
                            : 'border-foreground/15 bg-transparent'
                        }`}
                      >
                        {isSelected && <Check aria-hidden="true" className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-foreground">{lang.label}</div>
                        <div className="text-[12px] text-muted-foreground">{lang.native}</div>
                      </div>
                    </div>

                    {lang.isBase && (
                      <span className="rounded-xs bg-muted px-2 py-0.5 text-caption font-semibold text-muted-foreground">
                        Base
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center gap-2 text-[12px] text-muted-foreground">
              <Globe2 aria-hidden="true" className="h-4 w-4 text-primary" />
              <span>Full export bundle includes localized folders ready for App Store Connect.</span>
            </div>
          </Reveal>

          {/* Right */}
          <Reveal className="flex justify-center lg:col-span-6">
            {/* Illustrative mockup: its fake app headings and icons stay out of the
                accessibility tree and the page heading outline. */}
            <div aria-hidden="true" className="flex w-full max-w-sm justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedLang}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className="scale-[0.82] origin-top sm:scale-[0.88]"
                >
                  <AppStoreSlideCard
                    slide={heroSlide}
                    language={selectedLang}
                    isSelected={false}
                    showIndexBadge={false}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
