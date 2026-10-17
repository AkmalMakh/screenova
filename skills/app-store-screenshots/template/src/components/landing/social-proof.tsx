"use client";
import React from 'react';
import { RevealGroup, fadeUp } from './reveal';
import { motion } from 'motion/react';

// Every value here is a real product limit, not a marketing number:
// 7 content locales (see the FAQ), 6 export device targets, and the
// 10-screenshot cap enforced by Studio and the AI routes (MAX_SCREENSHOTS).
const STATS = [
  { value: '7', label: 'Languages', desc: 'Copy reflowed per locale' },
  { value: '6', label: 'Device targets', desc: 'iPhone to Play feature graphic' },
  { value: '10', label: 'Screenshots per deck', desc: 'Your real captures, not mockups' },
];

export const SocialProof: React.FC<{ cloud?: boolean }> = ({ cloud = false }) => {
  return (
    <section className="border-y border-border bg-background py-12 text-foreground">
      <RevealGroup className="mx-auto grid max-w-4xl grid-cols-3 px-4 sm:px-6">
        {STATS.map((stat, idx) => (
          <motion.div
            key={stat.label}
            variants={fadeUp}
            className={`flex flex-col items-center gap-1 px-2 py-4 text-center ${idx > 0 ? 'border-l border-border' : ''}`}
          >
            <div className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[36px]">
              {stat.value}
            </div>
            <div className="mt-1 text-footnote font-semibold">{stat.label}</div>
            <div className="hidden text-caption text-muted-foreground sm:block">{stat.desc}</div>
          </motion.div>
        ))}
      </RevealGroup>
      <p className="mt-4 px-4 text-center text-caption text-muted-foreground">
        {cloud ? 'Private account storage' : 'Saved on your computer'}, and every element stays editable.
      </p>
    </section>
  );
};
