// Weekly alert self-test (RUNBOOK.md): sends one warning through the same
// Sentry project the app reports to, so a rotted DSN or a disabled alert rule
// is noticed on a quiet day instead of during an outage.
//
//   vercel env pull .env.ops --environment=production --scope stylerxs-projects
//   node --env-file=.env.ops scripts/ops-test-event.mjs; status=$?; rm -f .env.ops; exit $status
// Default import: plain Node ESM only sees a fraction of this CommonJS package's
// named exports (flush and captureMessage are missing); the default is complete.
import Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (!dsn) {
  console.error("SENTRY_DSN is not set. Pull production env first (see the comment at the top of this file).");
  process.exit(1);
}
// Same environment and grouping scheme as real events (src/lib/ops.ts), so a
// passing self-test proves the alert rule that real production events rely on.
Sentry.init({ dsn, environment: "production", tracesSampleRate: 0, dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false } });
const stamp = new Date().toISOString();
Sentry.captureMessage("screenova ops_test_event", {
  level: "warning",
  tags: { stage: "ops_test_event" },
  extra: { sentAt: stamp },
  fingerprint: ["screenova", "ops_test_event", "-", "-"],
});
const delivered = await Sentry.flush(5000);
console.log(delivered ? `Sent ops_test_event ${stamp}. Confirm it in Sentry and in the alert inbox.` : "Sentry did not confirm delivery within 5 s.");
process.exit(delivered ? 0 : 1);
