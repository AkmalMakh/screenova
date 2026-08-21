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
          ? 'border-b border-black/[0.08] bg-[#FAF9F6]/85 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#07080a]/80'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand mark — quiet monogram, no gradient icon chip */}
        <div
          onClick={onNavigateHome}
          className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-75"
          id="brand-logo"
        >
          <span className="font-serif-headline text-[19px] italic text-black dark:text-white">S.</span>
          <span className="text-[13px] font-semibold tracking-tight text-black dark:text-white">
            Screenova
          </span>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden items-center gap-9 md:flex" id="nav-links">
          <a
            href="#product"
            className="text-[12px] font-medium text-neutral-500 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-white"
          >
            Showcase
          </a>
          <button
            onClick={onOpenTemplates}
            className="cursor-pointer text-[12px] font-medium text-neutral-500 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-white"
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
            className="text-[12px] font-medium text-neutral-500 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-white"
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
              className="btn-press flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-black/[0.08] text-neutral-600 transition-colors hover:border-black/20 hover:text-black dark:border-white/[0.1] dark:text-neutral-400 dark:hover:border-white/25 dark:hover:text-white"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          )}

          <button
            id="login-btn"
            onClick={onOpenLogin}
            className="hidden text-[12px] font-medium text-neutral-500 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-white sm:block"
          >
            Sign in
          </button>

          <button
            id="get-started-btn"
            onClick={() => onOpenStudio()}
            className="btn-press group inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-black px-4 py-2 text-[12px] font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            <span>Open Studio</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
