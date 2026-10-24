# Design System — Screenova

Approved on 2026-10-16 through `/design-consultation`. This file is the
canonical design source for the landing page, Studio, and editor. It supersedes
`design-md/apple/DESIGN.md`. Approval covers the design direction and this
documentation. The live application styling was subsequently applied on
2026-10-16 at the user's request; verification details are in
`skills/app-store-screenshots/template/TESTING.md`.

## Product Context

- **What this is:** A web studio for turning app captures, an app description,
  and reference links into editable App Store and Google Play screenshot decks.
- **Who it's for:** Indie app developers who want polished release assets
  without needing to become designers.
- **Space:** App marketing and screenshot creation.
- **Project type:** Creative web application with a separate marketing site.
- **Service boundary:** Local installations use an account-free workspace on
  the operator's computer. Hosted installations use Supabase authentication
  and private per-account project and image storage. Match entry-point copy to
  the installation mode. Public launch remains gated on verified sign-in and
  hosted account-isolation tests. Do not imply that payments, team collaboration,
  or direct store publishing exist.

## Memorable Thing

“The tool already knows what good looks like.” Give users a considered starting
point, then make it easy to refine. One recommended direction, with discoverable
alternatives. Never hide manual editing or make AI a prerequisite for export.

## Aesthetic Direction

- **Direction:** The quiet studio. Light-first, precise, Apple-inspired.
- **Decoration:** Minimal. Typography, alignment, surface separation, and the
  screenshot artwork carry the hierarchy.
- **Mood:** Confident, familiar, focused. The canvas receives more attention
  than the surrounding controls.
- **Safe choices:** Familiar editor navigation, contextual settings, visible
  save/export status, consistent device and language controls.
- **Deliberate risks:** Lead with a recommended deck instead of a large choice
  catalog; prioritize canvas space and reveal detailed controls on selection.
  Recommendations must be replaceable and advanced controls discoverable.
- **Reference sites:** https://appscreens.com/, https://screenshots.pro/,
  https://appscreenshotstudio.com/. Research inspected public homepages, not
  authenticated editors. These inform workflows, not a mandate to copy styling.

These rules govern application chrome, not the user's exported artwork.
Screenshot decks may use different fonts, colors, decoration, and compositions.
The green Bloom deck in the preview is example content, not the product palette.

## Typography

- **Display/Hero:** Apple system family, semibold, tight tracking.
- **Body:** Same family, regular weight.
- **UI/Labels:** Same family, medium or semibold.
- **Data/Tables:** Same family with `font-variant-numeric: tabular-nums`.
- **Code:** `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`, only
  for actual code or technical identifiers.
- **Loading:** No remote font requirement for application chrome. Use
  `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
  SF resolves on supported Apple systems; other platforms use their fallbacks.
  Retaining this system family was an explicit choice to preserve the existing
  Apple-inspired direction, rather than introducing new display/body families.

| Role | Size / line-height | Weight | Tracking |
| --- | --- | --- | --- |
| Marketing display | 48–56px / 1.05; 36–42px on phones | 600 | -0.04em |
| Studio introduction | 34px / 1.15; 28px on phones | 600 | -0.035em |
| Page title | 28px / 1.2 | 600 | -0.035em |
| Section title | 21px / 1.25 | 600 | -0.015em |
| Card title | 17px / 1.3 | 600 | -0.01em |
| Body | 17px / 1.5 | 400 | 0 |
| Compact body | 15px / 1.45 | 400 | 0 |
| Controls/labels | 13px / 1.4 minimum | 500 | 0 |
| Helper text | 12px / 1.4 minimum | 400 | 0 |

Inputs and textareas are at least 16px. CJK interface text gets 1px more than
equivalent Latin text. Headings must not be smaller than their body text.
The small text inside scaled artwork thumbnails is not application helper text.

## Color

Restrained: one blue action/selection accent plus neutral surfaces and semantic
feedback. Do not introduce a competing decorative accent in the app chrome.

| Role | Light | Dark |
| --- | --- | --- |
| Page canvas | `#F5F5F7` | `#111113` |
| Surface | `#FFFFFF` | `#1C1C1E` |
| Elevated surface | `#FFFFFF` with subtle shadow | `#2C2C2E` |
| Editor workspace | `#EAEAEC` | `#141416` |
| Primary ink | `#131316` | `#F5F5F7` |
| Secondary ink | `#6E6E77` | `#AAAAB2` |
| Decorative separator | `#DEDEE3` | `#38383C` |
| Primary action/selection | `#006FE6` | `#409CFF` |
| Soft selected surface | `#EAF3FF` | `#152C45` |
| Success | `#248A3D` | `#63D17D` |
| Warning | `#B25000` | `#FFB866` |
| Error | `#D70015` | `#FF7180` |
| Information | Same as primary action | Same as primary action |

Light primary buttons use white text; dark primary buttons use `#071524`.
Light pressed blue is `#0058B8`. Dark mode uses independently stepped surfaces,
not inversion. Keep the user's artwork unchanged when switching UI appearance.
Decorative separators are not sufficient as the sole visible boundary of a
control. Verify actual text/background pairs at 4.5:1 for normal text and 3:1
for large text and essential non-text indicators. Color never carries state alone.

## Spacing

- **Base unit:** 4px, with an 8px working rhythm.
- **Scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px.
- **Density:** Compact within inspector/control groups; comfortable between
  groups; spacious marketing layouts.
- Prefer established scale values over arbitrary per-component spacing.

## Layout

- **Approach:** Grid-disciplined app; asymmetric text-and-artwork marketing.
- **Grid:** 12 columns and 24px gutters on desktop; single-column primary
  content below 768px. Reflow panels before controls become cramped.
- **Widths:** Reading content 980px; Studio content about 1280px; editor fills
  the available viewport. The consultation preview's outer navigation is not
  part of the live product layout.
- **Studio:** Description, reference links, and upload in one obvious creation
  area. Show recent projects beneath. Keep primary input above the fold.
- **Editor:** Screen navigation, central canvas, contextual inspector. Initial
  desktop panel targets: 184px navigation and 250px inspector, responsive to
  available width. Preserve canvas pan, zoom, and connected-deck behavior.
  - Opens manual-first: screens list and inspector open from 1024px, screens
    only on tablets, nothing on phones; the layout is remembered per browser.
    The left slot holds the screens list or the design chat, never both.
  - Panels, the AI composer and canvas HUDs float over a full-bleed canvas
    and are laid out from one geometry, so none overlaps another. Below
    1024px only one side panel opens at a time.
  - The canvas frames the active screen inside the area no chrome covers.
    Toggling a panel moves the canvas only when the new chrome would cover
    the screen being edited; a user's zoom is never reset by a panel or a
    window resize.
  - Selection chrome (outlines, handles, screen numbers) is sized in screen
    pixels at every zoom. A selection leads the inspector.
  - The toolbar is one row that never wraps on tablet and desktop; phones get
    a deliberate second row for design controls.
- **Small screens:** Put navigation and settings into accessible reflowed
  panels or sheets; do not squeeze desktop sidebars into a phone viewport.
- **Landing:** Show a real finished deck alongside the main message. One
  dominant creation action. Marketing content belongs here, not above Studio.
- **Border radius:** Small controls/chips 6px; inputs/buttons 8px; panels/cards
  12px; large surfaces/sheets 18px. Pills are reserved for status tags and
  segmented-control thumbs.

## Motion

- **Approach:** Minimal and functional. Explain selection, panel changes, and
  actual Before/After proposals; do not animate for decoration.
- **Easing:** Enter `cubic-bezier(0.2, 0.8, 0.2, 1)`; exit
  `cubic-bezier(0.4, 0, 1, 1)`; move `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Duration:** Micro 120ms; short 200ms; medium 300ms; sheet/modal up to 400ms.
- **Tokens:** `--ease-out`, `--ease-in`, `--ease-in-out` and `--dur-micro/short/
  medium/sheet` in `globals.css`, exposed as Tailwind `ease-out`, `ease-in`,
  `ease-move` and `duration-micro/short/medium/sheet`. Use the names, not
  ad-hoc values. Exits are shorter than entrances.
- **Functional motion in the app:** panels slide in from their own edge,
  menus scale from their trigger, segmented controls glide to the new
  choice, zoom and reframing glide, the save check pops once per real save.
- **One approved exception:** the landing hero's real output deck rises into
  place once on load (300ms, staggered). No other decorative motion.
- Prefer transform and opacity for spatial motion. Never `transition: all`.
- Honor reduced-motion preferences throughout.
- Do not put persistent `will-change: transform` or filters on the full-size
  unscaled editor world; preserve the existing canvas rendering performance.

## Controls, Accessibility, and Honest States

- Minimum 44×44px hit targets, even when a control looks smaller.
- Visible keyboard focus, labeled icon buttons, sensible heading order,
  landmarks, keyboard-operable tabs and dialogs, and declared color scheme.
- Keep sticky chrome from obscuring focused controls or anchored content.
- Do not use low opacity to represent an enabled primary action.
- Links in descriptions become visible, removable reference chips without
  destroying the original text. Preserve the existing deduplication/limit rules.
- Show pending, failure, retry, empty, and success states where actions occur.
- Show “Saved” only after the actual save succeeds. Export state must reflect
  actual preparation, download, or failure rather than a cosmetic animation.
- Before/After compares real project states. The preview's saturation demo is
  illustrative only and must not be copied into the application behavior.
- Template and project previews must reflect their actual content. The
  consultation's sample names, counts, timestamps, and phone contents are fixtures.
- Avoid decorative violet gradients, gradient primary buttons, uniform pill
  corners, centered app body copy, and competing primary actions.

## Approved Preview and Implementation Boundary

Approved HTML: `~/.gstack/projects/AkmalMakh-DesignPage/designs/design-system-20261016/preview.html`.
Includes Studio, Editor, Landing, and design-system views with light/dark modes.
Browser checks covered tab switching, theme switching, sample headline editing,
desktop/390px horizontal overflow, and console errors. This was a concept
verification, not a full accessibility audit. The subsequent live implementation
uses real project data and preserves editing, reference detection, and export
behavior rather than copying the preview's illustrative actions.

Implementation defaults retained or resolved from the existing system include
the type scale details, semantic dark colors, responsive panel behavior, and
accessibility requirements. The visual direction and preview were approved as
a package; individual pixel values were not separately reviewed.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-10-16 | Refine the existing Apple-inspired system | Preserve familiar controls and focus on the user's artwork. |
| 2026-10-16 | Research three public competitor sites | Compare template-led and description-led entry points. |
| 2026-10-16 | Approve the quiet-studio HTML preview | One coordinated direction across Studio, Editor, and Landing. |
| 2026-10-16 | Make this root document canonical | Replace competing UI guidance with one source of truth. |
| 2026-10-16 | Keep chrome separate from exported artwork | App branding must not restrict users' screenshot styles. |
| 2026-10-16 | Apply the direction to the live app | Shared light/dark appearance, Studio creation and recent projects, separated editor panels, and output-led landing. |
| 2026-10-18 | Editor opens manual-first and remembers its layout | "Never hide manual editing"; the AI composer stays visible between the panels. |
| 2026-10-18 | Name the motion tokens; allow one landing entrance | Polish the user asked for, with one recorded exception to "no decorative motion". |
| 2026-10-18 | Canvas moves only when chrome would cover the screen | Minimal motion: a panel toggle must not drag the deck out from under the cursor. |
| 2026-10-19 | Public template gallery (`/gallery`) | Owner-approved. Users publish a deck's design; others reuse it as a template with their own screenshots. Publishing is opt-in and explicit about what becomes public; it is sharing, not team collaboration. |
| 2026-10-19 | Studio home follows the owner's reference layout | Owner-approved exception to the pill and decoration rules for `/studio` only: floating projects/gallery panel, quiet dot grid, large welcome title, rounded-pill actions and chips, and a gallery-fed "Need inspiration?" carousel. Built-in starter templates removed. Colors and type stay on the tokens above. |
| 2026-10-19 | Landing follows the owner's reference (stitch.google.com) | Owner-approved exception for `/` only: always-dark page with dot grid, a blue-violet horizon glow, centered hero composer that hands prompt and device to Studio, demo card, gallery-fed template carousel, feature cards, closing CTA, FAQ and minimal footer. Pricing, comparison and other legacy marketing sections removed; no appearance toggle on the landing. |
