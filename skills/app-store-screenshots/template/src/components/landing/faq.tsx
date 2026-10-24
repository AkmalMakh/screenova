"use client";
import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'Do I need an account to use Screenova?',
    a: 'Not in local mode. Open Studio and start designing; projects stay on your computer without sign-in or email verification. Cloud installations require a verified email account.',
  },
  {
    q: 'Do I need my own OpenAI key?',
    a: 'For a local installation, the operator configures an OpenAI key on the server. In the hosted beta, the organizer provides it and daily usage limits apply. Keys are never sent to the browser. Manual editing and exports do not require AI.',
  },
  {
    q: 'If the AI generates a background, can I still edit it afterward?',
    a: 'Generated shapes, gradients, and text remain editable canvas elements. Image-generated artwork is a raster backdrop: you can replace it, remove it, or change its opacity, but not edit individual objects inside that image.',
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
    a: 'Start with an editable template or ask AI to draft a deck from your actual screenshots. Refine text, layouts, and device framing in the editor, including connected compositions that cross screen boundaries.',
  },
  {
    q: 'Where does my project live?',
    a: 'Cloud mode stores project designs and images privately under your account. Local mode keeps a JSON workspace and images on your computer. Design-chat history stays in your browser, and exported PNG/ZIP files download to your device.',
  },
];

export const FAQ: React.FC<{ cloud?: boolean }> = ({ cloud = false }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqs = FAQS.map((item) => {
    if (!cloud) return item;
    if (item.q === 'Do I need an account to use Screenova?') return {
      ...item, a: 'Yes. Sign in to create your private workspace, save projects, and return to your designs on another device.',
    };
    if (item.q === 'Do I need my own OpenAI key?') return {
      ...item, a: 'No. Screenova handles the server-side AI connection. Daily generation limits apply. Manual editing and exports do not require AI.',
    };
    if (item.q === 'Where does my project live?') return {
      ...item, a: 'Project designs and images are stored privately under your account. Design-chat history stays in your browser, and exported PNG/ZIP files download to your device.',
    };
    return item;
  });

  return (
    <section aria-labelledby="faq-title" className="px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-[760px]">
        <h2 id="faq-title" className="text-center text-[32px] font-normal tracking-[-0.02em] sm:text-[44px]">
          Frequently asked questions
        </h2>
        <div className="mt-10 space-y-2">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="rounded-[14px] bg-white/[0.07] transition-colors hover:bg-white/[0.1]">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="text-[16px] text-white">{item.q}</span>
                  <Plus aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                  />
                </button>
                {/* Answers stay in the DOM (crawlers, find-in-page). */}
                <div id={`faq-answer-${idx}`} hidden={!isOpen}>
                  <p className="max-w-2xl px-5 pb-5 text-[15px] leading-relaxed text-white/70">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
