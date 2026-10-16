"use client";
import React from 'react';
import { RevealGroup, fadeUp } from './reveal';
import { motion } from 'motion/react';

export const SocialProof: React.FC<{ cloud?: boolean }> = ({ cloud = false }) => {
  const stats = [
    { value: '7', label: 'Languages', desc: 'Auto-localized, one click' },
    { value: '6', label: 'Device targets', desc: 'iPhone to feature graphic' },
    { value: 'Editable', label: 'Your design', desc: 'Refine text, shapes and layouts' },
    { value: 'Yours', label: 'Where it lives', desc: cloud ? 'Private account storage' : 'Saved on your computer' },
  ];

  return (
    <section className="border-y border-black/[0.06] bg-[#F5F5F7] py-12 text-black dark:border-white/[0.06] dark:bg-[#111113] dark:text-white">
      <RevealGroup className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            variants={fadeUp}
            className={`flex flex-col items-center gap-1 py-4 text-center ${
              idx > 0 ? 'border-l border-black/[0.06] dark:border-white/[0.06]' : ''
            }`}
          >
            <div className="font-sans text-2xl italic text-black sm:text-3xl dark:text-white">
              {stat.value}
            </div>
            <div className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">{stat.label}</div>
            <div className="text-[12px] text-neutral-500 dark:text-neutral-500">{stat.desc}</div>
          </motion.div>
        ))}
      </RevealGroup>
    </section>
  );
};
