// Shared design tokens for the marketing site.
// Kept in one place so every section pulls from the same restrained palette
// instead of re-inventing a color per component.
//
// Approved quiet-studio palette: neutral surfaces, near-black type, and a
// single blue accent (legacy violet aliases below). No gradients as
// decoration — accents are earned (links, active states, one CTA) rather
// than sprinkled for "AI product" flavor.
//
// Values reference the CSS custom properties defined in globals.css so that
// anything using these tokens in inline styles (e.g. Kicker) automatically
// follows the light/dark toggle without needing to read theme state itself
// — see the `.screenova-dark` override in globals.css and useTheme.ts.

export const color = {
  bg: 'var(--bg)',
  bgRaised: 'var(--bg-raised)',
  bgInset: 'var(--bg-inset)',
  line: 'var(--line)',
  lineStrong: 'var(--line-strong)',
  ink: 'var(--ink)',
  inkMuted: 'var(--ink-muted)',
  inkFaint: 'var(--ink-faint)',
  violet: 'var(--violet)',
  violetStrong: 'var(--violet-strong)',
  violetSoft: 'var(--violet-soft)',
  // Kept for backward compatibility with existing tone="gold" call sites —
  // resolves to the same violet accent so the palette stays single-accent.
  gold: 'var(--violet-strong)',
  goldSoft: 'var(--violet-soft)',
} as const;

// Mirrors --ease-out / --ease-in-out in globals.css so framer-motion and CSS
// transitions share one easing vocabulary (DESIGN.md: minimal, functional).
export const ease = {
  out: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
};
