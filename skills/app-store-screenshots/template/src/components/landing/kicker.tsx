"use client";
import React from 'react';
import { color } from './theme';

interface KickerProps {
  index?: string;
  label: string;
  tone?: 'violet' | 'gold' | 'neutral';
  align?: 'left' | 'center';
  className?: string;
}

// 'gold' is kept as an accepted value so existing call sites don't need to
// change, but it now resolves to the same violet accent — the palette is
// single-accent by design.
const toneColor: Record<NonNullable<KickerProps['tone']>, string> = {
  violet: color.violetStrong,
  gold: color.violetStrong,
  neutral: color.inkMuted,
};

/**
 * Replaces the "pill badge + sparkle icon" pattern that otherwise gets
 * copy-pasted into every section. A quiet, numbered editorial label
 * instead — it reads as designed rather than templated, and it lets the
 * violet/gold accents stay reserved for moments that actually earn them.
 */
export const Kicker: React.FC<KickerProps> = ({
  index,
  label,
  tone = 'gold',
  align = 'center',
  className = '',
}) => {
  const accent = toneColor[tone];
  return (
    <div
      className={`flex items-center gap-3 ${align === 'center' ? 'justify-center' : 'justify-start'} ${className}`}
    >
      {index && (
        <span className="font-mono text-[12px] tabular-nums" style={{ color: accent }}>
          {index}
        </span>
      )}
      <span className="h-px w-8" style={{ backgroundColor: accent, opacity: 0.45 }} />
      <span className="text-[12px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
};
