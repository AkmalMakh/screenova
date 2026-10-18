## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Deploy Configuration (configured by /setup-deploy)

- Platform: Vercel; approved team `stylerxs-projects`, project `screenova` (`prj_0aIlKTkm58K1Omz6bkQFkEZkNByb`).
- Application root: this `template/` directory. Next.js, Node `22.x`, install `npm ci`, build `npm run build`.
- Approved production URL: https://screenova-sigma.vercel.app. Public production deployment was explicitly approved on 2026-10-16; keep application authentication, RLS and private Storage enabled.
- Preview URL: https://screenova-304b16uzw-stylerxs-projects.vercel.app
- Deploy workflow: manual CLI from this directory. No Git integration; no automatic push/merge deployment.
- Deploy status command: `vercel inspect screenova-304b16uzw-stylerxs-projects.vercel.app --scope stylerxs-projects`.
- Repository: `screenova` remote, https://github.com/AkmalMakh/screenova.git; the working branch tracks `screenova/main`. Never publish personal workspace changes.
- Project type: web app.
- Post-deploy health check: protected preview `/login` should return 200 using `vercel curl`; without an app session, `/studio` redirects to login and `/api/project` returns 401. `/screenshots/*` must return 404.

### Custom deploy hooks

- Pre-deploy: `npm test`, `npm run check`, `npm run build`, `npm run test:e2e`; verify `vercel deploy --dry --json` excludes personal assets, project JSON and secrets and includes `src/lib/supabase/*`. Record the middleware bundle size from the build output; it must stay under Vercel's 1 MB edge limit (186 kB on 2026-10-18).
- Migrations first: apply new `supabase/migrations/*.sql` in the SQL Editor before deploying code that calls them. Deploying this app code before `202610170003` is applied makes every budgeted route return 503. Never drop `consume_beta_budget` (v1); it keeps `vercel rollback` working.
- Post-deploy smoke: `E2E_BASE_URL=<deployment> npm run test:hosted` with the two dedicated test accounts (sessions per host under `e2e/.auth/<host>/a.json` and `b.json`; add `VERCEL_AUTOMATION_BYPASS_SECRET` for previews, sent only as Vercel's host-only bypass cookie). `INCONCLUSIVE` results are not passes. Sign-in and sign-out are checked by hand. See `RUNBOOK.md`.
- Error reporting: server-only Sentry, enabled by `SENTRY_DSN` in Vercel Preview and Production; no source-map upload and no Sentry auth token. Prove delivery on preview from a forced error path (RUNBOOK.md, deploy order step 3).
- Production deploy trigger: `vercel deploy --prod --yes --scope stylerxs-projects` from this directory. Preview: use `--target preview` instead. Inspect the returned target.
- Deploy status: `vercel inspect <deployment-url> --wait --timeout 60s --scope stylerxs-projects`.
- Health check: `vercel curl /login --deployment <deployment-url> --scope stylerxs-projects -- --silent --output /dev/null --write-out '%{http_code}'`.
- Preview and Production configuration are stored in Vercel; OpenAI key is sensitive/server-only. Supabase Site URL uses the stable production origin and its exact `/auth/callback`; localhost callback remains for development. Never copy local project data into the upload.
- First-deploy quirk: Vercel assigned the initial explicit-preview attempt to Production. It was canceled while building, with no aliases assigned. The retained canceled record allowed the next deployment to be Preview. Do not delete that record casually or bootstrap Production without approval.
- Google/GitHub are the launch sign-in methods; SMTP is not required while email UI is disabled. Hosted authenticated two-account QA remains distinct from successful local verification. See `DEPLOYMENT.md` for current results and limits.
