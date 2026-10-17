"use client";
import React from 'react';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support';

interface FooterProps {
  onOpenTemplates: () => void;
  onOpenPricing: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenTemplates, onOpenPricing }) => {
  return (
    <footer className="border-t border-border bg-background py-14 text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="space-y-3 md:col-span-6">
            <div className="flex items-center gap-2">
              <span className="font-sans text-lg italic text-foreground">S.</span>
              <span className="text-[13px] font-semibold tracking-tight text-foreground">Screenova</span>
            </div>
            <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground">
              The AI design workspace for app stores. Build high-converting mobile campaigns in
              seconds.
            </p>
            <p className="pt-3 text-[12px] text-muted-foreground">
              © {new Date().getFullYear()} Screenova Inc. All rights reserved.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3 md:col-span-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Product
            </h4>
            <ul className="space-y-2 text-[12px] text-muted-foreground">
              <li>
                <a href="#product" className="transition-colors hover:text-foreground">
                  Features &amp; showcase
                </a>
              </li>
              <li>
                <button onClick={onOpenTemplates} className="cursor-pointer transition-colors hover:text-foreground">
                  Templates &amp; presets
                </button>
              </li>
              <li>
                <a href="#pricing" onClick={onOpenPricing} className="transition-colors hover:text-foreground">
                  Pricing plans
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-3 md:col-span-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Support
            </h4>
            <ul className="space-y-2 text-[12px] text-muted-foreground">
              <li>
                <a href={SUPPORT_MAILTO} className="transition-colors hover:text-foreground" title={`Email ${SUPPORT_EMAIL}`}>
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
