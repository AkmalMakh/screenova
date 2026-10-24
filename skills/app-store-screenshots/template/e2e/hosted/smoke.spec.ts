import JSZip from "jszip";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { AI_PAUSED } from "../../src/lib/openai-errors";
import { allowPreview, expect, inconclusiveIfCapped, saveWorkspace, smokeBundle, test, workspace } from "./fixtures";

// Post-deploy smoke for the public beta (DEPLOYMENT.md gates 4-6). Runs only
// with E2E_BASE_URL set; see RUNBOOK.md. Sign-out is checked by hand: Supabase
// sign-out revokes the session these tests reuse.
test.skip(!process.env.E2E_BASE_URL, "Hosted smoke runs only against a deployment (E2E_BASE_URL).");

const PROJECT = "hosted-smoke";

/** Random noise does not compress: about 6 MB as PNG, above Vercel's 4.5 MB body limit, below the 8 MiB cap. */
async function largeScreenshot(rgb: [number, number, number]) {
  const width = 1200, height = 1700;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 3) {
    const noise = Math.floor(Math.random() * 24);
    raw[i] = Math.min(255, rgb[0] + noise); raw[i + 1] = Math.min(255, rgb[1] + noise); raw[i + 2] = Math.min(255, rgb[2] + noise);
  }
  const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  expect(png.byteLength).toBeGreaterThan(4_500_000);
  expect(png.byteLength).toBeLessThan(8 * 1024 * 1024);
  return png;
}

test("account A: large upload, localized replacement, reload and export on the real host", async ({ accountA }) => {
  const { page, request } = accountA;
  const before = await workspace(request);
  expect((await saveWorkspace(request, smokeBundle(PROJECT, "upload"), before.revision, before.ownerId)).status()).toBe(200);

  await page.goto("/editor");
  await expect(page.getByRole("textbox", { name: "App name", exact: true })).toHaveValue("Smoke App");
  // Manual-first editor: the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  const fileInput = page.locator('input[type="file"][aria-label]').first();

  // 1. First upload goes straight to private Storage, then finalizes by path.
  const uploadDone = page.waitForResponse((r) => r.url().endsWith("/api/upload"), { timeout: 120_000 });
  await fileInput.setInputFiles({ name: "smoke-red.png", mimeType: "image/png", buffer: await largeScreenshot([200, 40, 40]) });
  const firstUpload = await uploadDone;
  inconclusiveIfCapped(firstUpload.status(), await firstUpload.json().catch(() => ({})));
  expect(firstUpload.status()).toBe(200);
  await expect.poll(async () => (await workspace(request)).state.projects[PROJECT].slidesByDevice.iphone[0].screenshot, { timeout: 60_000 }).toMatch(/^\/api\/assets\//);
  const firstPath = (await workspace(request)).state.projects[PROJECT].slidesByDevice.iphone[0].screenshot;

  // 2. Replacing it in a two-language project writes a per-language copy and
  //    seeds the other language from the previous bytes.
  const replaceDone = page.waitForResponse((r) => r.url().endsWith("/api/upload"), { timeout: 120_000 });
  await fileInput.setInputFiles({ name: "smoke-blue.png", mimeType: "image/png", buffer: await largeScreenshot([40, 60, 200]) });
  const replaced = await replaceDone;
  inconclusiveIfCapped(replaced.status(), await replaced.json().catch(() => ({})));
  expect(replaced.status()).toBe(200);
  await expect.poll(async () => (await workspace(request)).state.projects[PROJECT].slidesByDevice.iphone[0].screenshot, { timeout: 60_000 }).toContain("{locale}");
  const pattern = (await workspace(request)).state.projects[PROJECT].slidesByDevice.iphone[0].screenshot;
  const en = await request.get(pattern.replace("{locale}", "en"));
  const de = await request.get(pattern.replace("{locale}", "de"));
  expect([en.status(), de.status()]).toEqual([200, 200]);
  expect(en.headers()["cache-control"]).toContain("private");
  const [enPixel, dePixel] = await Promise.all([en, de].map(async (r) => (await sharp(await r.body()).resize(1, 1).removeAlpha().raw().toBuffer())));
  expect(enPixel[2]).toBeGreaterThan(enPixel[0]); // replaced language shows the new blue image
  expect(dePixel[0]).toBeGreaterThan(dePixel[2]); // other language keeps the original red image
  expect((await request.get(firstPath)).status()).toBe(200); // originals stay for Undo and copies

  // 3. Reload and export the bundle.
  await page.reload();
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled({ timeout: 60_000 });
  const downloaded = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByRole("button", { name: "Export bundle" }).click();
  const zipPath = test.info().outputPath("hosted-export.zip");
  await (await downloaded).saveAs(zipPath);
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const pngs = Object.values(zip.files).filter((file) => file.name.endsWith(".png"));
  expect(pngs.length).toBeGreaterThan(0);
  for (const file of pngs) expect((await sharp(await file.async("nodebuffer")).metadata()).format).toBe("png");
});

test("account A: one AI redesign returns a proposal", async ({ accountA }) => {
  const { request } = accountA;
  const current = await workspace(request);
  expect((await saveWorkspace(request, smokeBundle(PROJECT, "ai"), current.revision, current.ownerId)).status()).toBe(200);
  const project = (await workspace(request)).state.projects[PROJECT];
  const preview = await sharp({ create: { width: 120, height: 260, channels: 3, background: "#2E6BE6" } }).jpeg().toBuffer();
  const response = await request.post("/api/design", {
    headers: { "x-screenova-owner": current.ownerId },
    data: {
      prompt: "Make the headline shorter. Do not generate any images.",
      project, scope: { type: "current", slideIds: ["smoke-screen"] },
      renderedPreviews: [{ slideId: "smoke-screen", dataUrl: `data:image/jpeg;base64,${preview.toString("base64")}` }],
      references: [],
    },
    timeout: 170_000,
  });
  const body = await response.json();
  inconclusiveIfCapped(response.status(), body);
  if (response.status() === 503 && body.error === AI_PAUSED) {
    throw new Error("INCONCLUSIVE: OpenAI monthly limit reached. The paused-AI message is correct, but AI was not exercised.");
  }
  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body.proposal.targetSlideIds).toEqual(["smoke-screen"]);
});

test("stale tab: an old revision is rejected and the newer save survives", async ({ accountA }) => {
  const { request } = accountA;
  const start = await workspace(request);
  const first = await saveWorkspace(request, smokeBundle(PROJECT, "newer"), start.revision, start.ownerId);
  expect(first.status()).toBe(200);
  const stale = await saveWorkspace(request, smokeBundle(PROJECT, "stale"), start.revision, start.ownerId);
  expect(stale.status()).toBe(409);
  const after = await workspace(request);
  expect(after.revision).toBe((await first.json()).revision);
  expect(after.state.projects[PROJECT].slidesByDevice.iphone[0].headline.en).toBe("Hosted newer");
});

test("account B cannot see or fetch account A's data", async ({ accountA, accountB }) => {
  // A owns a fresh private image inside this test, so the check never depends on
  // what earlier tests left behind and can never silently skip.
  const start = await workspace(accountA.request);
  expect((await saveWorkspace(accountA.request, smokeBundle(PROJECT, "isolation"), start.revision, start.ownerId)).status()).toBe(200);
  await accountA.page.goto("/editor");
  await expect(accountA.page.getByRole("textbox", { name: "App name", exact: true })).toHaveValue("Smoke App");
  await expect(accountA.page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  const uploaded = accountA.page.waitForResponse((r) => r.url().endsWith("/api/upload"), { timeout: 120_000 });
  const small = await sharp({ create: { width: 120, height: 260, channels: 3, background: "#118844" } }).png().toBuffer();
  await accountA.page.locator('input[type="file"][aria-label]').first().setInputFiles({ name: "isolation.png", mimeType: "image/png", buffer: small });
  const upload = await uploaded;
  inconclusiveIfCapped(upload.status(), await upload.json().catch(() => ({})));
  expect(upload.status()).toBe(200);
  await expect.poll(async () => (await workspace(accountA.request)).state.projects[PROJECT].slidesByDevice.iphone[0].screenshot, { timeout: 60_000 }).toMatch(/^\/api\/assets\//);
  const a = await workspace(accountA.request);
  const b = await workspace(accountB.request);
  expect(b.ownerId).not.toBe(a.ownerId);
  const aAsset = a.state.projects[PROJECT].slidesByDevice.iphone[0].screenshot.replace("{locale}", "en");
  expect(aAsset).toMatch(/^\/api\/assets\//);
  expect((await accountA.request.get(aAsset)).status()).toBe(200);
  expect([401, 403, 404]).toContain((await accountB.request.get(aAsset)).status());
  // B writing with A's owner header is refused before any database call.
  const refused = await saveWorkspace(accountB.request, smokeBundle(PROJECT, "intruder"), b.revision, a.ownerId);
  expect(refused.status()).toBe(409);
  expect((await workspace(accountA.request)).state.projects[PROJECT]?.name).not.toBe("Smoke intruder");
});

test("anonymous visitors are denied everywhere private", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await allowPreview(context);
    const request = context.request;
    expect((await request.get("/api/project")).status()).toBe(401);
    expect((await request.post("/api/design", { data: {} })).status()).toBe(401);
    expect((await request.get("/screenshots/shared/phone.png")).status()).toBe(404);
    const page = await context.newPage();
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/login/);
    const login = await request.get("/login");
    expect(login.status()).toBe(200);
  } finally {
    await context.close();
  }
});
