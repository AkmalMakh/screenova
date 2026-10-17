"use client";
import React from 'react';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support';

interface FooterProps {
  onOpenTemplates: () => void;
  onOpenPricing: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenTemplates, onOpenPricing }) => {
  return (
    <footer className="border-t border-black/[0.06] bg-[#F5F5F7] py-14 text-black dark:border-white/[0.06] dark:bg-[#111113] dark:text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="space-y-3 md:col-span-6">
            <div className="flex items-center gap-2">
              <span className="font-sans text-lg italic text-black dark:text-white">S.</span>
              <span className="text-[13px] font-semibold tracking-tight text-black dark:text-white">Screenova</span>
            </div>
            <p className="max-w-xs text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-500">
              The AI design workspace for app stores. Build high-converting mobile campaigns in
              seconds.
            </p>
            <p className="pt-3 text-[12px] text-neutral-400 dark:text-neutral-600">
              © {new Date().getFullYear()} Screenova Inc. All rights reserved.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3 md:col-span-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-500">
              Product
            </h4>
            <ul className="space-y-2 text-[12px] text-neutral-600 dark:text-neutral-400">
              <li>
                <a href="#product" className="transition-colors hover:text-black dark:hover:text-white">
                  Features &amp; showcase
                </a>
              </li>
              <li>
                <button onClick={onOpenTemplates} className="cursor-pointer transition-colors hover:text-black dark:hover:text-white">
                  Templates &amp; presets
                </button>
              </li>
              <li>
                <a href="#pricing" onClick={onOpenPricing} className="transition-colors hover:text-black dark:hover:text-white">
                  Pricing plans
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3 md:col-span-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-500">
              Resources
            </h4>
            <ul className="space-y-2 text-[12px] text-neutral-600 dark:text-neutral-400">
              <li>
                <span className="cursor-pointer transition-colors hover:text-black dark:hover:text-white">
                  App Store Connect specs
                </span>
              </li>
              <li>
                <span className="cursor-pointer transition-colors hover:text-black dark:hover:text-white">
                  Google Play asset guidelines
                </span>
              </li>
              <li>
                <span className="cursor-pointer transition-colors hover:text-black dark:hover:text-white">
                  Localization best practices
                </span>
              </li>
              <li>
                <span className="cursor-pointer transition-colors hover:text-black dark:hover:text-white">
                  Editorial typography system
                </span>
              </li>
              <li>
                <a href={SUPPORT_MAILTO} className="transition-colors hover:text-black dark:hover:text-white" title={`Email ${SUPPORT_EMAIL}`}>
                  Contact support
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};
