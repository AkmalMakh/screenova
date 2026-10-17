# TODOS — Screenova

Deferred work with context. Added by gstack reviews; keep entries dated.

## 2026-10-17 — deferred from /design-review (landing, Studio, login)

All fifteen design findings are fixed on `feat/reference-layout-cloning` (Fixed by /design-review follow-up, 2026-10-17): login styling `cea9b79`, dead footer links `46f3ef4`, single hero CTA `7e3e1d9`, dark pricing CTA `3804ff9`, landing color tokens `007d3b8`, radius scale `47664de`, dead files `d88c2cd`, type ramp `62e9455`, CTA labels `c8a54ac`, stats row `52b21ae`, touch targets `564463d`, motion `4a2352b`, outline/copy/images/icons `ac993f4`. Report: `~/.gstack/projects/ParthJadhav-app-store-screenshots/designs/design-audit-20261017/`.

- **[flag] Hydration warning** on `<input id="hero-direction">` (`style={{}}`) seen in a headless run. The server HTML and `hero-section.tsx` carry no `style`, so a browser extension or instrumentation is the likely source. Verify in a clean browser profile before changing code.
- **[polish] Bare `rounded` (4px).** About 40 call sites use Tailwind's default 4px radius, which is not on the DESIGN.md scale (6/8/12/18). Low visual impact; migrate when touching those files.

## 2026-10-17 — deferred from /plan-ceo-review (public beta launch readiness)

- **Email/SMTP sign-in (DEPLOYMENT.md gate 2).** Deferred: launch is Google + GitHub only; `AUTH_EMAIL_ENABLED=false` and no enabled UI depends on SMTP. Pick up when a user asks for email login or when OAuth-only measurably blocks signups. Work: custom SMTP in Supabase, signup/magic-link/expired-link templates (SUPABASE-SETUP.md §3), enable the login-form email UI, hosted test of signup, confirmation, expired link. The `enroll_confirmed_user` trigger already enrolls confirmed email accounts, so no schema change is needed.
- **Orphan and staging asset cleanup (DEPLOYMENT.md:76).** Deferred: leak is bounded by per-user caps (100 uploads/day, 8 MiB each). Trigger: `project-assets` bucket above 500 MB or above 5,000 objects in the Supabase dashboard (check in RUNBOOK). Work: database-side sweep (pg_cron, security definer) that removes `<uid>/_uploads/*` older than 24 h and asset keys not referenced by any saved workspace bundle; SQL test in PGlite; alert on sweep failure. Never add a service-role key to the Vercel app for this.
- **Storage image mirror for backups.** Deferred: the Supabase tier backup (D6) covers the database only. When the D5 cleanup trigger fires or before any paid tier is offered, add an operator-side mirror of the `project-assets` bucket and include it in the restore drill.
