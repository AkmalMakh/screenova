import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { PROJECT_SCHEMA_VERSION } from "../../src/lib/constants";
import { LIMIT_REACHED } from "../../src/lib/supabase/messages";

// Hosted smoke fixtures.
//
// Google and GitHub block automated sign-in, so each dedicated test account's
// session is captured once by hand (see RUNBOOK.md):
//   npx playwright codegen --save-storage=e2e/.auth/<host>/a.json $E2E_BASE_URL/login
// Supabase rotates the refresh token every time a session is refreshed. After a
// test the refreshed session is written back, pass or fail: the token rotates on
// the first request either way, so the old file is already dead after any run.
//
// These accounts' workspaces are overwritten by the suite. Never point
// E2E_STATE_A / E2E_STATE_B at a real person's session.
// Supabase session cookies are host-only, and refresh tokens rotate: keep one
// session file per account per deployment host, never shared between hosts.
const HOST = (() => { try { return new URL(process.env.E2E_BASE_URL ?? "").host; } catch { return "unset-host"; } })();
export const STATE_A = process.env.E2E_STATE_A || `e2e/.auth/${HOST}/a.json`;
export const STATE_B = process.env.E2E_STATE_B || `e2e/.auth/${HOST}/b.json`;

export type Account = { context: BrowserContext; page: Page; request: APIRequestContext };

/**
 * Reach a Vercel-protected preview without leaking the bypass secret: one
 * request to the deployment sets Vercel's own host-only bypass cookie, which
 * the page and context.request then send only to that host (never to Supabase
 * or other origins). No-op when VERCEL_AUTOMATION_BYPASS_SECRET is unset.
 */
export async function allowPreview(context: BrowserContext) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) return;
  const response = await context.request.get("/login", {
    headers: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" },
    maxRedirects: 0,
  });
  if (response.status() >= 400) throw new Error(`Vercel bypass was refused (HTTP ${response.status()}); check VERCEL_AUTOMATION_BYPASS_SECRET.`);
}

async function openAccount(browser: import("@playwright/test").Browser, statePath: string, use: (account: Account) => Promise<void>) {
  if (!existsSync(statePath)) throw new Error(`Missing ${statePath}. Capture it once for this host: npx playwright codegen --save-storage=${statePath} ${process.env.E2E_BASE_URL}/login`);
  const context = await browser.newContext({ storageState: statePath });
  await allowPreview(context);
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ body: "", contentType: "text/css" }));
  try {
    await use({ context, page, request: context.request });
  } finally {
    try {
      // Never persist the preview bypass cookie next to the account session.
      await context.clearCookies({ name: "_vercel_jwt" });
      await context.storageState({ path: statePath });
    } finally {
      await context.close();
    }
  }
}

export const test = base.extend<{ accountA: Account; accountB: Account }>({
  accountA: async ({ browser }, use) => openAccount(browser, STATE_A, use),
  accountB: async ({ browser }, use) => openAccount(browser, STATE_B, use),
});
export { expect };

/** Read the signed-in workspace; fails fast with a recapture hint when the session expired. */
export async function workspace(request: APIRequestContext) {
  const response = await request.get("/api/project");
  if (response.status() === 401) throw new Error(`Session expired or revoked: recapture ${STATE_A} and ${STATE_B} for this host (see RUNBOOK.md).`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<{ ok: true; state: { activeId: string; projects: Record<string, Project> }; revision: string; ownerId: string }>;
}

export async function saveWorkspace(request: APIRequestContext, bundle: unknown, revision: string, ownerId: string) {
  return request.post("/api/project", { data: bundle, headers: { "if-match": revision, "x-screenova-owner": ownerId } });
}

export type Project = { id: string; name: string; slidesByDevice: Record<string, Array<{ id: string; screenshot: string; headline: Record<string, string> }>>; [key: string]: unknown };

export function smokeBundle(id: string, marker: string) {
  return {
    version: 1, activeId: id, order: [id],
    projects: {
      [id]: {
        id, name: `Smoke ${marker}`, updatedAt: Date.now(), schemaVersion: PROJECT_SCHEMA_VERSION,
        appName: "Smoke App", appIcon: "", themeId: "clean-light", connectedCanvas: true,
        locale: "en", locales: ["en", "de"], device: "iphone", orientation: "portrait",
        slidesByDevice: { iphone: [{ id: "smoke-screen", layout: "device-bottom", label: { en: "SMOKE", de: "SMOKE" }, headline: { en: `Hosted ${marker}`, de: `Gehostet ${marker}` }, screenshot: "" }] },
      },
    },
  };
}

/** Distinguish "the beta pool is empty today" from a real regression. Never let it pass as green. */
export function inconclusiveIfCapped(status: number, body: { error?: string }) {
  if (status === 429 && body.error === LIMIT_REACHED) {
    throw new Error("INCONCLUSIVE: daily beta cap reached for this account or the shared pool. Rerun after 00:00 UTC; this is not a pass.");
  }
}
