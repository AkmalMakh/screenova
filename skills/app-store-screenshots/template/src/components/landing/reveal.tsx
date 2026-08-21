"use client";
import React from 'react';
import { motion, Variants, HTMLMotionProps } from 'motion/react';
import { ease } from './theme';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: ease.out } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } },
};

type RevealProps = HTMLMotionProps<'div'>;

/**
 * Fades + lifts content into place once it enters the viewport.
 * Standardizes marketing-section motion so every reveal shares the
 * same easing/duration instead of bespoke per-section values.
 */
export const Reveal: React.FC<RevealProps> = ({ children, ...rest }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-80px' }}
    {...rest}
  >
    {children}
  </motion.div>
);

/**
 * Wrap a group of children (e.g. a card grid) to stagger their
 * individual Reveal entrances rather than firing them all at once.
 */
export const RevealGroup: React.FC<RevealProps> = ({ children, ...rest }) => (
  <motion.div
    variants={staggerContainer}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-80px' }}
    {...rest}
  >
    {children}
  </motion.div>
);
