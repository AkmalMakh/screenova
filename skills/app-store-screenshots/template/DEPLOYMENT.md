# Screenova Vercel deployment preparation

## Launch-readiness code — 2026-10-18 (not yet deployed)

Implements the reviewed public-beta plan (`.gstack/plans/2026-10-17-public-beta-launch-readiness.md`). Status: local verification only; nothing below is deployed or hosted-verified yet.

- Operator alerting: server-only Sentry (`src/instrumentation.ts`, `src/lib/ops.ts`) reports auth/membership/quota-service outages, middleware config failures, workspace read/save failures and AI provider failures. Automatic data collection is off; events carry only stage, kind, code, request id and (workspace read/save only) user id. A post-response flush covers early-return error paths.
- Budget verdicts: `202610170003_budget_verdict.sql` adds `consume_beta_budget_v2` returning `ok`/`user`/`global`/`denied` (global checked first). `202610170004_budget_v1_wrapper.sql` turns v1 into a boolean wrapper, kept permanently for rollback. The global-pool alert fires once per kind per UTC day per instance.
- OpenAI monthly-limit exhaustion now shows "AI features are paused for now; manual editing and export still work." (503) on all three AI routes; existing 401/429/5xx copy is unchanged and now pinned by tests.
- Hosted smoke (`npm run test:hosted`) and `RUNBOOK.md` (alerts, caps, deploy order, restore drill, weekly checks).
- Local verification: unit and SQL tests and TypeScript pass; production build passes; middleware bundle 186 kB. Local browser suite result is recorded in the release notes for this change.

Still required before calling the beta launched, in order: vendor settings (OpenAI hard limit and 80% email, Sentry project, alert rule and `SENTRY_DSN`), apply migrations 0003 and 0004, preview deploy with hosted smoke and a forced error-path Sentry event, production deploy with hosted smoke. Scheduled backups are a separate owner-tracked item (TODOS.md).

## Current release status — 2026-10-17

Production is deployed at **https://screenova-sigma.vercel.app**. The authenticated workspace outage is fixed: a fresh Google login, Studio access, and a new deck save/reload passed on 2026-10-17. This is focused recovery verification, not a fresh complete public-launch certification. No custom domain is configured. This section supersedes the historical deployment diary below.

### Workspace outage recovery — 2026-10-17

- Ready deployment `dpl_5qjGXwP9vQKdFi1X7PWhWnqiyNyj`, source `117301a`, is assigned to the stable production URL.
- Production diagnostics showed membership lookup failures with `PGRST003`. Supabase showed 97% CPU and roughly 359,000 repeated `40001` workspace-conflict errors in one hour despite very little API traffic. `pg_stat_activity` confirmed PostgREST 14.18 workers repeatedly executing `save_workspace`.
- Root cause: the application used PostgreSQL serialization error `40001` for a permanent stale-revision conflict. PostgREST 14 retries that error internally. See [Supabase's incident guidance](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
- Applied `202610170001_nonretrying_workspace_conflicts.sql` to hosted Supabase through SQL Editor. It changes only the exception to `PT409`; the existing function body, ownership, invoker security, grants and RLS remain intact. Hosted verification confirmed the new code and unchanged permissions. The old looping workers subsequently disappeared; no manual backend termination, project restart, data deletion or paid upgrade was performed.
- The matching API response now treats `PT409` as HTTP 409 without retrying or overwriting newer data. Two targeted regression assertions failed before the fix; afterward all 243 tests in 34 files, TypeScript, local production build and Vercel production build passed. Actual SQL tests cover stale-write rollback, migration idempotence and preserved tenant permissions. Secret scanning of the release diff passed; unrelated personal project JSON was not committed or uploaded.
- Browser verification: existing session recovered; a fresh Google account-selection flow returned to `/studio`; a new blank test deck with app name `Release verification` saved and survived a reload. This test deck is intentionally retained; existing projects were not edited. Project GET/POST requests returned 200 in production logs. Public pages returned 200; unsigned Studio/editor requests still redirected to login and unsigned project API requests returned 401/private-no-store.
- Not reverified in this focused fix: authenticated uploads/export, GitHub login, hosted two-account isolation, or a deliberate stale-write HTTP probe against production. Local SQL/API regression tests cover the conflict behavior; do not describe those as a hosted concurrency test. The full build-tool dependency audit still reports the previously documented 10 advisories.

### Earlier deployment verification (historical)

- Current Ready deployment: `dpl_4KGuagbNi6EHNWM3LoA4Yovb1M4z`, source commit `23fa147`; previous release `dpl_BQe2QApQumLfVCRLMMf2Z3Vn6VXy`, source commit `57e194e`. Both completed remote production builds and received the stable alias.
- Public `/` and `/login` returned 200, with Google/GitHub buttons visible. Unsigned `/studio` and `/editor` redirected to login. Project, upload, AI and private-image APIs returned 401 with private/no-store; original screenshot paths returned 404. Cancellation redirected to the recoverable login message. Preview still returns the Vercel login barrier.
- Live Google flow reached account selection with the correct production return URL, but subsequently showed `reason=session`; authenticated `/api/project` reported workspace unavailable. Do not claim successful hosted login or blame the provider without diagnosis. Added credential-free identity/membership failure diagnostics; targeted access tests and TypeScript passed. This diagnostic release is deployed.
- Chrome then reported `ERR_NETWORK_IO_SUSPENDED` / computer went to sleep, and reload/navigation commands timed out. The diagnostic replay and authenticated save/upload/export/two-account checks remain blocked on restoring the browser session. No private data was exposed and no auth/RLS protection was relaxed.

- Google and GitHub sign-in enabled; local login and second-account separation user-verified. Email UI remains disabled; no SMTP dependency or email sending for this release.
- Supabase Site URL and exact production `/auth/callback` saved; localhost callback retained.
- All five existing Vercel application variables now target Preview and Production. The OpenAI key remains sensitive and server-only.
- Production domain is public; Preview and unique deployment URLs remain Vercel-protected (`prod_deployment_urls_and_all_previews`). Application auth, RLS and private Storage are unchanged.
- Fresh checks: 242 unit tests, TypeScript, zero production dependency advisories; previous unchanged production build and browser suite: 47 passed, two opt-in provider tests skipped. Focused auth/storage source review found no additional blocking defect. Secret scan found no credential blockers; non-credential advisories were reviewed, including excluded personal-workspace data.
- Dry upload: 166 entries / 2,090,624 bytes before documentation updates, with no local secrets, personal project JSON or screenshots. Cloud runtime files included.
- User explicitly replaced the failing gstack orchestration with standard release checks. Incomplete gstack review/evidence steps are not certified as complete.
- Still requires hosted authenticated verification: OAuth return, private upload/save/reload/export and two-account isolation. Provider spend budgets, backups and orphan-asset cleanup are operational follow-ups, not claimed complete.

## Historical protected-preview deployment

Preview: https://screenova-304b16uzw-stylerxs-projects.vercel.app

Dashboard: https://vercel.com/stylerxs-projects/screenova/H3c1PiRZm45tp1UQiN162r3ps2kY

Deployment ID: `dpl_H3c1PiRZm45tp1UQiN162r3ps2kY`; Vercel reports **Preview / Ready**. Opening it requires Vercel access. Application email authentication is a separate layer and is not yet release-verified.

## Approved target

- Vercel team: **StylerX's projects** (`stylerxs-projects`).
- Created project: **screenova** (`prj_0aIlKTkm58K1Omz6bkQFkEZkNByb`). Other projects were untouched.
- Application root: this `template/` directory; Node `22.x`; Next.js; `npm ci` and `npm run build`. Package and project runtime settings are pinned to Node 22.
- Manual CLI deployment; no Git integration, commit, push, merge or successful production promotion.
- Repeatable settings and commands are recorded in `CLAUDE.md` under Deploy Configuration.

## Verified on the hosted preview

- Remote dependency installation, Next.js compilation, type checking and function deployment succeeded.
- `/` and `/login`: HTTP 200 through authenticated Vercel CLI access; login includes the email form without a missing-configuration warning.
- Without a Supabase app session, `/studio` and `/editor`: HTTP 307 to this preview's `/login`.
- Anonymous `/api/project`, POST `/api/upload`, POST `/api/design`, and `/api/assets/<owner>/private.png`: HTTP 401. The project endpoint returns `{ "ok": false, "error": "Please sign in." }`.
- Original local `/screenshots/shared/phone.png`: HTTP 404.
- A plain unauthenticated request to the preview returns HTTP 302 to `https://vercel.com/sso-api`. Vercel deployment protection remains enabled (`all_except_custom_domains`). Vercel CLI generated a project-scoped automation bypass token for the health checks; this does not bypass application authentication and its value was not printed or committed.
- Dry-run checked 152 source files (~2 MB): no local project JSON, personal screenshot files, `.env.local`, build output, OpenAI secret or local Vercel OIDC token included. Corrected `/supabase/` to a root-anchored ignore rule so runtime `src/lib/supabase/*` is included. The older Bun lock is excluded; npm's lock is used.
- Latest production-only dependency audit: zero reported vulnerabilities. The full build-tool audit still reports the previously recorded 10 advisories; no forced dependency rewrite was performed.

### First-deployment behavior

Despite `--target preview`, Vercel assigned the first attempt (`dpl_ECSHX51pErWn1PgtxaSHvPi1eZr8`) to Production. It was canceled while building; the API confirms **CANCELED**, `aliasAssigned: false`, and no assigned aliases. No application became live from that attempt. The next explicit-preview attempt succeeded as Preview. Vercel documents this first-deploy behavior in [its CLI change](https://github.com/vercel/vercel/pull/17206). Retain the canceled record unless intentionally reconfiguring the project; deleting all deployment history can reintroduce the first-deploy behavior.

## Environment and privacy

- Preview environment: `APP_STORAGE_MODE=supabase` (Vercel also forces cloud mode defensively).
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: existing Screenova public configuration.
- `OPENAI_API_KEY`: configured as a server-only sensitive Preview variable. Existing `OPENAI_DESIGN_MODEL` is configured for Preview. Production environment values are not configured.
- Do not upload `.env.local`, the local project bundle or `public/screenshots/`. `.vercelignore` exclusions were verified using `vercel deploy --dry --json`; repeat this check before future deployments. Do not copy a service-role key into the app.
- No local projects are automatically migrated to cloud accounts.

## Payload handling

[Vercel function limits](https://vercel.com/docs/functions/limitations) require small request bodies. Cloud image bytes now upload directly to private Supabase Storage with the user's session; finalization carries only an owner-scoped path. Actual image validation, locale replacement and API quota checks remain on the server. Image reads use streamed responses. AI redesign reference/preview images use private paths instead of inline base64. Each uploaded image consumes one upload attempt at finalization.

Cloud project metadata is capped at 4,000,000 UTF-8 bytes on client and server, with a visible save error rather than a generic hosting rejection. Legacy larger workspace reads are streamed so users can recover/reduce them. Images retain their 8 MiB limit. No scheduled orphan/staging asset cleanup exists yet.

## Before public access

1. Completed: confirm/link the target project, verify excluded files, configure Preview environment values, deploy and inspect the preview. Keep protection enabled until the remaining launch gates pass.
2. Configure an email provider/custom SMTP and the signup/magic-link templates described in [SUPABASE-SETUP.md](SUPABASE-SETUP.md). A `vercel.app` application address does not itself supply an email sender.
3. Set Supabase Site URL and exact callback allowlist to the chosen HTTPS application origin. Do not use arbitrary deployment wildcard redirects for production.
4. Verify signup, confirmation, returning sign-in, sign-out, expired links and two-account isolation on the actual host.
5. On Vercel, upload an image above 4.5 MB, replace a localized screenshot, refresh, export it, and run a redesign using several references/previews. Confirm the Storage transfer and streamed private response both succeed.
6. Confirm anonymous project/image/AI access is denied, local screenshot paths are blocked, and user-specific responses are not publicly cached.
7. Recheck cloud-facing landing copy, abuse protection, provider budgets, backup/restore and a user-support contact before calling it a public launch.

Local tests and hosted anonymous-boundary checks pass. SMTP, hosted authenticated two-account QA (including real Storage uploads/exports), production environment configuration and public production release remain pending. Supabase Site URL/redirect settings still point to localhost; they were not changed as part of this protected preview deployment. No emails were sent.

## Launch follow-up (2026-10-16)

Public launch is **BLOCKED on authentication-provider setup**, not complete.
The live Supabase settings endpoint confirms signup is enabled, email
confirmation is required, and email is the only enabled provider. Anonymous
REST reads of projects and membership still return 401. Public email delivery
needs custom SMTP; alternatively, an approved OAuth provider needs its app
credentials configured in Supabase. No provider choice or credentials were
assumed, and no confirmation/security requirement was disabled.

Local fixes awaiting the next deployment:

- Server-selected landing mode now describes private account storage in cloud
  installations. Workspace entry goes directly through the existing auth gate.
- Local installations retain the account-free Studio explanation.
- Removed Git-owned/local-storage claims and the local-only comparison table
  from the hosted landing page; replaced an unverified timing statistic.
- Clarified that raster backdrops are replaceable, not object-editable.
- Updated root design guidance to distinguish cloud and local service modes
  without changing the approved visual system.

Verification: 196 unit tests across 24 files, TypeScript, production build,
and 46 local production Chromium scenarios passed (2 optional live-provider
tests skipped). Four new rendered-copy regression tests cover storage modes.
Manual cloud-mode browser checks at localhost:3001 verified private-storage
copy, workspace navigation to login, and recoverable invalid-callback feedback;
no warning/error console entries were observed before the invalid-code check.
These checks do **not** replace authenticated hosted signup, Storage upload,
save/reload/export, or two-account isolation tests. No new deployment, email,
account, database mutation, commit, or push was made in this follow-up.

## GitHub sign-in implementation (2026-10-16)

User approved the recommended GitHub-first launch. Implemented locally:
enabled-provider discovery from Supabase's public settings, GitHub sign-in
using cookie-based PKCE with only `user:email` scope, disabled-provider/error
states, cancellation handling and fixed private/no-store callback redirects.
Email UI now requires `AUTH_EMAIL_ENABLED=true` plus an enabled email provider;
leave it off until SMTP works. No GitHub secret belongs in Vercel or the app.

Verification: **213 tests in 28 files passed**, TypeScript and production build
passed. Added 17 tests for minimal OAuth scope/callback origin, provider
discovery failures, conditional login UI and success/cancel/error callbacks.
Successful code exchange is mocked in those tests, not a real GitHub login.
Browser inspection confirms the GitHub button is disabled while the live
Supabase provider remains unconfigured, with no unusable email form offered.

The GitHub registration form was prefilled with Screenova, the existing
protected preview homepage, and the exact Supabase callback URI. The Supabase
GitHub credential panel is open for the user to generate/enter credentials
directly and save. Neither app registration nor provider enablement was
submitted by the assistant. No new deployment or public release yet.
After credential setup, verify the live settings, test the local callback,
then configure the stable hosted origin and run authenticated hosted checks.
