# Service verification — 2026-10-16

Status: local workspace regression-tested; both Screenova Supabase migrations applied, public signup enabled and configuration/anonymous-access checks passed. **Authenticated hosted-beta testing is still pending external email delivery.** See [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for the remaining release gate.

## Results

### Supabase verification — latest integration run

- Public-signup change: 24 cloud-focused tests pass, including six new email-flow/enrollment tests. The new SQL migration is tested in PGlite and applied to hosted Supabase. Public signup is enabled following explicit approval. Six hosted SQL checks pass for enrollment, function permissions, retained RLS/private storage and blocked anonymous/client privilege escalation. Email delivery and authenticated end-to-end signup remain unverified.

- 176 unit tests pass across 20 files on Node 22.23.2.
- Production build and TypeScript check pass.
- Studio and editor layouts explicitly force dynamic rendering. A production build made with local-mode settings was checked to ensure neither protected route appears in the static prerender manifest, preventing build-time account scope from being reused in cloud mode.
- Production Chromium regression: 45 pass, 2 optional live-provider tests skipped; this suite uses local mode, not live cloud accounts.
- 18 cloud-focused tests include real SQL policy execution plus mocked-service request and private-image route checks. Private uploads/downloads round-trip bytes and localized JPEG replacements become genuine PNGs while preserving untouched locales.
- A cloud-mode production server with missing credentials returned 503 for Studio/editor/project/image/upload APIs, 404 for an existing original local screenshot, and a usable configuration message on the login page. It did not fall back to local project data.
- Production dependency audit: zero reported vulnerabilities.
- Hosted project connected: all seven initial live SQL configuration checks passed, covering RLS, bucket privacy/size, ownership policies, RPC grants and protected membership/usage writes. After public-signup activation, the hosted Auth API reports `disable_signup: false`, `mailer_autoconfirm: false` and anonymous users disabled; direct anonymous project/membership reads and workspace RPC calls still return 401.
- The connected cloud dev server on port 3001 serves the configured login page, redirects unauthenticated Studio to login, denies project requests with 401, and blocks original screenshot URLs with 404. The original local workspace remains on port 3000.
- Hosted email delivery, real authenticated Supabase sessions/Storage transfers, cross-device saves and live two-account isolation remain unverified pending SMTP configuration.

### Earlier editor verification

- Supabase checks added: actual migration execution in PGlite/Postgres for project/file ownership, non-invited/anonymous access, transactional stale-save rejection and daily limits. Request tests cover account switching, origin checks, outages, membership and quota failures. This is not a substitute for hosted two-account testing.
- Latest test counts and final build status are recorded in the Supabase verification section below.
- Production build and TypeScript check pass on Node 22.23.2.
- After the final panel placement and mobile toolbar adjustments, all seven affected production browser checks passed again (appearance, landing handoff, editing/Undo, newline cleanup, upload/export, canvas pan/zoom, and mobile panel access).
- Earlier full production Chromium run: 26/26 pass, including both live-provider tests.
- Latest full production deterministic regression run: 45 pass, 2 live-provider tests intentionally skipped. Description-link attachment has eight parser unit tests and three browser tests. Escaped-newline cleanup has seven unit cases plus a browser regression covering saved text, edits, AI Apply, persistence and refresh. Live-provider calls were not repeated for these text/UI changes.
- `npm audit --omit=dev`: zero reported vulnerabilities. Full development-tool audit still reports 10 advisories (6 high, 4 moderate), concentrated in Tailwind's build-time dependency chain and browser-target tooling. This is not a complete security audit.
- Actual exported iPhone PNG inspected visually. ZIP files decoded with Sharp to verify dimensions, format, and that uploaded screenshot pixels appear in the exports.

## Browser coverage

- Editable award badge presets: original transparent SVG laurels/stars and localized caption/title. Four unit cases cover sanitization, schema acceptance, hydration, canvas sizing, and locale fallback. Five production browser tests cover Classic/White/Gold presets, copy-preserving restyling, editing, independent duplication, deletion/Undo, mobile controls, drag and proportional resize, English/German copy, refresh persistence, and Play Store feature-graphic availability. Exported ZIP PNGs are decoded to verify actual badge-color pixels; an exported PNG was also visually inspected. The headed-browser walkthrough used isolated project data on port 3201, not the user's saved projects. No image-generation API calls are needed for this component.

- Clicking or tapping a phone selects it and opens its image picker at the top of screen settings. Four production browser tests cover the real file chooser, persisted replacement after refresh, independent primary/secondary images, selecting another screen, keyboard Enter/Space, drag/resize, and a 390px touch viewport. Image controls wrap without horizontal overflow; the mobile AI launcher stays out of the settings heading. Desktop and mobile screenshots were visually inspected.

- Approved quiet-studio design applied to landing, Studio, and editor. Shared light-first appearance persists across all three routes; switching appearance leaves the artwork theme unchanged. Browser screenshots cover dark desktop and 390px light layouts. This is not a full accessibility certification.
- Recent project cards open actual saved projects; narrow screen cards keep AI selection, reorder, duplicate, and delete controls separate. Navigation and settings sit on opposite desktop edges while retaining the existing full-bleed canvas and pan coordinates.

- Landing prompt reaches the real Studio; editable Feature tour, Minimal three and Bold contrast presets.
- Description links auto-attach on paste or completed typing without altering the prompt. App Store previews finish before an immediate Send; multiple links, punctuation, duplicates, removal, the three-reference limit and the existing manual link input are covered.
- Literal escaped newline tokens in existing and incoming editor copy become spaces. Intentional Enter line breaks are preserved. See [debug report](../memory/2026-10-14-editor-escaped-newlines.md).
- Project creation, multilingual selection, navigation, immediate-refresh recovery, duplication, rename and delete.
- Headline editing, screen duplication/deletion/Undo, and independent iOS/Android decks.
- Production upload after server startup, refresh, and export with the uploaded image visible.
- AI preview/Apply/Discard/Undo; export is locked during generation and before a proposal is accepted.
- AI draft refinement retains uploaded screenshots rather than dropping them on the second prompt.
- Failed project hydration cannot overwrite disk; failed screenshot import retains its dialog, project name and selected files.
- App Store import retries failed analysis without switching or deleting the previous project.
- Malformed API payloads are rejected; JPEG uploaded to a localized PNG destination is genuinely encoded as PNG.
- Studio on a 390px-wide mobile viewport.
- iPhone's four sizes; iPad's two sizes; Android phone; both Android tablets in portrait and landscape; Play Store feature graphic. Non-iPhone variants export English and German folders with different rendered copy.

## Live checks

The opt-in run made actual server-side Apple and OpenAI requests using the configured environment. Apple listing lookup and screenshot downloads succeeded. OpenAI returned English/German screenshot analysis, a three-screen draft, an editor redesign and one generated JPEG backdrop. The backdrop was downloaded, decoded, applied, and observed in saved project state. Real provider responses vary, and future availability/rate limits are outside this app's control.

The normal suite mocks these providers for repeatability. Live tests cost provider credits:

```bash
npm run build
RUN_LIVE_SERVICE_TESTS=1 npm run test:e2e
```

## Safety and limits

Automated browser tests use a temporary project file on port 3100, not the user's existing JSON bundle. Existing user projects and unrelated changes were preserved. A separate QA project created during manual browser testing remains in the local workspace. Test image fixtures, imported Apple assets and generated backdrops remain under `public/screenshots/`; no user assets were deleted. Changes are uncommitted.

Local mode stores projects in a JSON file and assets on the local filesystem; keep it bound to localhost or behind trusted private access. Cloud mode adds verified email accounts, RLS-isolated project/image storage, daily API attempt limits and transactional revision checks. The hosted Supabase schema and public signup are now configured; external email delivery, public app deployment and a backup job are not. Do not publish this local workspace as an open internet service or include personal project files/assets in a deployment artifact.

Testing is Chromium on macOS, not a cross-browser Safari/Firefox audit. Drag/resize permutations, all seven content languages, long-running concurrency, generated-image export combinations, and App Store Connect/Play Console submission were not exhaustively tested. No direct store publishing is implemented. Build output retains a harmless Tailwind ambiguous-easing warning in existing shared UI classes.

Use npm's updated `package-lock.json`; the original Bun lock has not been regenerated. See [README.md](README.md) for setup, persistence and repeatable test commands.

## Reusable implementation notes

- Test runtime image uploads against `next start`: production's public-file index can miss files created after startup. The validated dynamic screenshot route addresses this; mutable localized/App Store assets must not use immutable caching.
- A screenshot destination's extension and actual encoded bytes must agree. Localized replacements and seeded locale files are re-encoded to the destination format.
- Cache edits immediately before a debounce, flush pending file saves before hydration, and recover strictly newer browser edits. Do not let a failed or semantically invalid file read become an empty workspace that overwrites saved data.
- Keep discrete history operations separate from typing coalescence: duplicate, delete, device changes and AI Apply need independent Undo steps.
- npm 10 retained a stale nested PostCSS entry after adding an override. Removing that obsolete lock entry and reinstalling resolved the patched dependency; `npm ls postcss` and the runtime audit confirmed it.

The Browse skill's learning-log helper was attempted but could not load its `lib/jsonl-store.ts` module. These findings are recorded here instead; its session-end record succeeded.
