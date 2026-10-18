import { storageMode } from "@/lib/supabase/config";

// Server-only error reporting for hosted installations. Without SENTRY_DSN, or
// in local mode, nothing is initialized and src/lib/ops.ts only logs locally.
// Runs in both the nodejs and edge runtimes; the package resolves the right build.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    if (storageMode() === "local") return;
    const Sentry = await import("@sentry/nextjs");
    const { scrubEvent } = await import("@/lib/ops");
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      tracesSampleRate: 0,
      // Collect nothing about the request or user automatically. Events carry
      // only the allow-listed fields from scrubContext in src/lib/ops.ts.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        stackFrameVariables: false,
      },
      maxValueLength: 500,
      beforeSend: scrubEvent,
    });
  } catch (error) {
    // A broken reporter must never take the app down at cold start.
    console.error("screenova_sentry_init_failed", { message: error instanceof Error ? error.name : "unknown" });
  }
}
