"use client";
import React from 'react';
import { ScreenshotSlide, LanguageCode } from './types';
import { PhoneMockup } from './phone-mockup';

interface AppStoreSlideCardProps {
  slide: ScreenshotSlide;
  language?: LanguageCode;
  scale?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  showIndexBadge?: boolean;
  className?: string;
}

export const AppStoreSlideCard: React.FC<AppStoreSlideCardProps> = ({
  slide,
  language = 'en',
  scale = 1,
  isSelected = false,
  onSelect,
  showIndexBadge = true,
  className = '',
}) => {
  const categoryText = slide.category[language] || slide.category.en;
  const headlineText = slide.headline[language] || slide.headline.en;
  const subtitleText = slide.subtitle[language] || slide.subtitle.en;

  return (
    <div
      onClick={onSelect}
      className={`relative cursor-pointer transition-transform duration-200 group ${className}`}
    >
      {/* Optional selection outline */}
      {isSelected && (
        <div className="absolute -inset-1.5 rounded-[36px] border-2 border-[#6E3FF3] pointer-events-none z-30 shadow-lg shadow-indigo-500/20" />
      )}

      {/* Screen Index badge in upper left */}
      {showIndexBadge && (
        <div className="absolute top-3 left-3 z-20 flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600/90 text-[11px] font-bold text-white shadow-md backdrop-blur-sm">
          {slide.screenIndex}
        </div>
      )}

      {/* Main Slide Card Canvas */}
      <div
        className="relative overflow-hidden rounded-[30px] border border-neutral-800/80 shadow-2xl flex flex-col justify-between"
        style={{
          width: '360px',
          height: '780px',
          background: slide.gradient || 'linear-gradient(180deg, #101738 0%, #0C122C 50%, #080D20 100%)',
        }}
      >
        {/* Ambient Top & Center Radial Lighting Glow */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute top-[30%] left-[-20%] w-[250px] h-[250px] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        {/* Top Text Header Section */}
        <div className="relative z-10 px-8 pt-8 text-center flex flex-col items-center">
          {/* Lavender Accent Line */}
          <div
            className="h-[3px] w-14 rounded-full mb-3"
            style={{ backgroundColor: slide.accentLineColor || '#7B76E6' }}
          />

          {/* Category Eyebrow */}
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E8AE6]">
            {categoryText}
          </span>

          {/* Editorial Serif Headline */}
          <h3 className="mt-2 font-serif-headline text-3xl font-normal leading-[1.15] text-white tracking-tight px-1">
            {headlineText}
          </h3>

          {/* Subtitle */}
          <p className="mt-2.5 text-xs text-[#9EABC8] leading-relaxed max-w-[280px]">
            {subtitleText}
          </p>

          {/* Optional Rotated Flow Badge */}
          {slide.badgeText && slide.badgePosition === 'side-rotated' && (
            <div className="absolute right-4 top-14 text-[9px] font-black uppercase tracking-widest text-indigo-300/80 [writing-mode:vertical-lr] rotate-180">
              {slide.badgeText}
            </div>
          )}

          {/* Optional Pill Badge */}
          {slide.badgeText && slide.badgePosition === 'top-right' && (
            <div className="mt-2 inline-flex items-center rounded-full bg-indigo-950/80 border border-indigo-500/30 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-indigo-300">
              {slide.badgeText}
            </div>
          )}
        </div>

        {/* Device Stage Showcase */}
        <div className="relative z-10 flex-1 flex items-end justify-center overflow-hidden pb-0 px-2">
          {/* 1. Single Hero Centered */}
          {slide.layout === 'hero' && (
            <div className="translate-y-6 transform transition group-hover:-translate-y-1 duration-300">
              <PhoneMockup uiType="onboarding_hero" language={language} />
            </div>
          )}

          {/* 2. Split Landscape / Workouts */}
          {slide.layout === 'split-landscape' && (
            <div className="translate-y-8 transform transition group-hover:translate-y-2 duration-300">
              <PhoneMockup uiType="workouts_stats" language={language} />
            </div>
          )}

          {/* 3. Voice Calendar Device Bottom */}
          {slide.layout === 'device-bottom' && (
            <div className="translate-y-6 transform transition group-hover:translate-y-0 duration-300">
              <PhoneMockup uiType="voice_calendar" language={language} />
            </div>
          )}

          {/* 4. Two Devices: Budget Dashboard & Donut Chart Overlapping */}
          {slide.layout === 'two-devices' && (
            <div className="relative w-full h-[480px] flex justify-center items-end">
              {/* Back Phone: Budget Dashboard (Angled left) */}
              <div className="absolute left-[-20px] bottom-[-20px] transform -rotate-[7deg] scale-[0.88] z-10 opacity-95">
                <PhoneMockup uiType="expense_budget_dual" isSecondary={false} language={language} />
              </div>
              {/* Front Phone: Donut Breakdown (Angled right) */}
              <div className="absolute right-[-20px] bottom-[-30px] transform rotate-[6deg] scale-[0.92] z-20 shadow-2xl">
                <PhoneMockup uiType="expense_budget_dual" isSecondary={true} language={language} />
              </div>
            </div>
          )}

          {/* 5. Device Top: Daily Plan */}
          {slide.layout === 'device-top' && (
            <div className="translate-y-4 transform transition group-hover:-translate-y-1 duration-300">
              <PhoneMockup
                uiType={slide.uiType === 'diary_notes' ? 'diary_notes' : 'daily_plan_grid'}
                language={language}
              />
            </div>
          )}

          {/* 6. Routines Dual: Shifts & Cycle Overlapping */}
          {slide.layout === 'routines-dual' && (
            <div className="relative w-full h-[480px] flex justify-center items-end">
              {/* Back Phone: Cycle */}
              <div className="absolute left-[-15px] bottom-[-15px] transform -rotate-[5deg] scale-[0.88] z-10">
                <PhoneMockup uiType="routines_shift_cycle" isSecondary={false} language={language} />
              </div>
              {/* Front Phone: Shift Selector Modal */}
              <div className="absolute right-[-10px] bottom-[-20px] transform rotate-[4deg] scale-[0.92] z-20 shadow-2xl">
                <PhoneMockup uiType="routines_shift_cycle" isSecondary={true} language={language} />
              </div>
            </div>
          )}

          {/* 7. Multilingual Month */}
          {slide.layout === 'hero' && slide.uiType === 'multilingual_month' && (
            <div className="translate-y-6 transform transition group-hover:translate-y-1 duration-300">
              <PhoneMockup uiType="multilingual_month" language={language} />
            </div>
          )}

          {/* 8. Dual Sync: Light & Dark Mode side-by-side */}
          {slide.layout === 'dual-sync' && (
            <div className="relative w-full h-[480px] flex justify-center items-end">
              {/* Left Light Phone */}
              <div className="absolute left-[-25px] bottom-[-25px] transform -rotate-[6deg] scale-[0.88] z-10">
                <PhoneMockup uiType="light_dark_sync" themeMode="light" language={language} />
              </div>
              {/* Right Dark Phone */}
              <div className="absolute right-[-20px] bottom-[-20px] transform rotate-[5deg] scale-[0.92] z-20 shadow-2xl">
                <PhoneMockup uiType="light_dark_sync" themeMode="dark" language={language} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
