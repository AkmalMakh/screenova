import { test, expect, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";

test.use({ hasTouch: true });

const devices = ["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"];
function fixture(two = false) {
  return { version: 1, activeId: "phone-qa", order: ["phone-qa"], projects: { "phone-qa": {
    id: "phone-qa", name: "Phone selection QA", updatedAt: 1, schemaVersion: 4,
    appName: "Phone QA", themeId: "clean-light", connectedCanvas: true,
    locale: "en", locales: ["en"], device: "iphone", orientation: "portrait",
    slidesByDevice: Object.fromEntries(devices.map(device => [device, [{
      id: `phone-${device}`, layout: two ? "two-devices" : "hero", label: { en: "" }, headline: { en: "Select a phone" },
      screenshot: "", screenshotSecondary: "", transforms: {
        device: { x: two ? 100 : 460, y: 800, width: 400, height: 850 },
        ...(two ? { deviceSecondary: { x: 800, y: 800, width: 400, height: 850 } } : {}),
      },
    }]])),
  } } };
}
async function slide(request: APIRequestContext) {
  return (await (await request.get("/api/project")).json()).state.projects["phone-qa"].slidesByDevice.iphone[0];
}
test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/project", { data: fixture() })).ok()).toBe(true);
});

test("duplicated localized project keeps original images and Undo bytes unchanged", async ({ page, request }) => {
  const colors = { en: "#42b883", de: "#2244dd" };
  const pattern = `/screenshots/localized/{locale}/qa-original-${crypto.randomUUID()}.png`;
  const originals: Record<string, Buffer> = {};
  for (const [locale, color] of Object.entries(colors)) {
    const bytes = await sharp({ create: { width: 240, height: 520, channels: 3, background: color } }).png().toBuffer();
    originals[locale] = bytes;
    expect((await request.post("/api/upload", { data: { targetPath: pattern.replace("{locale}", locale), dataUrl: `data:image/png;base64,${bytes.toString("base64")}` } })).ok()).toBe(true);
  }
  const data = fixture();
  data.projects["phone-qa"].locales = ["en", "de"];
  data.projects["phone-qa"].slidesByDevice.iphone[0].screenshot = pattern;
  await request.post("/api/project", { data });
  await page.goto("/editor");
  await page.getByRole("button", { name: "Phone selection QA", exact: true }).click();
  await page.getByRole("menuitem", { name: "Manage projects…", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Duplicate Phone selection QA", exact: true }).click();
  await page.keyboard.press("Escape");
  // Manual-first editor: the design chat is not open by default.
  await expect(page.getByRole("button", { name: "Hide design chat", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Primary Screenshot", exact: true }).click();
  const replacement = await sharp({ create: { width: 240, height: 520, channels: 3, background: "#dd2244" } }).png().toBuffer();
  await page.locator('[data-screenshot-control="device"] input[type="file"]').setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: replacement });
  const saved = async () => (await (await request.get("/api/project")).json()).state;
  await expect.poll(async () => {
    const state = await saved();
    return state.projects[state.activeId].slidesByDevice.iphone[0].screenshot;
  }).not.toBe(pattern);
  const state = await saved();
  const copiedPath = state.projects[state.activeId].slidesByDevice.iphone[0].screenshot;
  expect(state.activeId).not.toBe("phone-qa");
  expect(state.projects["phone-qa"].slidesByDevice.iphone[0].screenshot).toBe(pattern);
  for (const locale of ["en", "de"]) {
    expect(await (await request.get(pattern.replace("{locale}", locale))).body()).toEqual(originals[locale]);
  }
  expect(await (await request.get(copiedPath.replace("{locale}", "en"))).body()).toEqual(replacement);
  expect(await (await request.get(copiedPath.replace("{locale}", "de"))).body()).toEqual(originals.de);
  await page.getByRole("button", { name: "Primary Screenshot", exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => { const s = await saved(); return s.projects[s.activeId].slidesByDevice.iphone[0].screenshot; }).toBe(pattern);
  await page.reload();
  expect(await (await request.get(pattern.replace("{locale}", "en"))).body()).toEqual(originals.en);
});

test("clicking a phone selects it, reveals its picker, and replaces the saved image", async ({ page, request }, info) => {
  await page.goto("/editor");
  // Manual-first editor: the design chat is not open by default.
  await expect(page.getByRole("button", { name: "Hide design chat", exact: true })).toHaveCount(0);
  const phone = page.getByRole("button", { name: "Primary Screenshot", exact: true });
  await phone.click();
  await expect(phone).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Hide screen settings", exact: true })).toBeVisible();
  const picker = page.locator('[data-screenshot-control="device"]');
  expect(await picker.evaluate(e => e.parentElement?.firstElementChild === e)).toBe(true);
  const chooser = page.waitForEvent("filechooser");
  await picker.getByRole("button", { name: "Pick", exact: true }).click();
  const pixels = await sharp({ create: { width: 240, height: 520, channels: 3, background: "#42b883" } }).png().toBuffer();
  await (await chooser).setFiles({ name: "replacement.png", mimeType: "image/png", buffer: pixels });
  await expect.poll(async () => (await slide(request)).screenshot).toMatch(/^\/screenshots\/uploaded\//);
  await expect(phone.locator("img").first()).toHaveAttribute("src", /^(data:image|\/screenshots\/uploaded)/);
  await page.screenshot({ path: info.outputPath("phone-image-selected.png") });
  await page.reload();
  await phone.click();
  await expect(picker.getByRole("button", { name: "Clear screenshot" })).toBeVisible();
  const initial = (await slide(request)).transforms.device;
  const box = (await phone.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await slide(request)).transforms.device.x).toBeGreaterThan(initial.x + 10);
  const moved = (await phone.boundingBox())!;
  await page.mouse.move(moved.x + moved.width, moved.y + moved.height);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width + 15, moved.y + moved.height + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await slide(request)).transforms.device.width).toBeGreaterThan(initial.width + 10);
});

test("two-phone layouts update only the clicked phone and keyboard selection works", async ({ page, request }) => {
  await request.post("/api/project", { data: fixture(true) });
  await page.goto("/editor");
  // Manual-first editor: the design chat is not open by default.
  await expect(page.getByRole("button", { name: "Hide design chat", exact: true })).toHaveCount(0);
  const back = page.getByRole("button", { name: "Secondary (back layer) Screenshot", exact: true });
  await back.click();
  await expect(back).toHaveAttribute("aria-pressed", "true");
  const picker = page.locator('[data-screenshot-control="deviceSecondary"]');
  expect(await picker.evaluate(e => e.parentElement?.firstElementChild === e)).toBe(true);
  const png = await sharp({ create: { width: 240, height: 520, channels: 3, background: "#e25a40" } }).png().toBuffer();
  await picker.locator('input[type="file"]').setInputFiles({ name: "back.png", mimeType: "image/png", buffer: png });
  await expect.poll(async () => (await slide(request)).screenshotSecondary).toMatch(/^\/screenshots\/uploaded\//);
  expect((await slide(request)).screenshot).toBe("");
  const front = page.getByRole("button", { name: "Primary Screenshot", exact: true });
  await front.focus();
  await front.press("Enter");
  await expect(front).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator('[data-screenshot-control="device"]').evaluate(e => e.parentElement?.firstElementChild === e)).toBe(true);
  await back.focus();
  await back.press("Space");
  await expect(back).toHaveAttribute("aria-pressed", "true");
});

test("phone tap opens a usable mobile picker without overlapping panels", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/editor");
  await page.getByRole("button", { name: "Primary Screenshot", exact: true }).tap();
  const picker = page.locator('[data-screenshot-control="device"]');
  await expect(picker.getByRole("button", { name: "Pick", exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Hide screens", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hide design chat", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Design with AI", exact: true })).toBeHidden();
  expect(await picker.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("phone-image-mobile.png") });
});

test("clicking a phone on another screen targets that screen's image", async ({ page, request }) => {
  const data = fixture();
  const deck = data.projects["phone-qa"].slidesByDevice.iphone;
  deck.push({ ...structuredClone(deck[0]), id: "phone-second" });
  await request.post("/api/project", { data });
  await page.goto("/editor");
  // Manual-first editor: the design chat is not open by default.
  await expect(page.getByRole("button", { name: "Hide design chat", exact: true })).toHaveCount(0);
  const secondPhone = page.getByRole("button", { name: "Primary Screenshot", exact: true }).nth(1);
  await secondPhone.click();
  await expect(secondPhone).toHaveAttribute("aria-pressed", "true");
  const png = await sharp({ create: { width: 240, height: 520, channels: 3, background: "#006fe6" } }).png().toBuffer();
  await page.locator('[data-screenshot-control="device"] input[type="file"]').setInputFiles({ name: "second.png", mimeType: "image/png", buffer: png });
  await expect.poll(async () => {
    const state = (await (await request.get("/api/project")).json()).state;
    return state.projects["phone-qa"].slidesByDevice.iphone[1].screenshot;
  }).toMatch(/^\/screenshots\/uploaded\//);
  expect((await slide(request)).screenshot).toBe("");
});
