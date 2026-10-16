# App Store Screenshots — Editor Template

A pre-built Next.js + ShadCN editor for generating App Store and Google Play screenshots. Scaffolded by the `app-store-screenshots` skill.

## Quick start

```bash
nvm use       # Node 22; use the version in .nvmrc if you do not use nvm
npm ci        # package-lock.json is the verified dependency lock
APP_STORAGE_MODE=local NEXT_BUILD_DIR=.next-dev npm run dev -- --hostname 127.0.0.1
# Open http://localhost:3000/studio
```

Local mode needs no signup, email delivery or Supabase session. Your current local projects remain on this computer. See [LOCAL-QA.md](LOCAL-QA.md) for the latest local verification.

To enable chat-based redesigns, copy the environment template and add an OpenAI API key:

```bash
cp .env.example .env.local  # only if .env.local does not already exist
```

`OPENAI_API_KEY` is read only by server-side AI routes. The design model plans editable layouts and the image model generates explicitly requested raster backdrops. Override them with `OPENAI_DESIGN_MODEL` and `OPENAI_IMAGE_MODEL` when needed. Manual editing and PNG export work without an API key.

There are two storage modes: **local** preserves the original single-user JSON workspace; **supabase** adds accounts, account-owned projects and private image storage. Google and GitHub sign-in are enabled; email UI stays off until SMTP is configured and tested. Public signup grants workspace access to confirmed, non-anonymous accounts. The production origin is `https://screenova-sigma.vercel.app`; its exact callback is configured in Supabase. Local sign-in and second-account separation were user-verified; the hosted authenticated upload/export and two-account checks must be verified separately. See [SUPABASE-SETUP.md](SUPABASE-SETUP.md) and the current status in [DEPLOYMENT.md](DEPLOYMENT.md). No billing or shared-team collaboration is implemented.

For Vercel, see [DEPLOYMENT.md](DEPLOYMENT.md). Cloud uploads go directly to private Supabase Storage, preserving the 8 MiB image limit without putting base64 images through Vercel's request body limit. AI redesigns send private asset paths; private image responses are streamed. Cloud workspace metadata is limited to 4 MB UTF-8, checked before sending and again before saving. Local mode is unchanged. Vercel always forces cloud mode even if a local-mode environment value is accidentally copied.

For production on a persistent local machine:

```bash
APP_STORAGE_MODE=local npm run build
APP_STORAGE_MODE=local npm run start -- --hostname 127.0.0.1
```

In local mode, project data defaults to `app-store-screenshots.json`; set `APP_STORE_PROJECT_FILE` to an absolute persistent path to relocate it. Uploaded/imported/generated assets live under `public/screenshots/`, so back up that directory with the JSON file. Local mode requires a persistent writable filesystem and must remain private. Cloud mode uses Supabase instead and never automatically imports these personal files.

To run dev and production builds concurrently, use `NEXT_BUILD_DIR=.next-dev npm run dev` so their build outputs do not overwrite one another.

## Verification

### Editable award badges

In the editor, open **Screen settings → Elements → Add award badge**. The preset
is original vector artwork with a transparent background, not a flattened image.
Edit the year/caption and title in each content language, choose 0–5 stars, toggle
laurels, and change artwork/text colors. Drag or resize on the canvas, or set the
width numerically; proportions stay locked. Rotation, layering, duplication,
deletion, Undo, saving, and PNG export use the existing editor workflow.

The preset is decorative, not a verified award or official Apple asset. Replace
the placeholder with recognition your app has actually received. No AI call or
image-generation credits are required.

### Test commands

```bash
npm test
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
# Optional: live Apple/OpenAI calls, including one image generation; incurs provider charges.
RUN_LIVE_SERVICE_TESTS=1 npm run test:e2e
npm audit --omit=dev
```

Browser tests start a production server on port 3100 and use an isolated temporary project file. They never overwrite your project bundle. Image fixtures and live-provider imports are written under `public/screenshots/`; browser artifacts go to ignored `test-results/` and `playwright-report/`. The normal suite mocks AI and Apple responses for repeatability; the opt-in tests verify actual providers. See [TESTING.md](TESTING.md) for the latest coverage and limitations.

## What's inside

- **Connected canvas editor** (`src/components/editor/`) — every screen sits on one horizontal canvas, so phones, captions, and other elements can be dragged across screen boundaries and exported as split crops when Connected mode is enabled.
- **Chat-based redesign and creation** — describe a direction, attach visual references or a product screenshot for a new screen, compare Before/After on the live canvas, then apply or discard the editable proposal.
- **Editable AI decorations** — generated ellipses, rounded rectangles, lines, gradients, opacity, blur, position, rotation, and stacking remain normal canvas elements rather than flattened artwork.
- **GPT Image visual backdrops** — explicitly request generated artwork in chat and GPT Image 2 creates a cached, full-canvas backdrop behind the editable text, devices, and real product screenshots. Adjust its opacity or remove it from Screen settings.
- **Screen controls** — drag-to-reorder screens, click-to-edit text, screenshot drop targets, per-screen layout switcher, dark/light toggle.
- **Device frames** (`src/components/editor/device-frames.tsx`) — iPhone (PNG mockup), iPad, Android phone, Android tablet (portrait + landscape), feature graphic.
- **Auto-save** — edits are cached immediately in the browser and saved after a ~600ms debounce. Local mode writes `app-store-screenshots.json`; cloud mode writes account-owned Postgres rows with transactional revision checks. Errors stay visible rather than claiming the cloud save succeeded.
- **Multiple projects** — the toolbar's project switcher creates, switches, renames, duplicates, and deletes projects (see Manage projects…). Decks and screens use the selected storage backend; design chat remains per-project, account-scoped browser data and does not sync to the cloud.
- **New project from screenshots** — click “New project”, pick the project's languages (en/de/es/fr/zh/ja/ko), optionally name it and drop in up to 10 PNG/JPEG/WebP screenshots; a vision model drafts one screen per screenshot (label, headline, layout) in every chosen language and each becomes an editable slide with the screenshot attached. No screenshots? You still get a plain starter deck, with its placeholder copy translated into the chosen languages too. Switch content languages later in the toolbar and edit each locale separately.
- **Multi-device decks** — iOS and Android slide decks live side by side; switching the platform tab preserves both.
- **One-click export** — bulk PNG export at any required App Store / Play Store resolution using `html-to-image`; each PNG is rendered from the current connected or isolated deck mode.
- **Project migration** — older `app-store-screenshots.json` files are migrated on load. Existing per-slide transforms remain valid, and connected crops become available without rewriting the deck by hand.
- **Legacy-safe mode** — pre-v2 projects opened directly in the editor start in isolated-screen mode first, then can opt into connected crops with the toolbar's Connected/Isolated control. Skill-run in-place migrations keep legacy decks isolated unless the project had already explicitly opted into connected canvas.

## Designing with chat

In Studio's description box, paste an HTTPS/HTTP, `www.` or App Store link anywhere in your text. It automatically becomes a reference chip without opening the separate link input or pressing Add. Your description remains unchanged. Typed links are detected when you finish the URL with a space, leave the box, or send. Duplicates are ignored, up to three references are allowed, and App Store metadata/screenshots finish loading before the draft request is sent. Removing a chip keeps it excluded until you remove/reinsert its URL or explicitly add it again. The separate link input remains available as an optional fallback.

1. Choose **Current screen**, **Selected screens**, or **Entire deck** in the chat composer.
2. For Selected screens, expand the screen strip and check the screens to include.
3. Describe the desired tone, hierarchy, palette, or copy. Attach up to three PNG, JPEG, or WebP images. To add a screen, say which attachment should become its primary screenshot; the editor creates the slide ID and stores the asset automatically. Ask for a “generated visual backdrop” when you want GPT Image artwork.
4. Wait for the proposal, then switch between **Before** and **After** on the canvas.
5. Click **Apply** to add the redesign as one undoable project change, or **Discard** to leave the project untouched.

The model receives the prompt, rendered previews of targeted screens, and optional attachments. Existing screenshot paths cannot be replaced by a redesign. When a new screen is requested, the model selects a supplied attachment ID and the editor generates the destination slide ID and screenshot path. Chat messages stay in per-project browser storage and are not written to `app-store-screenshots.json`; the OpenAI Responses request is sent with storage disabled.

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
| `src/lib/ui-translations/` | UI language strings (en source of truth, de/es/fr). Add a language: add a file + one entry in `UI_LANGUAGES` in `src/lib/ui-i18n.tsx` |
| `app-store-screenshots.json` | Canonical starter bundle: every project (ids, names, order, activeId), each with app name, current device, connected-canvas mode, slide copy, screenshots, and transforms |
| `src/lib/defaults.ts` | Fallback/reset state used when no project file or local cache exists |
| `src/components/editor/slide-canvas.tsx` | Add new layouts, decorations, and connected-canvas element rendering |
| `src/lib/design.ts` | AI proposal schema, validation, and safe proposal application |
| `src/app/api/design/route.ts` | Server-only OpenAI design request and structured response handling |
| `src/components/editor/device-frames.tsx` | Tweak device chrome (bezel radii, camera dots) |
| `src/app/layout.tsx` | Swap the font (`next/font/google`) |

## Notes

- `mockup.png` is the iPhone bezel overlay; replacing it requires re-measuring the `PHONE_SCREEN` constants.
- Image preloading converts every static path to a base64 data URI before exports run, and export retries paths that were previously missing — this prevents the html-to-image race where some slide screenshots come out black.
- Reset via the toolbar's circular arrow icon reloads the default screens of the active project. To wipe disk state too, delete `app-store-screenshots.json`.
- **Persistence model** — local mode uses a validated, atomically replaced JSON bundle and browser cache, with single-process write serialization. Cloud mode uses account-owned project rows, an atomic workspace snapshot, per-account transaction locks and revision comparisons. In either mode, hydration failure blocks backend writes and browser edits remain cached. See the cloud setup guide for conflict recovery and backup limitations.
- **Interface language** — the toolbar's language selector switches the editor chrome (buttons, dialogs, toasts) between English, Deutsch, Español, and Français. The choice is per-browser (`localStorage` `app-store-screenshots:ui-lang:v1`, falling back to the browser language, then English) and is independent of the per-project content locale — slide copy always renders in the project's locale.
- **Migration model** — older projects do not need a manual conversion. On first load, the editor upgrades localized text, transform records, editable decorations, and per-device AI themes to schema v3 while preserving all existing screens. Legacy projects still keep `connectedCanvas: false` until explicitly enabled.
- **Custom themes** — if a project file references a theme id that is not present in `src/lib/constants.ts`, the editor falls back to `clean-light` and shows a warning. Merge custom `THEMES` entries during in-place upgrades.
