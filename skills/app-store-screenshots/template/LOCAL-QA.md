# Screenova local QA — 2026-10-16

Scope: local single-user Studio and editor; no email setup or deployment. Existing worktree changes preserved with explicit permission to skip QA auto-commits. Test projects use isolated temporary JSON files; existing user projects are not test fixtures.

## Findings

### LOCAL-001 — Local entry page implies email registration is needed

Severity: medium. Category: content/UX. Reproduced on localhost:3000 and the isolated production server at 127.0.0.1:3101.

Steps: open the landing page, click **Sign in**, read **Open your workspace**. The modal leads with cloud account creation although the local Studio opens without authentication. The pricing section also leads with account creation.

Fix: pending. Browser screenshots captured before the fix in the QA conversation.

### LOCAL-002 — Mock testimonials appear as real endorsements

Severity: medium. Category: content. The landing page renders the TESTIMONIALS fixture, including named customers and a claimed 28% conversion increase, without labeling it as sample content. No verification is recorded.

Fix: pending. Keep fixture/source files intact, but do not render unverified endorsements on the landing page.

## Verification in progress

- 176 unit tests passed across 20 files.
- Production build passed, including type checking.
- Full production browser suite running with live Apple/OpenAI checks enabled.
- Manual browser check: preset creates an editable deck; phone selection opens the image picker; actual saved status appears; no console errors observed.
