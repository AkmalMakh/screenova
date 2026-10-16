# Design System — Apple HIG

> Historical reference, superseded on 2026-10-16 by the approved
> [root design system](../../DESIGN.md). Use that file for current UI decisions.
> This document preserves the earlier direction; conflicting values below are
> not current requirements.

The standard `/studio` and the landing surfaces are measured against.
Derived from Apple's Human Interface Guidelines and apple.com's own marketing
system, calibrated to what this codebase already renders.

## Product Context

- **What this is:** A studio that turns an app's raw screenshots into a
  finished App Store screenshot deck — describe the app, attach shots, get an
  editable template deck. Also imports a real listing from an App Store URL.
- **Who it's for:** Indie iOS developers who have a shipped app and a bad
  product page, and who are not designers.
- **Why Apple HIG:** The output of this tool lands on the App Store. A tool
  that produces App Store assets should look like it belongs there. Any other
  design language creates a credibility gap between the editor and the artifact.

## Memorable Thing

A developer who is bad at design should feel like the tool already knows what
good looks like. Confidence transferred, not taste demanded. Every decision
serves this: the tool asserts defaults instead of asking questions.

## Aesthetic Direction

- **Direction:** Apple system UI, LIGHT default.
- **Decoration level:** Near-zero. Depth, translucency, and type weight carry
  hierarchy. No gradients as CTAs, no decorative blobs, no icon-in-circle
  section markers, no illustration filling empty space.
- **Mood:** Precise, quiet, inevitable. The chrome disappears; the artboard is
  the subject.
- **Anti-goal:** the pastel AI-SaaS look — violet gradients, pill-everything,
  three-column feature grids, centered marketing copy inside an app route.

## Typography

- **Family:** the Apple system stack, one stack everywhere.
  `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  Exactly one stack. Tailwind's default `ui-sans-serif` stack must not leak in.
- **Rationale for accepting a system font:** on Apple platforms this resolves to
  SF Pro, which is a real typeface with optical sizing — not a fallback. This is
  the one context where the system stack is the considered choice rather than
  the absence of one.

### Type ramp (the only sizes allowed)

| Role | Size / Line height | Weight | Tracking |
|------|-----|--------|----------|
| Display (marketing h1) | 48–56 / 1.05 | 600 | -0.02em |
| Title 1 (page h1, app) | 28 / 1.2 | 600 | -0.02em |
| Title 2 (section h2) | 21 / 1.25 | 600 | -0.015em |
| Title 3 (card h3) | 17 / 1.3 | 600 | -0.01em |
| Body | 17 / 1.5 | 400 | 0 |
| Body compact (dense UI) | 15 / 1.45 | 400 | 0 |
| Subhead / control label | 13 / 1.4 | 500 | 0 |
| Footnote (helper text) | 12 / 1.4 | 400 | 0 |

**Floors, non-negotiable:**
- Nothing below **12px**, ever.
- Any **control** a user reads to make a choice (segmented buttons, tabs,
  selector pills, nav links) is **13px minimum**.
- **CJK glyphs get +1px** over their Latin equivalent — 中文/日本語/한국어 need
  more size than Latin to resolve the same stroke detail.
- Any `<input>` or `<textarea>` is **16px minimum** — below that iOS Safari
  auto-zooms the viewport on focus.
- `font-variant-numeric: tabular-nums` on counters, dimensions, timestamps.

**Hierarchy rule:** an `<h2>` may never render smaller than body text. If a
section label wants to be small and quiet, it is a styled `<div>` eyebrow, not
a heading — do not invert the document outline to get a visual effect.

## Color

One accent. Color carries meaning, never decoration.

- **Canvas:** `#F5F5F7` (Apple's system page gray)
- **Surface:** `#FFFFFF` · **Surface raised:** `#FFFFFF` + shadow, not a tint
- **Translucent chrome:** `rgba(247,247,248,0.72)` + `backdrop-filter: blur(20px) saturate(1.8)`
- **Ink:** `#131316` · **Secondary:** `#6E6E77` · **Tertiary:** `#8E8E93`
- **Separator:** `rgba(0,0,0,0.08)` — hairlines, never 1px solid mid-gray
- **Accent — systemBlue:** `#006FE6` (rest) / `#0058B8` (pressed)
- **Semantic:** success `#248A3D` · warning `#B25000` · error `#D70015`
- **Dark mode:** canvas `#000000`, surface `#1C1C1E`, elevated `#2C2C2E`, ink
  `#F5F5F7`, accent lifts to `#0A84FF`. Elevation by surface step, never by
  lightening the same color.

**Forbidden:** violet/indigo as accent or decoration (`#8B5CF6`, `#5B7CFA` and
neighbours), more than one blue in the accent role, gradient CTAs, color as the
sole carrier of state.

**Contrast:** body ≥ 4.5:1, large text and UI component boundaries ≥ 3:1.
`#6E6E77` on white is 5.05:1 — compliant, but only at 13px+.

## Spacing

- **Base unit:** 4px, with 8px as the working rhythm.
- **Scale:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80
- **Density:** compact in the tool, generous in marketing surfaces.
- No arbitrary values. If a gap wants 18px, it takes 16 or 20.

## Layout

- **Max content width:** 980px for reading surfaces, 1280px for the studio
  workspace, full-bleed for the artboard.
- **Grid:** 12-column, 24px gutters desktop; single column below 768px.
- **Breakpoints:** 390 (phone) · 768 (tablet) · 1024 (laptop) · 1440 (desktop).
- **Sticky chrome:** any sticky header must reserve its own height as
  `scroll-margin-top` on focusable and anchored content. Sticky chrome that
  occludes content on focus is a defect, not a tradeoff.
- **App routes do not open with marketing.** `/studio` is a tool. The primary
  input is above the fold on every breakpoint. Persuasion lives on `/`.

### Border radius (hierarchy, not uniformity)

| Element | Radius |
|---------|--------|
| Inline control, chip, small button | 6px |
| Input, standard button, segmented control | 8px |
| Card, panel, modal | 12px |
| Large surface, artboard frame, sheet | 18px |
| True pill (999px) | status tags and segmented-control thumbs only |

Nested radius = outer radius − padding gap. Pills are an exception granted to a
handful of elements, not the default shape of the interface.

## Motion

- **Approach:** short, spatial, mostly invisible. Motion explains where a thing
  came from. Nothing animates to be noticed.
- **Easing:** enter `cubic-bezier(0.2, 0.8, 0.2, 1)` · exit `cubic-bezier(0.4, 0, 1, 1)` · move `cubic-bezier(0.4, 0, 0.2, 1)`
- **Duration:** micro 120ms · short 200ms · medium 300ms · sheet/modal 400ms
- **Animate `transform` and `opacity` only.** Never `transition: all` — it
  animates layout properties, defeats compositing, and delays focus rings.
- **`prefers-reduced-motion: reduce` must neutralize every transition and
  animation**, not a named subset of utility classes.

## Controls

- **Touch targets:** 44×44px minimum on every interactive element at every
  breakpoint. A 28px-tall pill is a desktop-only affordance and is not
  acceptable on a route that renders on phones. Visual size may stay small if
  the hit area is padded out to 44px.
- **Focus:** every interactive element shows a visible `:focus-visible` ring —
  2px systemBlue at 60% over a 1px white spacer. Never `outline: none` without
  an equivalent replacement.
- **Segmented controls** (device, language): a single track with a sliding
  thumb, not N independent pills. One selected state, tabular label sizing.
- **Disabled vs low-emphasis:** a pale-blue button reads as disabled. If a
  button is enabled and waiting for input, it is full-strength with a
  low-emphasis *style*, not a low-opacity primary.

## Accessibility

- Landmarks on every page: `<header>`, `<nav>`, `<main>`. `<footer>` where one exists.
- Exactly one `<h1>`; no skipped heading levels; outline order matches visual order.
- `aria-label` on every icon-only control.
- `color-scheme` declared on `<html>` so form controls and scrollbars match.
- No autofocus that scrolls the viewport. Focus the primary input only when the
  element is already in view, or use `preventScroll: true`.

## Anti-patterns (instant findings)

1. Violet or indigo anywhere in the palette.
2. Text below 12px. Controls below 13px. Inputs below 16px.
3. `<h2>` rendering smaller than body text.
4. Touch targets below 44px on a responsive route.
5. `transition: all`.
6. Pill radius as the default shape (>15 pills on one screen).
7. Icon-in-a-colored-circle as a section or empty-state marker.
8. Centered body copy in an app surface.
9. Marketing hero above the tool on an app route.
10. More than one entry point competing for "the primary action".
11. More than one font stack.
12. Sticky chrome occluding content after programmatic focus.
