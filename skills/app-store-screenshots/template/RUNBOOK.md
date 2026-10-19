# Screenova operator runbook

What to do when something pages you, how to change limits, how to restore data, and how to prove a deployment works. Production: https://screenova-sigma.vercel.app (Vercel team `stylerxs-projects`, project `screenova`). Never paste secrets, session files or user content into tickets or chat.

## Where signals land

| Signal | Where | Meaning |
|---|---|---|
| Sentry event at warning or worse (stage tag) | Sentry project; the alert rule emails the support inbox for every such production event | Something failed that users saw as a 503/502, or a planned limit was hit |
| `budget_global` warning | Sentry, once per pool per UTC day per server instance | The shared daily pool for `ai`, `upload` or `import` is empty; everyone gets the limit message until 00:00 UTC |
| `ai_quota` warning | Sentry | The OpenAI monthly hard limit is reached; users see "AI features are paused for now; manual editing and export still work." |
| `screenova_ops` lines | Vercel → Logs | Same events as Sentry, with `requestId` (`x-vercel-id`) for joining |
| Supabase resource alerts | Supabase dashboard / email | CPU or connection pressure |
| OpenAI usage email at 80% | OpenAI billing | Hard limit approaching |

Every Sentry event carries `stage` and, when available, `kind`, `code`, the Vercel request id and (workspace read/save stages only) the account's user id. It never carries emails, cookies, headers, request bodies or deck content.

## First checks by stage

| Stage | First check | Usual fix |
|---|---|---|
| `access_unavailable` with `PGRST003` or `57014` | Supabase CPU and connections; look for one function repeating in `pg_stat_activity` (the 2026-10-17 outage pattern) | A function raising a retryable code (`40001`) loops inside PostgREST: hotfix the migration to a non-retryable code (see `202610170001`) |
| `access_unavailable`, other code | Supabase status page; Vercel env for `NEXT_PUBLIC_SUPABASE_*` | Restore env or wait out the vendor incident |
| `middleware` | Supabase status and `NEXT_PUBLIC_SUPABASE_*` in Vercel; this blocks every protected page | Missing hosted config after an env edit, or Supabase Auth unreachable (pages redirect to the login screen's outage notice and API calls get 503, not a sign-out) |
| `workspace_read` / `workspace_save` | Code tag; Supabase logs for the request id | Stale tabs (409) never page; anything here is a real database failure |
| `budget_contract` | The budget function returned an unexpected value | A migration changed `consume_beta_budget_v2`'s return values; re-apply `202610170003`. A *dropped* function shows up instead as `access_unavailable` with code `PGRST202` |
| `budget_global` | `select kind, sum(attempts), count(*) from public.beta_usage where day = (now() at time zone 'utc')::date group by kind;` and the top accounts below | Expected on a busy day. If one account dominates, revoke it; if it is real demand, raise the cap with a migration |
| `ai_quota` | OpenAI billing | Raise the hard limit or wait for the month; manual editing and export keep working |
| `ai_provider` | Code tag: `invalid_api_key` (or `401`) means the key was rejected | Rotate `OPENAI_API_KEY` in Vercel; any other code is a vendor incident |
| `gallery_publish` / `gallery_read` / `gallery_unpublish` / `gallery_hide` | Vercel logs for the request id; `select count(*) from public.gallery_posts;` | A missing `gallery_posts` table means `202610190001_gallery.sql` was not applied; RLS denials on publish usually mean the account is not in `beta_members` |
| `ai_design_failed` / `ai_template_failed` / `ai_analysis_failed` | Vercel logs for the request id | An app-side failure after OpenAI answered (schema, parsing, normalizing), not a vendor incident |

Top accounts today:

```sql
select user_id, kind, attempts from public.beta_usage
where day = (now() at time zone 'utc')::date order by attempts desc limit 10;
```

## Gallery moderation

The public gallery (`/gallery`) shows posts as soon as they are published. Publishers can unpublish their own posts from the post page. To hide someone else's post:

1. Make yourself a moderator once, in the SQL Editor (find your user id under Authentication → Users):

   ```sql
   insert into public.gallery_moderators(user_id) values ('<your-user-id>');
   ```

2. Open the post signed in and click **Hide post**. Or in the SQL Editor:

   ```sql
   update public.gallery_posts set hidden = true where id = '<post-id>';
   ```

Unhide with `hidden = false`. Delete a post permanently with `delete from public.gallery_posts where id = '<post-id>';`. Hidden posts disappear from the list and their preview images stop serving within five minutes (the preview cache window). Publishing counts against the daily upload limit.

## Access and limits

Revoke one account (their data stays; they see "Workspace access is unavailable"):

```sql
delete from public.beta_members where user_id = '<uuid>';
```

Removing the row is permanent until you insert it again; the enrollment trigger does not restore revoked access on later profile updates.

Reset one account's counter for today (log why in the release notes):

```sql
delete from public.beta_usage where user_id = '<uuid>' and day = (now() at time zone 'utc')::date;
```

Change caps: write a new migration that replaces `public.consume_beta_budget_v2` with new numbers, keeping the lock, upsert, grants and verdict order. Run `npm test -- policies` before applying it in the SQL Editor. Current caps per UTC day: per account `ai` 20, `import` 10, `upload` 100; shared pool `ai` 1000, `import` 500, `upload` 5000.

Keep `public.consume_beta_budget` (v1). It is a one-line boolean wrapper over v2 so `vercel rollback` to any older deployment keeps working. Do not drop it.

## Deploy order (migrations first)

1. Apply new migrations in the Supabase SQL Editor, oldest first. Verify with a test account: `select public.consume_beta_budget_v2('import');` returns `ok`, `user`, `global` or `denied`.
2. Push the branch: Vercel builds a Preview automatically. Run the hosted smoke against that preview URL (below).
3. On preview only, prove alert delivery from a real error path: set `NEXT_PUBLIC_SUPABASE_URL` for Preview to `https://<your-project-ref>.invalid` (keep the same first label: the session cookie is named after it, so a different host signs you out instead of simulating an outage), redeploy preview, open `/api/project` signed in, confirm a `middleware` or `access_unavailable` event (environment preview) appears in Sentry, then restore the value and redeploy. Preview events do not email by design; the weekly self-test proves the production email path. A 401 here means the drill URL changed the project ref, not that alerting is broken.
4. Merge to `main`: Vercel deploys Production automatically. Then run the hosted smoke against production.
5. Update `DEPLOYMENT.md` with measured results.

Deploying app code before its migration makes every upload, import and AI request return 503 (`PGRST202`, function not found). Roll back with `vercel rollback <previous-deployment-url> --scope stylerxs-projects` (under two minutes). Deployments before this release have no error reporting: after rolling back past it, alerts are off, so watch Vercel logs and Supabase by hand and roll forward as soon as a fixed build exists.

## Hosted smoke

Two dedicated test accounts, A and B, used for nothing else: their workspaces are overwritten by the suite. Capture each session once in a visible browser, signing in with that account:

```bash
npx playwright codegen --save-storage=e2e/.auth/screenova-sigma.vercel.app/a.json https://screenova-sigma.vercel.app/login
npx playwright codegen --save-storage=e2e/.auth/screenova-sigma.vercel.app/b.json https://screenova-sigma.vercel.app/login
```

Sessions are per host: capture a separate pair under `e2e/.auth/<preview-host>/` for a preview run. `e2e/.auth/` is git-ignored and never uploaded. Run:

```bash
E2E_BASE_URL=https://screenova-sigma.vercel.app npm run test:hosted
# preview: also export VERCEL_AUTOMATION_BYPASS_SECRET
```

After every test, pass or fail, the suite saves the refreshed session back (without the preview bypass cookie), because Supabase rotates refresh tokens on first use. If a run reports "Session expired or revoked", capture that account again for that host. A result starting with `INCONCLUSIVE` means the daily cap or the OpenAI limit stopped the AI or upload step. That is not a pass: rerun after 00:00 UTC or after raising the limit.

Covered: large (over 4.5 MB) upload straight to Storage, per-language replacement keeping the other language's image, reload, export, one AI redesign, a stale-tab save rejected without losing the newer one, account B unable to read or write A's data, anonymous denial. Check by hand each release: Google and GitHub sign-in and sign-out. Sign-out revokes the session the suite reuses, so it stays manual.

## Backups and restore

Backup status and the plan to enable scheduled backups are tracked by the owner (TODOS.md). Before any risky migration, take a manual dump. Use the database password from Supabase → Settings → Database, and keep the file outside the repo:

```bash
pg_dump "<production connection string>" --schema=public --no-owner -f ~/screenova-backups/screenova-$(date +%F).sql
```

When the paid tier is enabled, run this drill once and record it. Never use the dashboard's in-place restore on production for a drill:

1. In Supabase → Database → Backups, download the most recent daily backup.
2. Create a new scratch project named `screenova-restore-<date>`.
3. Restore into the scratch project only: `psql "<scratch connection string>" -f <backup>.sql` (or `pg_restore` for a `.dump`). Paste the scratch project ref into the record first; it must not be the production ref.
4. Check that `select count(*) from public.projects;` is in the expected range and one known test deck reads back.
5. Delete the scratch project the same day; it is a full copy of every user's data.

| Date | Backup taken | Restore duration | Result | Scratch project deleted |
|---|---|---|---|---|
| _not possible until backups exist_ | | | | |

## Sentry alert rule

Create one alert rule in the Sentry project: **when an event is seen, level is warning or worse, and environment is production → email the support inbox**. Preview events still appear in Sentry, but they never email. Do not use the default "new issue" rule: events are grouped by stage, kind and code, so a "new issue" rule emails only the very first time each problem ever happens and stays silent on every repeat. After each incident, mark its issues resolved so the history stays readable. Event volume is bounded: each server instance sends at most one event per stage, kind and code per minute (every occurrence still appears in Vercel logs), and the shared-pool and OpenAI-limit alerts send once per UTC day per instance.

## Weekly checks

- Alert path: `vercel env pull .env.ops --environment=production --scope stylerxs-projects; node --env-file=.env.ops scripts/ops-test-event.mjs; status=$?; rm -f .env.ops; exit $status`. The file holds every production secret, so it is removed even when the test fails. Confirm the `ops_test_event` warning in Sentry and the email. The test event uses the same fixed grouping and environment as real production events, so it proves the rule real alerts depend on. Silence otherwise looks like health.
- Storage size: Supabase → Storage → `project-assets`. Above 500 MB or 5,000 objects, pick up the orphan-cleanup TODO.
- OpenAI usage against the hard limit.

## Vendor settings to keep recorded here

| Setting | Value | Set on |
|---|---|---|
| Supabase plan and daily backups | current tier kept; backups deferred by owner | 2026-10-18 |
| OpenAI monthly hard limit | _pending_ | |
| OpenAI usage email threshold | 80% | |
| Sentry alert rule | every production event at level warning or worse → support inbox (not "new issue", which emails only the first occurrence ever) | _pending_ |
| `SENTRY_DSN` in Vercel Preview and Production | set (value not recorded) | _pending_ |
