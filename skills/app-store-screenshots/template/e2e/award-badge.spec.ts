import { test, expect, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import sharp from "sharp";

const devices = ["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"];
function fixture(device = "iphone") {
  return { version: 1, activeId: "badge-qa", order: ["badge-qa"], projects: { "badge-qa": {
    id: "badge-qa", name: "Badge QA", updatedAt: 1, schemaVersion: 4,
    appName: "Badge QA", themeId: "clean-light", connectedCanvas: true,
    locale: "en", locales: ["en", "de"], device, orientation: "portrait",
    slidesByDevice: Object.fromEntries(devices.map((d) => [d, [{
      id: `badge-${d}`, layout: d === "feature-graphic" ? "feature-graphic" : "no-device",
      label: { en: "" }, headline: { en: "" }, screenshot: "", backgroundStyle: "plain",
    }]])),
  } } };
}
async function project(request: APIRequestContext) {
  return (await (await request.get("/api/project")).json()).state.projects["badge-qa"];
}
test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/project", { data: fixture() })).ok()).toBe(true);
});

test("award badge edits, duplicates, reloads and renders into exported PNGs", async ({ page, request }, info) => {
  await page.goto("/editor");
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await page.getByRole("button", { name: "Add award badge", exact: true }).click();
  await page.getByLabel("Year or caption", { exact: true }).fill("2024");
  await page.getByLabel("Award title", { exact: true }).fill("App Store");
  await page.getByLabel("Stars (0–5)", { exact: true }).fill("4");
  await page.getByLabel("Laurel & star color", { exact: true }).fill("#e600a9");
  await page.getByLabel("Badge text color", { exact: true }).fill("#111111");
  await page.getByLabel("Badge width (px)", { exact: true }).fill("800");
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.[0]?.badge.title.en).toBe("App Store");
  await page.getByRole("button", { name: "Duplicate badge", exact: true }).click();
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.length).toBe(2);
  await page.getByLabel("Award title", { exact: true }).fill("Copy only");
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.[1]?.badge.title.en).toBe("Copy only");
  expect((await project(request)).slidesByDevice.iphone[0].decorations[0].badge.title.en).toBe("App Store");
  await page.getByRole("button", { name: "Delete badge", exact: true }).click();
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations.length).toBe(1);
  await page.reload();
  const badge = page.locator('.rnd-editable [data-award-badge="true"]').first();
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("App Store");
  await page.screenshot({ path: info.outputPath("badge-desktop.png") });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export bundle", exact: true }).click();
  const target = info.outputPath("badge.zip");
  await (await download).saveAs(target);
  const zip = await JSZip.loadAsync(await readFile(target));
  const files = Object.values(zip.files).filter((file) => file.name.endsWith(".png"));
  expect(files.length).toBeGreaterThanOrEqual(4);
  for (const file of files) {
    const png = await file.async("nodebuffer");
    const pixels = await sharp(png).resize(200, 400, { fit: "fill" }).removeAlpha().raw().toBuffer();
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 3) if (pixels[i] > 180 && pixels[i + 1] < 55 && pixels[i + 2] > 120) colored++;
    expect(colored, file.name).toBeGreaterThan(80);
  }
});

test("prebuilt badge styles insert finished artwork and preserve edited copy when restyled", async ({ page, request }, info) => {
  await page.goto("/editor");
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await page.getByRole("button", { name: "Award badge — White", exact: true }).click();
  await expect(page.getByLabel("Award title", { exact: true })).toHaveValue("App Store");
  const canvasBadge = page.locator('.rnd-editable [data-award-badge="true"]').first();
  await expect(canvasBadge).toBeVisible();
  expect(await canvasBadge.evaluate(e => getComputedStyle(e.parentElement!).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await page.getByLabel("Award title", { exact: true }).fill("Editors’ Choice");
  await page.getByLabel("Year or caption", { exact: true }).fill("2024");
  await page.getByRole("button", { name: "Award badge — Gold", exact: true }).click();
  await expect(page.getByLabel("Award title", { exact: true })).toHaveValue("Editors’ Choice");
  await expect(page.getByLabel("Year or caption", { exact: true })).toHaveValue("2024");
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.[0]?.badge.textColor).toBe("#F4CE78");
  await page.reload();
  await expect(canvasBadge).toContainText("Editors’ Choice");
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add award badge", exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/badge\.(add|name|hint|eyebrow)/);
  await page.screenshot({ path: info.outputPath("prebuilt-badge-styles.png") });
});

test("badge controls fit mobile and support empty caption, zero stars and Undo", async ({ page, request }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/editor");
  await page.getByRole("button", { name: "Show screen settings" }).click();
  await page.getByRole("button", { name: "Add award badge", exact: true }).click();
  await page.getByLabel("Year or caption", { exact: true }).fill("");
  await page.getByLabel("Award title", { exact: true }).fill("A very long award title that should still fit inside the laurels");
  await page.getByLabel("Stars (0–5)", { exact: true }).fill("0");
  await page.getByLabel("Show laurels", { exact: true }).uncheck();
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.[0]?.badge.stars).toBe(0);
  await page.screenshot({ path: info.outputPath("badge-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Delete badge", exact: true }).click();
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.length ?? 0).toBe(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.length).toBe(1);
});

test("award badges are available on Play Store feature graphics", async ({ page, request }) => {
  await request.post("/api/project", { data: fixture("feature-graphic") });
  await page.goto("/editor");
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await page.getByRole("button", { name: "Add award badge", exact: true }).click();
  await expect.poll(async () => (await project(request)).slidesByDevice["feature-graphic"][0].decorations?.[0]?.kind).toBe("award-badge");
  await expect(page.locator('.rnd-editable [data-award-badge="true"]').first()).toBeVisible();
});

test("badge copy is localized and the canvas supports dragging and proportional resizing", async ({ page, request }) => {
  await page.goto("/editor");
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await page.getByRole("button", { name: "Add award badge", exact: true }).click();
  await page.getByLabel("Award title", { exact: true }).fill("App of the day");
  await page.getByRole("combobox").filter({ hasText: /^EN$/ }).click();
  await page.getByRole("option", { name: "DE", exact: true }).click();
  await page.getByLabel("Award title", { exact: true }).fill("App des Tages");
  await page.getByLabel("Year or caption", { exact: true }).fill("");
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations?.[0]?.badge.title.de).toBe("App des Tages");
  await page.getByRole("button", { name: "Hide screen settings" }).click();
  const chat = page.getByRole("button", { name: "Hide design chat" });
  if (await chat.isVisible()) await chat.click();
  const svg = page.locator('.rnd-editable [data-award-badge="true"]').first();
  const box = (await svg.boundingBox())!;
  const initial = (await project(request)).slidesByDevice.iphone[0].decorations[0].transform;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations[0].transform.x).toBeGreaterThan(initial.x + 10);
  const moved = (await svg.boundingBox())!;
  await page.mouse.move(moved.x + moved.width, moved.y + moved.height);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width + 25, moved.y + moved.height + 12.5, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await project(request)).slidesByDevice.iphone[0].decorations[0].transform.width).toBeGreaterThan(initial.width + 10);
  const saved = (await project(request)).slidesByDevice.iphone[0].decorations[0];
  expect(saved.transform.width / saved.transform.height).toBeCloseTo(2, 1);
  expect(saved.badge.title).toEqual({ en: "App of the day", de: "App des Tages" });
  expect(saved.badge.eyebrow.de).toBe("");
  await page.reload();
  await expect(svg).toContainText("App des Tages");
});
