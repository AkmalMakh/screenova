# TODOS — Screenova

Deferred work with context. Added by gstack reviews; keep entries dated.

## 2026-10-17 — deferred from /design-review (landing, Studio, login)

Fixed on this branch: local-mode login styling (`cea9b79`), dead footer links (`46f3ef4`), single primary CTA in the hero fold (`7e3e1d9`), dark-mode pricing CTA (`3804ff9`). Full report with screenshots: `~/.gstack/projects/ParthJadhav-app-store-screenshots/designs/design-audit-20261017/`.

- **[medium, color+layout] Landing token unification.** Ten landing sections paste the same wrapper string (`border-black/[0.06] bg-[#F5F5F7] … dark:text-white`) instead of `bg-background text-foreground border-border`; accent inlined 14× as `text-[#006FE6] dark:text-[#409CFF]` where `text-primary` exists; `neutral-*` ×272 where `text-muted-foreground` exists; 22 distinct radii (cards at 14/18/20/24/28px; DESIGN.md says 12/18). Also drop `md`/`xl` radii from `tailwind.config.ts:64-71` and delete dead `studio-editor-modal.tsx`, `testimonials.tsx`. 11+ files: run as its own task (Codex candidate once `~/.codex/config.toml` uses a supported model).
- **[medium, typography] 9px labels and the type ramp.** `localization-section.tsx:72`, `experiment-section.tsx:112`, `templates-modal.tsx:65` use `text-[9px]` (floor is 12px). Eight h2s hand-roll `text-3xl sm:text-4xl`; extract a `SectionHeading`. `.font-serif-headline` (`globals.css:327`) references fonts that are never loaded.
- **[medium, content] One label for one destination.** "Transform my store page", "Open the editor", "Launch interactive studio" and "Open studio" all land on `/studio`. Keep "Design with AI" in the hero and "Open Studio" elsewhere.
- **[medium, slop] Stats row.** `social-proof.tsx` shows "Editable" and "Yours" as big-number stats. Four real numbers or one sentence.
- **[medium, interaction] Global 44px override.** `globals.css:328,355-357` and `min-h-11 min-w-11` in `ui/button.tsx:7` force every button to 44px, defeating `size="sm"/"icon"` on 57 call sites; the coarse-pointer hit-area rule at `globals.css:88-113` is the right mechanism. Needs editor toolbar QA after removal.
- **[medium, motion] Two easing systems.** `theme.ts:33-36` vs `--ease-out`; `faq.tsx:95` animates `height`; `localization-section.tsx:93` animates `filter`; decorative `whileHover` lift at `experiment-section.tsx:84`; `transition-all` in `ui/tabs.tsx:30`, `app-store-slide-card.tsx:32`.
- **[polish] Footer `h4` without an `h3`; closing banner repeats the hero's "deserves" line; `<img>` without `width`/`height` or `loading="lazy"`; decorative lucide icons without `aria-hidden`.
- **[flag] Hydration warning** on `<input id="hero-direction">` (`style={{}}`) appears in a headless run; the server HTML and `hero-section.tsx:22` carry no `style`. Verify in a clean browser profile before chasing. Tailwind warns that `ease-[var(--ease-out)]` is ambiguous.

## 2026-10-17 — deferred from /plan-ceo-review (public beta launch readiness)

- **Email/SMTP sign-in (DEPLOYMENT.md gate 2).** Deferred: launch is Google + GitHub only; `AUTH_EMAIL_ENABLED=false` and no enabled UI depends on SMTP. Pick up when a user asks for email login or when OAuth-only measurably blocks signups. Work: custom SMTP in Supabase, signup/magic-link/expired-link templates (SUPABASE-SETUP.md §3), enable the login-form email UI, hosted test of signup, confirmation, expired link. The `enroll_confirmed_user` trigger already enrolls confirmed email accounts, so no schema change is needed.
- **Orphan and staging asset cleanup (DEPLOYMENT.md:76).** Deferred: leak is bounded by per-user caps (100 uploads/day, 8 MiB each). Trigger: `project-assets` bucket above 500 MB or above 5,000 objects in the Supabase dashboard (check in RUNBOOK). Work: database-side sweep (pg_cron, security definer) that removes `<uid>/_uploads/*` older than 24 h and asset keys not referenced by any saved workspace bundle; SQL test in PGlite; alert on sweep failure. Never add a service-role key to the Vercel app for this.
