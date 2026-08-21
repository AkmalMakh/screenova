// Shared design tokens for the marketing site.
// Kept in one place so every section pulls from the same restrained palette
// instead of re-inventing a color per component.
//
// Light editorial palette: warm off-white paper, near-black type, and a
// single restrained violet accent. No gold/dual-accent, no gradients as
// decoration — accents are earned (links, active states, one CTA) rather
// than sprinkled for "AI product" flavor.
//
// Values reference the CSS custom properties defined in index.css so that
// anything using these tokens in inline styles (e.g. Kicker) automatically
// follows the light/dark toggle without needing to read theme state itself
// — see the `.dark` override block in index.css and useTheme.ts.

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

export const ease = {
  out: [0.23, 1, 0.32, 1] as [number, number, number, number],
  inOut: [0.77, 0, 0.175, 1] as [number, number, number, number],
};
