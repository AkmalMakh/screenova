# App Store Screenshots — Editor Template

A pre-built Next.js + ShadCN editor for generating App Store and Google Play screenshots. Scaffolded by the `app-store-screenshots` skill.

## Quick start

```bash
bun install   # or pnpm / yarn / npm
bun dev       # http://localhost:3000
```

To enable chat-based redesigns, copy the environment template and add an OpenAI API key:

```bash
cp .env.local.example .env.local
```

`OPENAI_API_KEY` is read only by the server-side `/api/design` route. Terra plans the editable design and GPT Image 2 generates explicitly requested visual backdrops. Override them with `OPENAI_DESIGN_MODEL` and `OPENAI_IMAGE_MODEL` when needed.

## What's inside

- **Connected canvas editor** (`src/components/editor/`) — every screen sits on one horizontal canvas, so phones, captions, and other elements can be dragged across screen boundaries and exported as split crops when Connected mode is enabled.
- **Chat-based redesign and creation** — describe a direction, attach visual references or a product screenshot for a new screen, compare Before/After on the live canvas, then apply or discard the editable proposal.
- **Editable AI decorations** — generated ellipses, rounded rectangles, lines, gradients, opacity, blur, position, rotation, and stacking remain normal canvas elements rather than flattened artwork.
- **GPT Image visual backdrops** — explicitly request generated artwork in chat and GPT Image 2 creates a cached, full-canvas backdrop behind the editable text, devices, and real product screenshots. Adjust its opacity or remove it from Screen settings.
- **Screen controls** — drag-to-reorder screens, click-to-edit text, screenshot drop targets, per-screen layout switcher, dark/light toggle.
- **Device frames** (`src/components/editor/device-frames.tsx`) — iPhone (PNG mockup), iPad, Android phone, Android tablet (portrait + landscape), feature graphic.
- **Auto-save (git-trackable)** — every change is persisted within ~600ms to **`app-store-screenshots.json`** at the project root (via `/api/project`) **and** mirrored to `localStorage` as an instant-paint cache. Commit `app-store-screenshots.json` and you can `git clone` to another machine and resume exactly where you left off.
- **Multi-device decks** — iOS and Android slide decks live side by side; switching the platform tab preserves both.
- **One-click export** — bulk PNG export at any required App Store / Play Store resolution using `html-to-image`; each PNG is rendered from the current connected or isolated deck mode.
- **Project migration** — older `app-store-screenshots.json` files are migrated on load. Existing per-slide transforms remain valid, and connected crops become available without rewriting the deck by hand.
- **Legacy-safe mode** — pre-v2 projects opened directly in the editor start in isolated-screen mode first, then can opt into connected crops with the toolbar's Connected/Isolated control. Skill-run in-place migrations keep legacy decks isolated unless the project had already explicitly opted into connected canvas.

## Designing with chat

1. Choose **Current screen**, **Selected screens**, or **Entire deck** in the chat composer.
2. For Selected screens, expand the screen strip and check the screens to include.
3. Describe the desired tone, hierarchy, palette, or copy. Attach up to three PNG, JPEG, or WebP images. To add a screen, say which attachment should become its primary screenshot; the editor creates the slide ID and stores the asset automatically. Ask for a “generated visual backdrop” when you want GPT Image artwork.
4. Wait for the proposal, then switch between **Before** and **After** on the canvas.
5. Click **Apply** to add the redesign as one undoable project change, or **Discard** to leave the project untouched.

The model receives the prompt, rendered previews of targeted screens, and optional attachments. Existing screenshot paths cannot be replaced by a redesign. When a new screen is requested, the model selects a supplied attachment ID and the editor generates the destination slide ID and screenshot path. Chat messages stay in browser storage and are not written to `app-store-screenshots.json`; the OpenAI Responses request is sent with storage disabled.

## Adding screenshots

Two ways:

1. **Drop a file in the inspector** — drag-and-drop or click Pick. The file is sent to `/api/upload`, hashed, and written to `public/screenshots/uploaded/<hash>.png`. The slide stores the resulting `/screenshots/uploaded/...` path, so commit those files alongside `app-store-screenshots.json` and the screenshots survive a `git clone`.
2. **Reference a static file** — put PNGs under `public/screenshots/{platform}/{device}/{locale}/` and reference them by path. Default sample slides expect:
   - `public/screenshots/apple/iphone/en/...`
   - `public/screenshots/android/phone/en/...`
   - `public/screenshots/apple/ipad/en/...`

Update the matching `screenshot` fields in `app-store-screenshots.json` to point at whatever filenames you choose.

## Exporting

The toolbar dropdown lists every Apple/Google-required size for the current device. Click **Export bundle** to download a zip. In Connected mode, each PNG is clipped from the connected canvas, so an element that straddles two screens appears split exactly where you placed it. In Isolated mode, each screen clips its own elements and legacy offscreen content cannot leak into neighboring exports.

## Customizing

| Where | What |
|-------|------|
| `src/lib/constants.ts` | Canvas dimensions, export sizes, frame ratios, themes, locales |
| `app-store-screenshots.json` | Canonical starter project: app name, current device, connected-canvas mode, slide copy, screenshots, and transforms |
| `src/lib/defaults.ts` | Fallback/reset state used when no project file or local cache exists |
| `src/components/editor/slide-canvas.tsx` | Add new layouts, decorations, and connected-canvas element rendering |
| `src/lib/design.ts` | AI proposal schema, validation, and safe proposal application |
| `src/app/api/design/route.ts` | Server-only OpenAI design request and structured response handling |
| `src/components/editor/device-frames.tsx` | Tweak device chrome (bezel radii, camera dots) |
| `src/app/layout.tsx` | Swap the font (`next/font/google`) |

## Notes

- `mockup.png` is the iPhone bezel overlay; replacing it requires re-measuring the `PHONE_SCREEN` constants.
- Image preloading converts every static path to a base64 data URI before exports run, and export retries paths that were previously missing — this prevents the html-to-image race where some slide screenshots come out black.
- Reset via the toolbar's circular arrow icon clears in-memory state and reloads the default screens. To wipe disk state too, delete `app-store-screenshots.json`.
- **Persistence model** — the canonical state lives in `app-store-screenshots.json` (git-tracked). On load, the editor reads localStorage first for instant paint, then overwrites with the file contents if present; if the file endpoint is unavailable, autosave is blocked so stale cache cannot overwrite disk. On save, both are written. If you ever see a conflict, the file always wins.
- **Migration model** — older projects do not need a manual conversion. On first load, the editor upgrades localized text, transform records, editable decorations, and per-device AI themes to schema v3 while preserving all existing screens. Legacy projects still keep `connectedCanvas: false` until explicitly enabled.
- **Custom themes** — if a project file references a theme id that is not present in `src/lib/constants.ts`, the editor falls back to `clean-light` and shows a warning. Merge custom `THEMES` entries during in-place upgrades.
