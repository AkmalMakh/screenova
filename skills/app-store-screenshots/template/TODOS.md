# TODOS — Screenova

Deferred work with context. Added by gstack reviews; keep entries dated.

## 2026-10-17 — deferred from /design-review (landing, Studio, login)

All fifteen design findings are fixed on `feat/reference-layout-cloning` (Fixed by /design-review follow-up, 2026-10-17): login styling `cea9b79`, dead footer links `46f3ef4`, single hero CTA `7e3e1d9`, dark pricing CTA `3804ff9`, landing color tokens `007d3b8`, radius scale `47664de`, dead files `d88c2cd`, type ramp `62e9455`, CTA labels `c8a54ac`, stats row `52b21ae`, touch targets `564463d`, motion `4a2352b`, outline/copy/images/icons `ac993f4`. Report: `~/.gstack/projects/ParthJadhav-app-store-screenshots/designs/design-audit-20261017/`.

- **[flag] Hydration warning** on `<input id="hero-direction">` (`style={{}}`) seen in a headless run. The server HTML and `hero-section.tsx` carry no `style`, so a browser extension or instrumentation is the likely source. Verify in a clean browser profile before changing code.
- **[polish] Bare `rounded` (4px).** About 40 call sites use Tailwind's default 4px radius, which is not on the DESIGN.md scale (6/8/12/18). Low visual impact; migrate when touching those files.

## 2026-10-17 — deferred from /plan-ceo-review (public beta launch readiness)

- **Email/SMTP sign-in (DEPLOYMENT.md gate 2).** Deferred: launch is Google + GitHub only; `AUTH_EMAIL_ENABLED=false` and no enabled UI depends on SMTP. Pick up when a user asks for email login or when OAuth-only measurably blocks signups. Work: custom SMTP in Supabase, signup/magic-link/expired-link templates (SUPABASE-SETUP.md §3), enable the login-form email UI, hosted test of signup, confirmation, expired link. The `enroll_confirmed_user` trigger already enrolls confirmed email accounts, so no schema change is needed.
- **Orphan and staging asset cleanup (DEPLOYMENT.md:76).** Deferred: leak is bounded by per-user caps (100 uploads/day, 8 MiB each). Trigger: `project-assets` bucket above 500 MB or above 5,000 objects in the Supabase dashboard (check in RUNBOOK). Work: database-side sweep (pg_cron, security definer) that removes `<uid>/_uploads/*` older than 24 h and asset keys not referenced by any saved workspace bundle; SQL test in PGlite; alert on sweep failure. Never add a service-role key to the Vercel app for this.
- **Database backups (Supabase paid tier) and restore drill.** Deferred by the owner on 2026-10-18; supersedes the CEO-review approval. Pick up before inviting users beyond the two test accounts. Work: enable the paid tier, confirm daily backups, run the drill in RUNBOOK.md "Backups and restore", record it. Until then, take a manual `pg_dump` before risky migrations (RUNBOOK.md).
- **Storage image mirror for backups.** Deferred until database backups exist (entry above): a Supabase tier backup would cover the database only. Once that is enabled, or when the cleanup trigger fires, add an operator-side mirror of the `project-assets` bucket and include it in the restore drill.

## 2026-10-18 — open items from /ship (launch-readiness PR, review not converged)

The pre-landing review hit its three-cycle cap. Unless marked fixed, items below were found after the last fix cycle and were not changed in that PR.

**Fixed in the same PR after review (adversarial review, medium):** outage responses now keep cookies rotated by `getUser()`, and database-refused saves (22xxx, 23xxx, P0001) return 400 without paging.

**Silent-failure gaps (review pass 3, deferred):**

- Supabase Storage failures (uploads, images) are never reported.
- Route errors outside `report()` are never sent to Sentry. Add `onRequestError` in `src/instrumentation.ts`, with the same scrubbing.
- An OpenAI call can outlive the function's `maxDuration` and end with no report. Give the SDK a timeout below the route limit.
- Model refusals caused by the user's own content page as app bugs.
- Unknown OpenAI 4xx codes (schema or parameter errors after a deploy) only log. Report codes outside the known user-caused list as a warning.
- The `denied` budget verdict only logs. It almost always means contract drift, so report it as a warning.

**Hardening (adversarial review, low):**

- `scrubEvent` keeps `event.extra` and `event.contexts`. SDK-captured non-Error throwables can carry serialized content there.
- `redactedError` keeps message lines that begin with whitespace and "at " as fake stack frames.
- Hosted Playwright traces on failure may contain the preview bypass header and test-account cookies. Turn tracing off for the hosted suite or confirm it is not captured.
- In local mode, the upload route's raw `fs` error text, which includes absolute paths, now reaches the toast.
- OpenAI 4xx vendor messages are written to Vercel logs and can echo user content. Log the code only.
- RUNBOOK's Sentry test one-liner ends with `exit` and leaves `.env.ops` behind on Ctrl-C. Wrap it in a subshell with an EXIT trap.
- Any authenticated account can call the budget functions directly. About fifty accounts can drain the shared AI pool for a day. Revisit before opening signups wider.
