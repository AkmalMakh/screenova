"use client";
import React, { useEffect, useState } from 'react';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { Theme } from './use-theme';

interface NavbarProps {
  onOpenStudio: (prompt?: string) => void;
  onOpenTemplates: () => void;
  onOpenPricing: () => void;
  onOpenLogin: () => void;
  currentView?: 'landing' | 'studio';
  onNavigateHome?: () => void;
  theme?: Theme;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenStudio,
  onOpenTemplates,
  onOpenPricing,
  onOpenLogin,
  currentView = 'landing',
  onNavigateHome,
  theme = 'light',
  onToggleTheme,
}) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      id="main-header"
      className={`sticky top-0 z-40 w-full transition-colors duration-300 [transition-timing-function:var(--ease-out)] ${
        scrolled
          ? 'border-b border-border bg-background/85 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand mark — quiet monogram, no gradient icon chip */}
        <button type="button" aria-label="Screenova home"
          onClick={onNavigateHome}
          className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-75"
          id="brand-logo"
        >
          <span className="font-sans text-[19px] italic text-foreground">S.</span>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            Screenova
          </span>
        </button>

        {/* Center Nav Links */}
        <nav className="hidden items-center gap-9 md:flex" id="nav-links">
          <a
            href="#product"
            className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Showcase
          </a>
          <button
            onClick={onOpenTemplates}
            className="cursor-pointer text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Templates
          </button>
          <a
            href="#pricing"
            onClick={(e) => {
              if (currentView === 'studio') {
                e.preventDefault();
                onOpenPricing();
              }
            }}
            className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </a>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {onToggleTheme && (
            <button
              id="theme-toggle-btn"
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="btn-press flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {theme === 'dark' ? <Sun aria-hidden="true" className="h-3.5 w-3.5" /> : <Moon aria-hidden="true" className="h-3.5 w-3.5" />}
            </button>
          )}

          <button
            id="login-btn"
            onClick={onOpenLogin}
            className="hidden text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Your workspace
          </button>

          <button
            id="get-started-btn"
            onClick={() => onOpenStudio()}
            className={`btn-press group inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-4 py-2 text-[12px] font-semibold transition-colors ${
              currentView === 'landing'
                // The hero owns the primary action on the landing; the header
                // CTA steps down to an outlined secondary so one blue button
                // leads the first viewport.
                ? 'border border-foreground/15 text-foreground hover:border-foreground/35'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            <span>Open Studio</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
