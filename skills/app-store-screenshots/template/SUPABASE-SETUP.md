# Supabase public-signup beta

## Public sign-up change (requested 2026-10-16)

Public email sign-up is implemented and enabled on the hosted Screenova project, following explicit approval on 2026-10-16. Email verification is required; anonymous sign-ins remain disabled. External email delivery and authenticated end-to-end testing are still pending.

- The login form permits account creation with `shouldCreateUser: true` and explains that the same email flow signs in returning users.
- Applied `202610160002_public_signup.sql` after the first migration. It enrolls non-anonymous accounts only after their email is confirmed, including a one-time backfill of already verified accounts. The existing `beta_members` table remains an internal access registry, not a requirement for a personal invitation.
- Enabled **Allow new users to sign up** in Supabase Auth, while keeping **Confirm email** on and anonymous sign-ins off. The public Auth API confirms these saved settings.
- Owner-only project/image policies and the existing per-user/global usage limits remain unchanged. Removing an access-registry row still revokes access; routine profile or email-confirmation updates do not restore it.
- Configure custom SMTP for external users. Once available, configure **Confirm sign up** and **Magic Link** templates to link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Invites may still use `type=invite`.
- The public-signup migration is tested against actual Postgres via PGlite: unverified users remain blocked, confirmed users gain only their own workspace, anonymous accounts are excluded, revoked access stays revoked, and clients cannot invoke the enrollment trigger directly.
- This does not publish the application to the internet. A production origin, email delivery, abuse protection and an authenticated two-account end-to-end test are still required before a public launch.

Connected to the **Screenova** Supabase project (`uubcnvnfxrupnamrzxfs`), Free organization, Sydney (`ap-southeast-2`).
The migration was applied through the SQL editor and its permissions verified on the hosted database. Full authenticated two-account testing is still pending.
The existing local JSON file, images and OpenAI environment values have not been migrated or replaced.

### Current setup

- The four application tables, workspace RPCs, usage limits and private `project-assets` bucket are created.
- Seven hosted SQL checks passed: RLS on all four tables, private bucket with 8 MiB limit, all five ownership policies, denied anonymous RPC execution, allowed authenticated RPC execution, protected membership/usage writes, and an empty beta allowlist.
- Public sign-ups are enabled; anonymous sign-ins remain disabled and email confirmation remains enabled. Six additional hosted SQL checks passed after enrollment was added: enabled trigger, privileged function with client execution denied, retained table RLS, private bucket/size limit, denied anonymous workspace RPCs and protected membership writes. Anonymous project/membership reads and workspace RPC calls still return 401.
- Site URL: `http://localhost:3001`. Exact allowed redirect: `http://localhost:3001/auth/callback`. Replace these with the actual deployment origin before inviting external testers.
- The public URL/key are saved in git-ignored `.env.local`, with file permissions restricted to the owner. No database password or service-role key is used.
- `APP_STORAGE_MODE=local` remains the local default to preserve the existing workspace on port 3000. A separate cloud dev process was started on port 3001 using the command below; restart it if needed.
- Hosted Auth settings and anonymous REST/RPC access were checked using the public API key. Unauthenticated app requests redirect Studio to login, return 401 for project data, and return 404 for original local screenshot paths.
- **Pending:** custom SMTP, signup/magic-link email templates and a full live two-account test. The dashboard currently requires custom SMTP before editing templates. No invitation or manual membership entry is required for verified public accounts.

```bash
APP_STORAGE_MODE=supabase NEXT_BUILD_DIR=.next-cloud npm run dev -- --hostname 127.0.0.1 --port 3001
```

Both SQL migrations were applied manually, not through the Supabase CLI migration ledger. If later adopting CLI migrations, verify the schema and mark both versions as already applied before attempting a database push. Do not rerun the creation scripts on this initialized project.

## Storage model

| Data | Location |
| --- | --- |
| Accounts and email sign-in | Supabase Auth |
| Verified-account access registry | `public.beta_members` |
| Project JSON, including editable slides and artwork | `public.projects.state` (JSONB), owned by `user_id` |
| Active project, ordering and optimistic save revision | `public.workspaces` |
| Uploaded, imported and generated images | Private `project-assets` Storage bucket, under the owner's UUID |
| Daily API attempt counters | `public.beta_usage` |
| Instant edit recovery and design-chat history | Account-scoped browser storage; chat does not sync between devices |
| Downloaded PNG/ZIP exports | User's computer; exports are generated in the browser |

The application uses the signed-in user's session and row-level security, not a service-role key.
Stable `/api/assets/<user-id>/...` URLs authenticate each image request; there are no public bucket URLs or expiring URLs saved inside project JSON.
Original `/screenshots/*` files are blocked in cloud mode. Cloud APIs never fall back to the local workspace on an outage.

## 1. Create the project and database

1. Sign in to your own Supabase account. Create or select a dedicated project. Choose the region and plan yourself; no paid subscription has been created by this implementation.
2. Keep the database password in your password manager. The application does not need it.
3. In the SQL editor, run [`supabase/migrations/202610160001_private_workspaces.sql`](supabase/migrations/202610160001_private_workspaces.sql) once against the new project. It is transactional and intentionally not an overwrite/reset script. For an existing project, review conflicting table, function, bucket and policy names first.
4. Confirm RLS is enabled on `beta_members`, `workspaces`, `projects`, and `beta_usage`. Confirm `project-assets` is private, with an 8 MiB per-file limit and PNG/JPEG/WebP MIME types only. The SQL creates these settings.
5. Run [`supabase/migrations/202610160002_public_signup.sql`](supabase/migrations/202610160002_public_signup.sql) once to enroll verified email accounts automatically. Both migrations are already applied to Screenova.

## 2. Configure the application

Add these values to the deployment environment (or merge into `.env.local` for a local cloud test). Do not overwrite an existing `.env.local`:

```dotenv
APP_STORAGE_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
OPENAI_API_KEY=YOUR_SERVER_ONLY_OPENAI_KEY
```

Use the publishable key, never a Supabase secret/service-role key. Public settings must exist **when building**, because Next.js embeds them into the browser bundle. Rebuild after changing them. OpenAI keys remain server-only.

Production defaults to cloud mode and refuses access if its configuration is missing. Local development without Supabase configuration retains the original local mode. To run a local production build explicitly:

```bash
APP_STORAGE_MODE=local npm run build
APP_STORAGE_MODE=local npm run start -- --hostname 127.0.0.1
```

Do not publicly deploy `APP_STORAGE_MODE=local`. Deploy a clean application artifact that excludes the original `app-store-screenshots.json`, `public/screenshots/` user assets, `.env.local`, test reports and browser traces. Middleware is a second safeguard, not a substitute for keeping personal files out of deployment artifacts. Keep public device-frame assets used by the editor.

Use a Node 22+ runtime. No runtime persistent filesystem is needed in cloud mode. The hosting provider still needs suitable execution-time and request-size allowances for AI generation and image uploads; deployment to a particular host is not configured here.

## 3. Configure email and public registration

1. Configure your own SMTP provider in Supabase Auth before inviting external testers. Supabase's default mail service is restricted and is not a suitable external-beta mail setup: [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).
2. In Auth URL Configuration, set Site URL to your actual HTTPS application origin. Add that origin's `/auth/callback` to the redirect allowlist. Add `http://localhost:3000/auth/callback` only for local cloud testing. Avoid broad wildcard production redirects.
3. Enable public sign-ups, keep email confirmation on, and keep anonymous sign-ins off. The login form sends `shouldCreateUser: true` so the same flow serves new and returning users.
4. Configure both **Confirm sign up** and **Magic Link** email links to use the server-side confirmation route:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Open your workspace</a>
   ```

   Optional invitation emails can use `type=invite`. This token-hash flow also works when a user opens the email in a different browser. `/auth/callback` supports the standard PKCE flow as well. Both routes redirect only to Studio or a recoverable login error page, never to an arbitrary destination.
5. New users register from the login page and verify their email. The database trigger then grants workspace access automatically. Unconfirmed and anonymous accounts do not receive access.
6. To revoke beta access without deleting data, remove only that account's allowlist row. This blocks project/image access through both the application and RLS. Deleting Auth users also cascades database records; do not use that as a reversible access switch. Storage objects require separate cleanup.

Project connection, both migrations, private storage, public registration and local callback configuration are applied. Email templates and SMTP credentials are **not** configured yet.

## 4. Limits, saves and recovery

- Daily UTC attempt limits: AI 20/account and 100/global; import endpoints 10/account and 50/global; upload endpoint 100/account and 500/global. Lookups and imports each consume an import attempt. Failed requests consume an attempt. Limits are atomic database counters, not in-memory counters.
- These are request limits, **not a dollar spend ceiling**. One AI request may make multiple model calls. Configure provider budgets/alerts and monitor real usage before the beta. Upload attempt limits cover application endpoints; authenticated direct Storage calls are still governed by bucket/RLS limits, not this API counter.
- Projects use a per-account transactional save lock plus revision comparison. A stale tab receives HTTP 409 instead of overwriting newer cloud state. Reload to load the cloud version. Browser edits remain account-scoped; a differing remote revision preserves the prior cached bundle at `screenova:<user-id>:recovery-workspace` before replacing the active cache. There is no recovery/import UI yet; contact the organizer before clearing browser data if recovery is needed.
- Browser caches and chat remain on that device after sign-out, scoped by account. This is session isolation, not encryption against another person with access to the same browser profile. Use separate browser profiles on shared computers.
- Deleting a project does not yet garbage-collect its image objects. Monitor Storage usage; do not delete shared/duplicated-project images without checking references.
- No local-to-cloud migration is automatic. Migrate existing personal projects only after choosing the explicit destination account and backing up both JSON and images. This import workflow is not yet implemented; your original local projects remain available in local mode.

Back up **both** the database and Storage objects and test a restore. Supabase database backups do not include the file contents stored in Storage: [backup guidance](https://supabase.com/docs/guides/platform/backups). No scheduled backup job is configured by this code.

## 5. Verification and release gate

```bash
nvm use
npm ci
npm test
npm run check
npm run build
npm run test:e2e
```

Unit tests execute the actual migration in PGlite/Postgres with representative Auth/Storage schemas, checking tenant isolation, private file policies, atomic save conflicts and usage limits. Request tests cover anonymous/uninvited accounts, expired sessions, wrong-owner requests, cross-origin mutations, quota failure and database outages. These do not exercise hosted Supabase Auth/Storage infrastructure.

The existing Chromium suite explicitly runs **local mode** against isolated test data. It checks editor behavior, uploads, exports and persistence, not cloud login. The two optional live Apple/OpenAI tests are skipped by default.

Before inviting the five developers, complete these live checks with two test accounts:

- [ ] Apply migration; configure SMTP, site URL, redirect URLs and email templates.
- [ ] Register A and B publicly; test email confirmation, new/expired/reused email links and sign-out.
- [ ] A creates a project, uploads an image, edits a localized screenshot, refreshes, then opens it on another browser/device.
- [ ] A exports PNG/ZIP successfully with private images visibly present.
- [ ] B cannot see A's projects or fetch A's copied image URL. Test direct Supabase queries as B too, not just the UI.
- [ ] Signing out and switching A/B in the same browser does not mix cached projects or chat.
- [ ] Two tabs produce a visible conflict rather than overwriting a newer save; offline edits and reconnection are checked.
- [ ] AI design, screenshot analysis, generated images and Apple import work with private Storage paths.
- [ ] Removing B's beta membership blocks project, AI and image requests.
- [ ] Anonymous project/upload/AI requests fail, and original `/screenshots/*` files are inaccessible on the public host.
- [ ] Confirm hosting timeouts, request-size limits, provider cost monitoring, backup/restore and a contact for beta feedback.

Cloud integration is not a declaration that the whole product is launch-ready. Payments, team collaboration, user-facing account deletion, asset cleanup, chat sync and automated local-project migration are outside this first integration.
