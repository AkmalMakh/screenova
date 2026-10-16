# Badge rendering and preset verification — 2026-10-16

## Debug report

- **Symptom:** The user's screenshot showed a solid rectangle in place of the badge and untranslated `badge.*` labels, while the inspector preview rendered correctly.
- **Root cause assessment:** Stale or mixed client modules are strongly indicated. The saved element had `kind: award-badge` and valid copy. Both fresh production and development browser contexts rendered that exact saved badge as transparent SVG with resolved labels. The original stale browser session was not inspected directly, so its cache mechanism is not proven. The saved near-black text also had poor contrast against the purple artwork.
- **Resolution:** Restarted the existing local development server without deleting its cache or project data. The existing browser tab needs a full refresh. Added complete Classic, White and Gold presets with visual previews and App Store/current-year/five-star copy. Existing badges can be restyled without changing copy, position, size, or rotation. The preview cards have vertically stacked names so they fit narrow inspectors.
- **Files:** `src/lib/award-badge.ts`, `src/components/editor/inspector.tsx`, `src/components/editor/award-badge-panel.tsx`.
- **Regression:** `e2e/award-badge.spec.ts`, test “prebuilt badge styles insert finished artwork and preserve edited copy when restyled.” It failed against the previous production build because the White preset was absent, then passed against the new build. It checks transparent SVG, finished default copy, copy-preserving restyling, reload persistence, and absence of raw badge translation keys.
- **Evidence:** 152 unit tests in 15 files passed. Full production browser run: 41 passed, 2 live-provider tests skipped. Production build and type checking passed. After the final card-layout change, fresh development-browser screenshots at desktop and 390px confirm labels and previews; no mobile page overflow. The badge suite was rerun against the final build.
- **Safety:** All writes in browser verification went to a temporary project file or mocked endpoint. The user's project file SHA-256 stayed `5292dbb86d507bb17d55d0bc3783a7b6c7cc892b4d62631253b1120be3f609ef`. No project data was modified, no assets deleted, and no provider credits used. Existing mixed worktree changes remain uncommitted.
- **Status:** DONE_WITH_CONCERNS: ready-made presets and fresh-load rendering verified; the original user tab still requires a refresh.

## Durable learning

A production-only regression run is not sufficient evidence that an already-open development tab received every hot-updated module. When a new inspector works but a shared renderer or dictionary looks old, compare the same saved data in fresh development and production browser contexts before changing valid data or adding renderer workarounds. The gstack learning logger was attempted but failed because its installed `lib/jsonl-store.ts` module is missing; this report preserves the finding.
