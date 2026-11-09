import { test, expect, type Page, type APIRequestContext, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import sharp from "sharp";

const devices = ["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"];

function fixture() {
  return {
    version: 1, activeId: "qa", order: ["qa"],
    projects: {
      qa: {
        id: "qa", name: "QA campaign", updatedAt: 1, schemaVersion: 4,
        appName: "QA App", appIcon: "", themeId: "clean-light", connectedCanvas: true,
        locale: "en", locales: ["en"], device: "iphone", orientation: "portrait",
        slidesByDevice: Object.fromEntries(devices.map((device) => [device, [{
          id: `screen-${device}`, layout: device === "feature-graphic" ? "feature-graphic" : "device-bottom",
          label: { en: "WELCOME" }, headline: { en: "Your day, organized" }, screenshot: "",
        }]])),
      },
    },
  };
}

async function activeProject(request: APIRequestContext) {
  const json = await (await request.get("/api/project")).json();
  return json.state.projects[json.state.activeId];
}

async function openEditor(page: Page) {
  await page.goto("/editor");
  await expect(page.getByRole("textbox", { name: "App name", exact: true })).toHaveValue("QA App");
}

// The first draft streams one JSON event per line; a mock sends them all at once.
type MockDeck = { appName: string; themeId: string; summary: string; customTheme?: Record<string, string>; slides: Array<Record<string, unknown>> };
function draftStream(deck: MockDeck) {
  return [
    { type: "start", count: deck.slides.length },
    { type: "theme", appName: deck.appName, themeId: deck.themeId, ...(deck.customTheme ? { customTheme: deck.customTheme } : {}) },
    ...deck.slides.map((slide, index) => ({ type: "slide", index, slide })),
    { type: "done", deck },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}
function fulfillDraft(route: Route, deck: MockDeck) {
  return route.fulfill({ body: draftStream(deck), contentType: "application/x-ndjson" });
}

test.beforeEach(async ({ page, request }) => {
  expect((await request.post("/api/project", { data: fixture() })).ok()).toBe(true);
  // Third-party marketing fonts should not affect editor tests or exports.
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ body: "", contentType: "text/css" }));
});

test("workspace appearance persists across routes without changing artwork and fits phones", async ({ page, request }, testInfo) => {
  await page.goto("/studio");
  await expect(page.locator("html")).not.toHaveClass(/screenova-dark/);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  for (const route of ["/studio", "/editor"]) {
    await page.goto(route);
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/screenova-dark/);
    await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-dark.png`) });
  }
  expect((await activeProject(request)).themeId).toBe("clean-light");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/studio", "/editor"]) {
    await page.goto(route);
    // The landing is always dark and has no appearance toggle.
    if (route !== "/") await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/screenova-dark/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (route === "/editor") {
      const exportButton = page.getByRole("button", { name: "Export bundle", exact: true });
      const bounds = await exportButton.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    }
    await page.screenshot({ path: testInfo.outputPath(`${route.slice(1) || "landing"}-mobile.png`) });
  }
  expect((await activeProject(request)).themeId).toBe("clean-light");
});

test("landing AI opens the real composer with the supplied prompt", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("What app shall we make screenshots for?").fill("A calm calendar app for busy parents");
  await page.getByRole("group", { name: "Device" }).getByRole("button", { name: "iPad", exact: true }).click();
  await page.getByRole("button", { name: "Design with AI", exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByPlaceholder(/Describe your app/)).toHaveValue("A calm calendar app for busy parents");
  await expect(page.getByRole("group", { name: "Device" }).getByRole("button", { name: "iPad", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("pasted description links auto-attach and Send waits for App Store screenshots", async ({ page, context }) => {
  const appleUrl = "https://apps.apple.com/us/app/calendar/id123456789";
  const description = `Design a calm calendar like (${appleUrl}), with colors from www.example.com/design.`;
  let releaseLookup = () => {};
  const gate = new Promise<void>((resolve) => { releaseLookup = resolve; });
  let lookups = 0;
  await page.route("**/api/app-store/lookup", async (route) => {
    expect(route.request().postDataJSON().url).toBe(appleUrl);
    lookups += 1;
    await gate;
    await route.fulfill({ json: { ok: true, app: {
      trackName: "Reference Calendar", artworkUrl100: "",
      screenshotUrls: ["https://is1-ssl.mzstatic.com/image/test.png"], ipadScreenshotUrls: [],
    } } });
  });
  let suggestion: Record<string, any> | undefined;
  await page.route("**/api/design/suggest-deck", (route) => {
    suggestion = route.request().postDataJSON();
    return fulfillDraft(route, {
      appName: "My calendar", themeId: "clean-light", summary: "Reference draft ready",
      slides: [{ layout: "hero", copy: { en: { label: "PLAN", headline: "A calmer day" } } }],
    });
  });
  await page.goto("/studio");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((text) => navigator.clipboard.writeText(text), description);
  const composer = page.getByPlaceholder(/Describe your app/);
  await composer.focus();
  await page.keyboard.press("ControlOrMeta+v");
  await expect(composer).toHaveValue(description);
  await expect(page.getByRole("button", { name: "Remove reference apps.apple.com", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove reference example.com", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(composer).toBeDisabled();
  expect(suggestion).toBeUndefined();
  releaseLookup();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByText("Reference draft ready", { exact: true }).first()).toBeVisible();
  expect(lookups).toBe(1);
  expect(suggestion!.stream).toBe(true);
  expect(suggestion!.messages[0].text).toBe(description);
  expect(suggestion!.styleReferences).toEqual([
    { name: "Reference Calendar", url: appleUrl, screenshotUrls: ["https://is1-ssl.mzstatic.com/image/test.png"] },
    { name: "example.com", url: "https://www.example.com/design" },
  ]);
});

test("typed links deduplicate and removing a chip prevents automatic reattachment", async ({ page }) => {
  await page.goto("/studio");
  const composer = page.getByPlaceholder(/Describe your app/);
  await composer.fill("Use https://example.com/design");
  await expect(page.getByRole("button", { name: "Remove reference example.com", exact: true })).toHaveCount(0);
  await composer.press("Space");
  await expect(page.getByRole("button", { name: "Remove reference example.com", exact: true })).toBeVisible();
  await composer.fill("Use https://example.com/design and https://example.com/design again ");
  await expect(page.getByRole("button", { name: "Remove reference example.com", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Remove reference example.com", exact: true }).click();
  await composer.fill("Use https://example.com/design but ignore this reference ");
  await composer.blur();
  await expect(page.getByRole("button", { name: "Remove reference example.com", exact: true })).toHaveCount(0);
  await composer.fill("Start over ");
  await composer.fill("Use https://example.com/design again ");
  await expect(page.getByRole("button", { name: "Remove reference example.com", exact: true })).toHaveCount(1);
});

test("automatic references respect the limit and manual duplicates remain harmless", async ({ page, context }) => {
  await page.goto("/studio");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => navigator.clipboard.writeText("Use https://one.test/a https://two.test/b https://three.test/c https://four.test/d"));
  const composer = page.getByPlaceholder(/Describe your app/);
  await composer.focus();
  await page.keyboard.press("ControlOrMeta+v");
  await expect(page.getByRole("button", { name: /^Remove reference / })).toHaveCount(3);
  await expect(page.getByText("Add at most 3 reference links.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add reference links", exact: true }).click();
  await page.getByRole("textbox", { name: "Add reference links", exact: true }).fill("https://one.test/a");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Remove reference / })).toHaveCount(3);
  await expect(page.getByRole("textbox", { name: "Add reference links", exact: true })).toHaveValue("");
  await expect(page.getByText("Add at most 3 reference links.", { exact: true })).toHaveCount(0);
});

test("create a multilingual project and persist it through navigation", async ({ page, request }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "QA campaign", exact: true }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill("Launch campaign");
  await page.getByRole("button", { name: "Deutsch", exact: true }).click();
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Launch campaign", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "App name", exact: true }).fill("My launch app");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await page.getByRole("navigation", { name: "Recent projects" }).getByRole("button", { name: /Launch campaign/ }).click();
  await expect(page.getByRole("textbox", { name: "App name", exact: true })).toHaveValue("My launch app");
  await expect.poll(async () => (await activeProject(request)).locales).toEqual(["en", "de"]);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "App name", exact: true })).toHaveValue("My launch app");
});

test("edits survive an immediate refresh before the autosave debounce", async ({ page, request }) => {
  await openEditor(page);
  await page.getByRole("textbox", { name: "App name", exact: true }).fill("Refreshed campaign");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "App name", exact: true })).toHaveValue("Refreshed campaign");
  await expect.poll(async () => (await activeProject(request)).appName).toBe("Refreshed campaign");
});

test("edit copy, duplicate, delete, undo and switch device decks", async ({ page, request }) => {
  await openEditor(page);
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Everything in one calm place");
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Everything in one calm place");
  await expect(page.getByRole("button", { name: "Hide screens", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate screen 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete screen 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete screen 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete screen 2", exact: true })).toHaveCount(0);
  await page.locator("body").click({ position: { x: 100, y: 100 } });
  await page.keyboard.press("Meta+z");
  await expect(page.getByRole("button", { name: "Delete screen 2", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Android", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Headline", exact: true })).toHaveValue("Your day, organized");
  await page.getByRole("tab", { name: "iOS", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Headline", exact: true })).toHaveValue("Everything in one calm place");
});

test("escaped newline copy is cleaned on load, typing and AI Apply", async ({ page, request }) => {
  const bundle = fixture();
  bundle.projects.qa.slidesByDevice.iphone[0].headline.en = String.raw`Notice the days\\nthat shape you`;
  await request.post("/api/project", { data: bundle });
  await openEditor(page);
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  const headline = page.getByRole("textbox", { name: "Headline", exact: true });
  await expect(headline).toHaveValue("Notice the days that shape you");
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Notice the days that shape you");
  await headline.fill(String.raw`Make habits\nfeel lighter`);
  await expect(headline).toHaveValue("Make habits feel lighter");
  await page.route("**/api/design", (route) => route.fulfill({ json: { ok: true, proposal: {
    summary: "Clean copy", targetSlideIds: ["screen-iphone"],
    slidePatches: [{ slideId: "screen-iphone", headline: { en: String.raw`Keep your rhythm\nin reach` } }],
  }, generatedVisualAssets: [] } }));
  await page.getByRole("textbox", { name: /Redesign screens/ }).fill("Improve the headline");
  await page.getByRole("button", { name: "Generate redesign" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(headline).toHaveValue("Keep your rhythm in reach");
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Keep your rhythm in reach");
  await page.reload();
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await expect(headline).toHaveValue("Keep your rhythm in reach");
});

test("upload a fresh image in production and export correctly sized PNGs", async ({ page, request }, testInfo) => {
  await openEditor(page);
  // Manual-first editor (DESIGN.md): the inspector is open by default on desktop.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  const pixels = await sharp({ create: { width: 240, height: 520, channels: 3, background: "#E45137" } }).png().toBuffer();
  await page.locator('input[type="file"][aria-label]').setInputFiles({ name: "qa-screen.png", mimeType: "image/png", buffer: pixels });
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].screenshot).toMatch(/^\/screenshots\/uploaded\//);
  const assetPath = (await activeProject(request)).slidesByDevice.iphone[0].screenshot;
  expect((await request.get(assetPath)).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export bundle" }).click();
  await expect(page.getByRole("button", { name: /^Exporting/ })).toBeDisabled();
  const download = await downloaded;
  const target = testInfo.outputPath("screenshots.zip");
  await download.saveAs(target);
  const zip = await JSZip.loadAsync(await readFile(target));
  const pngs = Object.values(zip.files).filter((file) => file.name.endsWith(".png"));
  expect(pngs).toHaveLength(4);
  for (const file of pngs) {
    const png = await file.async("nodebuffer");
    const [, width, height] = file.name.match(/\/(\d+)x(\d+)\//)!;
    const metadata = await sharp(png).metadata();
    expect([metadata.width, metadata.height, metadata.format]).toEqual([Number(width), Number(height), "png"]);
    expect(png.byteLength).toBeGreaterThan(10_000);
    const pixels = await sharp(png).resize(100, 100).removeAlpha().raw().toBuffer();
    let screenshotPixels = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      if (Math.abs(pixels[i] - 228) < 10 && Math.abs(pixels[i + 1] - 81) < 10 && Math.abs(pixels[i + 2] - 55) < 10) screenshotPixels += 1;
    }
    expect(screenshotPixels).toBeGreaterThan(100); // The uploaded image is actually rendered, not a black placeholder.
  }
  await page.screenshot({ path: testInfo.outputPath("exported-editor.png") });
});

test("Match reference restyles the current screen from an attached image", async ({ page, request }) => {
  await openEditor(page);
  const screenshotBefore = (await activeProject(request)).slidesByDevice.iphone[0].screenshot;
  const fill = { angle: 180, stops: [{ color: "#ffffff", position: 0 }, { color: "#f6c9e4", position: 100 }] };
  const headlineStyle = { fontSize: 112, fontWeight: 800, lineHeight: 1.1, align: "left" };
  let sent: { prompt: string; references: { name: string; dataUrl: string }[]; scope: { slideIds: string[] } } | undefined;
  await page.route("**/api/design", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, proposal: {
      summary: "Matched the reference", targetSlideIds: ["screen-iphone"],
      slidePatches: [{ slideId: "screen-iphone", backgroundFill: fill, frameStyle: "white", headlineStyle, decorations: [] }],
    }, generatedVisualAssets: [] } });
  });
  const match = page.getByRole("button", { name: "Match reference", exact: true });
  await expect(match).toHaveCount(0);
  const reference = await sharp({ create: { width: 120, height: 260, channels: 3, background: "#F6C9E4" } }).png().toBuffer();
  await page.locator("input[data-design-attachments]").setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: reference });
  await page.getByRole("textbox", { name: /Redesign screens/ }).fill("Make it feel calm");
  await match.click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect(sent?.prompt).toMatch(/^Redesign the target screen to match the attached reference/);
  expect(sent?.prompt).toMatch(/Make it feel calm$/);
  expect(sent?.references.map((item) => item.name)).toEqual(["reference.png"]);
  expect(sent?.scope.slideIds).toEqual(["screen-iphone"]);
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0]).toMatchObject({ backgroundFill: fill, frameStyle: "white", headlineStyle });
  expect((await activeProject(request)).slidesByDevice.iphone[0].screenshot).toBe(screenshotBefore);
});

test("Inspiration button attaches a style reference that sends without typing", async ({ page }) => {
  await openEditor(page);
  let sent: { prompt: string; references: { name: string; purpose?: string }[] } | undefined;
  await page.route("**/api/design", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, proposal: {
      summary: "Matched", targetSlideIds: ["screen-iphone"],
      slidePatches: [{ slideId: "screen-iphone", frameStyle: "white" }],
    }, generatedVisualAssets: [] } });
  });
  const image = await sharp({ create: { width: 120, height: 260, channels: 3, background: "#C9E4F6" } }).png().toBuffer();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add an inspiration image to restyle the target screen like it" }).click();
  await (await chooser).setFiles({ name: "look.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("img", { name: "Inspiration", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate redesign" }).click();
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible();
  expect(sent?.references).toEqual([expect.objectContaining({ name: "look.png", purpose: "inspiration" })]);
  expect(sent?.prompt).toMatch(/^Redesign the target screen to match the attached reference/);
});

test("AI preview disables export, supports discard and applies one undoable edit", async ({ page, request }) => {
  await openEditor(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/design", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.renderedPreviews[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    await gate;
    await route.fulfill({ json: { ok: true, proposal: {
      summary: "Refined hierarchy", targetSlideIds: ["screen-iphone"],
      slidePatches: [{ slideId: "screen-iphone", headline: { en: "Designed for your day" } }],
    }, generatedVisualAssets: [] } });
  });
  const prompt = page.getByRole("textbox", { name: /Redesign screens/ });
  await prompt.fill("Make the headline more focused");
  await page.getByRole("button", { name: "Generate redesign" }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeDisabled();
  release();
  await expect(page.getByRole("button", { name: "Discard redesign" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeDisabled();
  await page.getByRole("button", { name: "Discard redesign" }).click();
  expect((await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Your day, organized");
  await prompt.fill("Try again with a stronger headline");
  await page.getByRole("button", { name: "Generate redesign" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Designed for your day");
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled();
  await prompt.blur();
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Your day, organized");
});

test("failed hydration never overwrites projects on navigation", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/project", (route) => {
    if (route.request().method() === "POST") writes += 1;
    return route.fulfill({ status: 500, json: { ok: false, error: "Unavailable" } });
  });
  await page.goto("/editor");
  await expect(page.getByRole("textbox", { name: "App name", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "App name", exact: true }).fill("Offline edit");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  expect(writes).toBe(0);
});

test("a failed first draft keeps the new project's screenshot and can be retried", async ({ page, request }) => {
  await openEditor(page);
  let attempts = 0;
  await page.route("**/api/design/suggest-deck", (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { ok: false, error: "AI unavailable" } })
      : fulfillDraft(route, { appName: "Failed import", themeId: "dark-bold", summary: "Recovered draft",
          slides: [{ layout: "device-bottom", copy: { en: { label: "PLAN", headline: "A calmer day" } } }] });
  });
  await page.getByRole("button", { name: "QA campaign", exact: true }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill("Failed import");
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles("public/before-after/raw-calendar.webp");
  await page.getByRole("button", { name: /Create project & draft/ }).click();
  await expect(page.getByText("AI unavailable", { exact: true })).toBeVisible();
  // The screenshot is already in the new project; the earlier project is untouched.
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].screenshot).toMatch(/^\/screenshots\/uploaded\//);
  const workspace = (await (await request.get("/api/project")).json()).state;
  expect(workspace.projects.qa.appName).toBe("QA App");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("A calmer day");
  expect(attempts).toBe(2);
});

test("API rejects malformed images, projects and design requests", async ({ request }) => {
  expect((await request.post("/api/project", { data: null })).status()).toBe(400);
  expect((await request.post("/api/upload", { data: { dataUrl: "data:image/png;base64,aGVsbG8=" } })).status()).toBe(400);
  const malformed = { prompt: "Design this", project: fixture().projects.qa,
    scope: { type: "current", slideIds: ["screen-iphone"] }, references: [null],
    renderedPreviews: [{ slideId: "screen-iphone", dataUrl: "data:image/png;base64,aGVsbG8=" }],
  };
  const response = await request.post("/api/design", { data: malformed });
  expect([400, 503]).toContain(response.status());
});

test("Send opens the editor at once and fills in the streamed draft in every chosen language", async ({ page, request }) => {
  const calls: Array<{ screenshots: Array<{ name: string; path: string }>; locales: string[]; stream: boolean }> = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/design/suggest-deck", async (route) => {
    calls.push(route.request().postDataJSON());
    await gate;
    return fulfillDraft(route, {
      appName: "Calendar launch", themeId: "dark-bold", summary: "Draft ready",
      slides: [{ layout: "device-bottom", copy: { en: { label: "PLAN", headline: "A calmer day" }, de: { label: "PLAN", headline: "Ein ruhigerer Tag" } } }],
    });
  });
  await page.goto("/studio");
  await page.locator('input[type="file"]').setInputFiles("public/before-after/raw-calendar.webp");
  await page.getByRole("button", { name: "Languages", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Deutsch", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByPlaceholder(/Describe your app/).fill("Create a calendar launch campaign");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // The editor is open, with the uploaded screenshot, before the draft returns.
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByText("Claude is planning your deck…", { exact: true })).toBeVisible();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toMatchObject({ locales: ["en", "de"], stream: true });
  expect(calls[0].screenshots).toHaveLength(1);
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].screenshot).toBe(calls[0].screenshots[0].path);
  release();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline).toEqual({ en: "A calmer day", de: "Ein ruhigerer Tag" });
  const project = await activeProject(request);
  expect(project.themeId).toBe("dark-bold");
  expect(project.name).toBe("Calendar launch");
  expect(project.locales).toEqual(["en", "de"]);
});

test("localized JPEG replacement is served as genuine PNG", async ({ request }) => {
  const jpeg = await sharp({ create: { width: 120, height: 260, channels: 3, background: "#3456AB" } }).jpeg().toBuffer();
  const targetPath = `/screenshots/localized/qa-${Date.now()}/de/screen.png`;
  const response = await request.post("/api/upload", { data: {
    dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`, targetPath,
  } });
  expect(response.status()).toBe(200);
  const asset = await request.get(targetPath);
  expect(asset.headers()["content-type"]).toBe("image/png");
  expect((await sharp(await asset.body()).metadata()).format).toBe("png");
});

test("App Store import opens the editor on the imported screenshots and can retry a failed draft", async ({ page, request }) => {
  const app = { appId: "123456789", country: "us", trackName: "Imported calendar", sellerName: "QA Studio",
    primaryGenreName: "Productivity", averageUserRating: 4.8, userRatingCount: 10, version: "1.0",
    trackViewUrl: "https://apps.apple.com/us/app/id123456789", artworkUrl100: "", artworkUrl512: "",
    screenshotUrls: ["https://example.test/screenshot.png"], ipadScreenshotUrls: [],
  };
  const image = await readFile("public/before-after/raw-calendar.webp");
  const upload = await (await request.post("/api/upload", { data: { dataUrl: `data:image/webp;base64,${image.toString("base64")}` } })).json();
  await page.route("**/api/app-store/lookup", (route) => route.fulfill({ json: { ok: true, app } }));
  await page.route("**/api/app-store/import", (route) => route.fulfill({ json: {
    ok: true, app, iconPath: "", screenshots: [{ name: "Calendar", path: upload.path }],
  } }));
  let attempts = 0;
  await page.route("**/api/design/suggest-deck", (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { ok: false, error: "Temporary AI failure" } })
      : fulfillDraft(route, { appName: "Imported calendar", themeId: "clean-light", summary: "Imported",
          slides: [{ layout: "device-bottom", copy: { en: { label: "PLAN", headline: "Find your rhythm" } } }] });
  });
  await page.goto("/studio");
  await page.getByRole("button", { name: "Import from App Store", exact: true }).click();
  await page.getByRole("textbox", { name: "App Store link" }).fill(app.trackViewUrl);
  await page.getByRole("button", { name: "Fetch app", exact: true }).click();
  await page.getByRole("button", { name: "Import & draft screens", exact: true }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByText("Temporary AI failure", { exact: true })).toBeVisible();
  await expect.poll(async () => (await activeProject(request)).appName).toBe(app.trackName);
  expect((await activeProject(request)).slidesByDevice.iphone[0].screenshot).toBe(upload.path);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Find your rhythm");
  expect((await activeProject(request)).slidesByDevice.iphone[0].screenshot).toBe(upload.path);
});

test("Studio remains usable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expect(page.getByPlaceholder(/Describe your app/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Blank project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeVisible();
});

for (const [device, orientation, dimensions] of [
  ["ipad", "portrait", [[2064, 2752], [2048, 2732]]],
  ["android", "portrait", [[1080, 1920]]],
  ["android-7", "portrait", [[1200, 1920]]],
  ["android-7", "landscape", [[1920, 1200]]],
  ["android-10", "portrait", [[1600, 2560]]],
  ["android-10", "landscape", [[2560, 1600]]],
  ["feature-graphic", "portrait", [[1024, 500]]],
] as const) {
  test(`export ${device} ${orientation} in both content languages`, async ({ page, request }, testInfo) => {
    const bundle = fixture();
    bundle.projects.qa.device = device;
    bundle.projects.qa.orientation = orientation;
    bundle.projects.qa.locales = ["en", "de"];
    Object.assign(bundle.projects.qa.slidesByDevice[device][0].headline, { de: "Dein Tag, gut geplant." });
    await request.post("/api/project", { data: bundle });
    await openEditor(page);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export bundle" }).click();
    const target = testInfo.outputPath("screenshots.zip");
    await (await downloaded).saveAs(target);
    const zip = await JSZip.loadAsync(await readFile(target));
    const pngs = Object.values(zip.files).filter((file) => file.name.endsWith(".png"));
    expect(pngs).toHaveLength(dimensions.length * 2);
    for (const file of pngs) {
      const metadata = await sharp(await file.async("nodebuffer")).metadata();
      expect(dimensions.some(([width, height]) => width === metadata.width && height === metadata.height)).toBe(true);
    }
    expect(pngs.some((file) => file.name.includes("/de/"))).toBe(true);
    expect(pngs.some((file) => file.name.includes("/en/"))).toBe(true);
    const english = await pngs.find((file) => file.name.includes("/en/"))!.async("nodebuffer");
    const german = await pngs.find((file) => file.name.includes("/de/"))!.async("nodebuffer");
    expect(english.equals(german)).toBe(false);
  });
}

test("live Apple listing and screenshot download", async ({ request }) => {
  test.skip(process.env.RUN_LIVE_SERVICE_TESTS !== "1", "Opt-in: calls Apple over the network.");
  test.setTimeout(180_000);
  const url = "https://apps.apple.com/us/app/google-calendar/id909319292";
  const lookup = await request.post("/api/app-store/lookup", { data: { url }, timeout: 60_000 });
  expect(lookup.status()).toBe(200);
  expect((await lookup.json()).app.trackName).toMatch(/Calendar/i);
  const imported = await request.post("/api/app-store/import", { data: { url, device: "iphone" }, timeout: 150_000 });
  const result = await imported.json();
  expect(imported.status(), JSON.stringify(result)).toBe(200);
  expect(result.screenshots.length).toBeGreaterThan(0);
  const asset = await request.get(result.screenshots[0].path);
  expect(asset.status()).toBe(200);
  expect((await sharp(await asset.body()).metadata()).width).toBeGreaterThan(100);
});

test("live OpenAI drafts, analyzes, redesigns and generates a backdrop", async ({ page, request }) => {
  test.skip(process.env.RUN_LIVE_SERVICE_TESTS !== "1", "Opt-in: uses the server API key and provider credits.");
  test.setTimeout(300_000);
  const bytes = await readFile("public/before-after/raw-calendar.webp");
  const uploaded = await (await request.post("/api/upload", { data: { dataUrl: `data:image/webp;base64,${bytes.toString("base64")}` } })).json();
  const screenshots = [{ name: "Calendar", path: uploaded.path }];
  const analysis = await request.post("/api/design/analyze-screenshots", { data: {
    appName: "Calendar", locales: ["en", "de"], screenshots,
  }, timeout: 180_000 });
  const analyzed = await analysis.json();
  expect(analysis.status(), JSON.stringify(analyzed)).toBe(200);
  expect(analyzed.slides).toHaveLength(1);
  expect(analyzed.slides[0].copy.de.headline.length).toBeGreaterThan(0);
  const draft = await request.post("/api/design/suggest-deck", { data: {
    messages: [{ role: "user", text: "Draft a calm calendar campaign with concise copy, no invented claims." }],
    locales: ["en"], device: "iphone", count: 3, screenshots,
  }, timeout: 180_000 });
  const drafted = await draft.json();
  expect(draft.status(), JSON.stringify(drafted)).toBe(200);
  expect(drafted.deck.slides).toHaveLength(3);
  await openEditor(page);
  const prompt = page.getByRole("textbox", { name: /Redesign screens/ });
  await prompt.fill("For the current screen, make the headline concise and generate one atmospheric blue gradient visual backdrop using the image model. No text or devices inside the generated artwork. Keep the screenshot intact.");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/design"), { timeout: 180_000 });
  await page.getByRole("button", { name: "Generate redesign" }).click();
  const response = await responsePromise;
  const result = await response.json();
  expect(response.status(), JSON.stringify(result)).toBe(200);
  expect(result.generatedVisualAssets).toHaveLength(1);
  const image = await request.get(result.generatedVisualAssets[0].path);
  expect(image.status()).toBe(200);
  expect((await sharp(await image.body()).metadata()).format).toBe("jpeg");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].visualAsset?.src).toBe(result.generatedVisualAssets[0].path);
});

test("project manager duplicates, renames and deletes without changing the original", async ({ page, request }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "QA campaign", exact: true }).click();
  await page.getByRole("menuitem", { name: "Manage projects…", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Duplicate QA campaign", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Rename QA campaign copy", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Rename QA campaign copy", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Rename QA campaign copy", exact: true }).fill("Launch variant");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete Launch variant", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Delete Launch variant", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("button", { name: "QA campaign", exact: true })).toBeVisible();
  await expect.poll(async () => Object.keys((await (await request.get("/api/project")).json()).state.projects)).toEqual(["qa"]);
});

test("canvas pinch keeps the point under the cursor and editing preserves pan", async ({ page }) => {
  await openEditor(page);
  const stage = page.locator('.dot-grid');
  const world = stage.locator(':scope > div > div').first();
  await page.getByRole('button', { name: 'Fit active screen', exact: true }).click();
  await page.waitForTimeout(400);
  const read = () => world.evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.m41, y: m.m42, scale: m.a };
  });
  const before = await read();
  const box = (await stage.boundingBox())!;
  const point = { x: Math.round(box.width * .7), y: Math.round(box.height * .4) };
  await stage.dispatchEvent('wheel', { clientX: box.x + point.x, clientY: box.y + point.y, deltaY: -100, ctrlKey: true });
  await page.waitForTimeout(400);
  const after = await read();
  expect(after.scale).toBeGreaterThan(before.scale);
  expect((point.x - after.x) / after.scale).toBeCloseTo((point.x - before.x) / before.scale, 1);
  expect((point.y - after.y) / after.scale).toBeCloseTo((point.y - before.y) / before.scale, 1);
  await stage.dispatchEvent('wheel', { deltaX: 130, deltaY: 60 });
  const panned = await read();
  await page.getByRole('textbox', { name: 'App name', exact: true }).fill('Renamed without moving');
  await page.waitForTimeout(400);
  expect(await read()).toEqual(panned);
});

test("canvas Space respects controls and resets when the window loses focus", async ({ page }) => {
  await openEditor(page);
  const stage = page.locator('.dot-grid');
  const fit = page.getByRole('button', { name: 'Fit active screen', exact: true });
  await fit.focus();
  await page.keyboard.down('Space');
  await expect(stage).not.toHaveCSS('cursor', 'grab');
  await page.keyboard.up('Space');
  await fit.evaluate((el) => (el as HTMLElement).blur());
  await page.keyboard.down('Space');
  await expect(stage).toHaveCSS('cursor', 'grab');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(stage).not.toHaveCSS('cursor', 'grab');
  await page.keyboard.up('Space');
});

test("mobile project drawer traps focus, closes with Escape and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio');
  const menu = page.getByRole('button', { name: 'Open project menu', exact: true });
  await menu.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
});

test("a streamed suggestion keeps its composition and palette in the editor and after reload", async ({ page, request }) => {
  const palette = { id: "cloud-aura", name: "Cloud & Aura", bg: "#f8f9fa", bgAlt: "#20242a", fg: "#17191c", fgAlt: "#f8f9fa", accent: "#008c70", muted: "#667078" };
  const caption = { x: 110, y: 200, width: 1100, height: 500 };
  const decoration = { id: "aura", kind: "ellipse", transform: { x: 0, y: 1900, width: 1320, height: 900 }, fill: { type: "solid", colors: ["#dfc9ef"] }, opacity: .6, blur: 80 };
  await page.route("**/api/design/suggest-deck", route => fulfillDraft(route, {
    appName: "Habit Journal", themeId: "clean-light", customTheme: palette, summary: "Your journal draft",
    slides: [{ layout: "device-bottom", copy: { en: { label: "YOUR PRACTICE", headline: "Make space for your habits" } }, captionTransform: caption, decorations: [decoration] }],
  }));
  await page.goto('/studio');
  await page.getByPlaceholder(/Describe your app/).fill('An airy habit journal without screenshots');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect.poll(async () => (await activeProject(request)).appName).toBe('Habit Journal');
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone.length).toBe(1);
  const project = await activeProject(request);
  expect(project.connectedCanvas).toBe(false);
  expect(project.slidesByDevice.iphone[0]).toMatchObject({ layout: 'no-device', backgroundStyle: 'plain', transforms: { caption }, decorations: [decoration] });
  expect(project.slidesByDevice.iphone[0].transforms.device).toBeUndefined();
  expect(project.customThemesByDevice.iphone.bg).toBe(palette.bg);
  const stage = page.locator('.dot-grid');
  await expect(stage.getByText('Make space for your habits', { exact: true })).toBeVisible();
  await expect(stage.locator('img')).toHaveCount(0);
  await page.reload();
  await expect(stage.getByText('Make space for your habits', { exact: true })).toBeVisible();
  await expect(stage.locator('img')).toHaveCount(0);
  expect((await activeProject(request)).slidesByDevice.iphone[0].backgroundStyle).toBe('plain');
});

test("intentional reference phone framing survives the streamed draft without an uploaded screenshot", async ({ page, request }) => {
  const backgroundFill = { angle: 180, stops: [{ color: "#f9f9fa", position: 0 }, { color: "#f9f9fa", position: 45 }, { color: "#f2c9eb", position: 100 }] };
  const headlineStyle = { fontSize: 96, fontWeight: 600, lineHeight: 1.15, align: "center" };
  const deviceTransform = { x: 150, y: -600, width: 1000, height: 2170, rotation: -8 };
  await page.route('**/api/design/suggest-deck', route => fulfillDraft(route, {
    appName: 'Reference journal', themeId: 'clean-light', summary: 'Reference-inspired framing',
    slides: [{ layout: 'device-top', showDeviceFrame: true, deviceTransform, backgroundFill, headlineStyle, frameStyle: 'white',
      captionTransform: { x: 110, y: 1800, width: 1100, height: 600 },
      copy: { en: { label: '', headline: 'Find your rhythm' } } }],
  }));
  await page.goto('/studio');
  await page.getByPlaceholder(/Describe your app/).fill('Keep the phone placement from my reference');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).appName).toBe('Reference journal');
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone.length).toBe(1);
  const check = async () => {
    const slide = (await activeProject(request)).slidesByDevice.iphone[0];
    expect(slide.layout).toBe('device-top');
    expect(slide.transforms.device).toMatchObject(deviceTransform);
    expect(slide.screenshot).toBe('');
    expect(slide.backgroundFill).toEqual(backgroundFill);
    expect(slide.headlineStyle).toEqual(headlineStyle);
    expect(slide.frameStyle).toBe('white');
    expect(slide.label).toEqual({});
  };
  await check();
  await page.reload();
  await expect(page.locator('.dot-grid').getByText('Find your rhythm', { exact: true })).toBeVisible();
  await check();
  await expect(page.locator('.dot-grid [data-frame-style=white]')).toHaveCount(1);
  // Browsers drop the default 180deg, so look for the gradient's pink stop instead.
  const editorBackground = await page.locator('.dot-grid').evaluate(el => [...el.querySelectorAll('div')].map(node => node.style.background).find(bg => bg.includes('linear-gradient') && bg.includes('242, 201, 235')));
  expect(editorBackground).toBeTruthy();
});

test("Studio languages support keyboard selection and return focus", async ({ page }) => {
  await page.goto("/studio");
  const trigger = page.getByRole("button", { name: "Languages", exact: true });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemcheckbox", { name: "English", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const german = page.getByRole("menuitemcheckbox", { name: "Deutsch", exact: true });
  await expect(german).toBeFocused();
  await page.keyboard.press("Space");
  await expect(german).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("mobile editor keeps zoom reachable and opens one panel at a time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  const exportButton = page.getByRole("button", { name: "Export bundle" });
  expect((await exportButton.boundingBox())!.y).toBeLessThan(100);
  await expect(page.getByRole("button", { name: "Generate redesign" })).toBeHidden();
  const zoom = page.getByRole("button", { name: "Zoom in", exact: true });
  await zoom.click();
  await page.getByRole("button", { name: "Design with AI", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generate redesign" })).toBeVisible();
  await page.getByRole("button", { name: "Show screens", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generate redesign" })).toBeHidden();
  await expect(page.locator("#screens-panel")).toBeVisible();
  await page.getByRole("button", { name: "Show screen settings", exact: true }).click();
  await expect(page.locator("#screens-panel")).toBeHidden();
  await expect(page.locator("#screen-settings-panel")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Android can take the iPhone design in one click and undo it", async ({ page, request }) => {
  await openEditor(page);
  // Screen settings open by default on desktop widths.
  await expect(page.getByRole("button", { name: "Hide screen settings" })).toBeVisible();
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Shared across stores");
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Shared across stores");
  await page.getByRole("tab", { name: "Android", exact: true }).click();
  await expect(page.getByRole("combobox").filter({ hasText: "Android Phone" })).toBeVisible();
  await page.getByRole("button", { name: "Use iPhone design", exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.android[0].headline.en).toBe("Shared across stores");
  const copied = await activeProject(request);
  expect(copied.device).toBe("android");
  expect(copied.slidesByDevice.android[0].id).not.toBe(copied.slidesByDevice.iphone[0].id);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.android[0].headline.en).toBe("Your day, organized");
});

test("Languages adds a language with written copy and shows it", async ({ page, request }) => {
  let sent: { source: string; targets: string[]; items: unknown[] } | undefined;
  await page.route("**/api/design/translate", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true, failed: [], translations: {
      WELCOME: { de: "WILLKOMMEN" }, "Your day, organized": { de: "Dein Tag, geordnet" },
    } } });
  });
  await openEditor(page);
  await page.getByRole("button", { name: "Languages (1)", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Deutsch", exact: true }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).locales).toEqual(["en", "de"]);
  const project = await activeProject(request);
  expect(project.locale).toBe("de");
  expect(project.slidesByDevice.iphone[0].headline).toEqual({ en: "Your day, organized", de: "Dein Tag, geordnet" });
  expect(project.slidesByDevice.ipad[0].label.de).toBe("WILLKOMMEN");
  // Six devices share the same two captions: each is sent once.
  expect(sent).toMatchObject({ source: "en", targets: ["de"] });
  expect(sent!.items).toHaveLength(2);
  await expect(page.locator(".dot-grid").getByText("Dein Tag, geordnet", { exact: true }).first()).toBeVisible();
});

test("Your uploads reuses an earlier screenshot without uploading it again", async ({ page, request }) => {
  const image = await readFile("public/before-after/raw-calendar.webp");
  const upload = await (await request.post("/api/upload", { data: { dataUrl: `data:image/webp;base64,${image.toString("base64")}` } })).json();
  const workspace = fixture();
  workspace.projects.qa.slidesByDevice.iphone[0].screenshot = upload.path;
  expect((await request.post("/api/project", { data: workspace })).ok()).toBe(true);
  let uploads = 0;
  page.on("request", (sent) => { if (new URL(sent.url()).pathname === "/api/upload") uploads += 1; });
  let call: { screenshots?: Array<{ path: string }> } | undefined;
  await page.route("**/api/design/suggest-deck", (route) => {
    call = route.request().postDataJSON();
    return fulfillDraft(route, { appName: "Reused", themeId: "clean-light", summary: "Reused draft",
      slides: [{ layout: "device-bottom", copy: { en: { label: "", headline: "Same screen, new story" } } }] });
  });
  await page.goto("/studio");
  await page.getByRole("button", { name: "Attach screenshots", exact: true }).click();
  await page.getByRole("menuitem", { name: "Choose from your uploads" }).click();
  await page.getByRole("button", { name: "Screenshot 1", exact: true }).click();
  await page.getByRole("button", { name: "Add 1 screenshot", exact: true }).click();
  await page.getByPlaceholder(/Describe your app/).fill("A calendar for busy parents");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect.poll(() => call?.screenshots?.[0]?.path).toBe(upload.path);
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.iphone[0].headline.en).toBe("Same screen, new story");
  expect(uploads).toBe(0);
});

test("choosing iPhone and iPad drafts once and gives the iPad the same design with empty screens", async ({ page, request }) => {
  let drafted: { device?: string } | undefined;
  await page.route("**/api/design/suggest-deck", (route) => {
    drafted = route.request().postDataJSON();
    return fulfillDraft(route, { appName: "Two devices", themeId: "dark-bold", summary: "Both devices",
      slides: [{ layout: "device-bottom", frameStyle: "white", copy: { en: { label: "PLAN", headline: "A calmer day" } } }] });
  });
  await page.goto("/studio");
  await page.locator('input[type="file"]').setInputFiles("public/before-after/raw-calendar.webp");
  const devices = page.getByRole("group", { name: "Device" });
  await devices.getByRole("button", { name: "iPad", exact: true }).click();
  await expect(devices.getByRole("button", { name: "iPhone", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(devices.getByRole("button", { name: "iPad", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByPlaceholder(/Describe your app/).fill("A calendar for phones and tablets");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(async () => (await activeProject(request)).slidesByDevice.ipad?.[0]?.headline?.en).toBe("A calmer day");
  expect(drafted?.device).toBe("iphone");
  const project = await activeProject(request);
  expect(project.device).toBe("iphone");
  expect(project.slidesByDevice.iphone[0].screenshot).toMatch(/^\/screenshots\/uploaded\//);
  expect(project.slidesByDevice.ipad).toHaveLength(1);
  expect(project.slidesByDevice.ipad[0]).toMatchObject({ screenshot: "", frameStyle: "white", layout: "device-bottom" });
});

test("Your uploads shows every screenshot whole when there are more than fit", async ({ page, request }) => {
  const workspace = fixture();
  const slides = [];
  for (let index = 0; index < 14; index += 1) {
    const png = await sharp({ create: { width: 390, height: 844, channels: 3, background: `#${(0x203040 + index * 0x0a0b0c).toString(16).slice(-6)}` } }).png().toBuffer();
    const { path } = await (await request.post("/api/upload", { data: { dataUrl: `data:image/png;base64,${png.toString("base64")}` } })).json();
    slides.push({ ...workspace.projects.qa.slidesByDevice.iphone[0], id: `upload-${index}`, screenshot: path });
  }
  workspace.projects.qa.slidesByDevice.iphone = slides;
  expect((await request.post("/api/project", { data: workspace })).ok()).toBe(true);
  await page.goto("/studio");
  await page.getByRole("button", { name: "Attach screenshots", exact: true }).click();
  await page.getByRole("menuitem", { name: "Choose from your uploads" }).click();
  const tiles = page.getByRole("dialog").getByRole("button", { name: /^Screenshot \d+$/ });
  await expect(tiles).toHaveCount(14);
  // Rows used to collapse inside the scroll box, stacking screenshots on top of each other.
  const boxes = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect));
  const rows = [...new Set(boxes.map((box) => Math.round(box.top)))].sort((a, b) => a - b);
  expect(rows.length).toBeGreaterThan(1);
  for (let index = 1; index < rows.length; index += 1) expect(rows[index] - rows[index - 1]).toBeGreaterThanOrEqual(Math.round(boxes[0].height));
  expect(boxes[0].height / boxes[0].width).toBeGreaterThan(2);
});
