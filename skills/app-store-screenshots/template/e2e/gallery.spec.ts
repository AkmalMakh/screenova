import { expect, test, type APIRequestContext } from "@playwright/test";

// Publish → public gallery → "Use this template" → unpublish, in local mode.
const fixture = {
  version: 1, activeId: "qa", order: ["qa"],
  projects: {
    qa: {
      id: "qa", name: "QA campaign", updatedAt: 1, schemaVersion: 4,
      appName: "QA App", appIcon: "", themeId: "clean-light", connectedCanvas: false,
      locale: "en", locales: ["en"], device: "iphone", orientation: "portrait",
      slidesByDevice: {
        iphone: [
          { id: "screen-1", layout: "device-bottom", label: { en: "WELCOME" }, headline: { en: "Your day, organized" }, screenshot: "/screenshots/private-one.png", frameStyle: "white" },
          { id: "screen-2", layout: "hero", label: { en: "FOCUS" }, headline: { en: "Less noise" }, screenshot: "" },
        ],
      },
    },
  },
};

async function activeProject(request: APIRequestContext) {
  const json = await (await request.get("/api/project")).json();
  return json.state.projects[json.state.activeId];
}

test.beforeEach(async ({ page, request }) => {
  expect((await request.post("/api/project", { data: fixture })).ok()).toBe(true);
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ body: "", contentType: "text/css" }));
});

test("publish a deck, find it in the public gallery, reuse it as a template, then unpublish", async ({ page, request }) => {
  await page.goto("/editor");
  await expect(page.getByRole("textbox", { name: "App name", exact: true })).toHaveValue("QA App");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Anyone can see previews of these screens, including your screenshots.")).toBeVisible();
  await dialog.getByLabel("Name").fill("QA gallery deck");
  await dialog.getByRole("button", { name: "Publish to gallery" }).click();
  await expect(dialog.getByRole("heading", { name: "Published" })).toBeVisible();
  const link = await dialog.getByRole("textbox", { name: "Gallery link" }).inputValue();
  expect(link).toMatch(/\/gallery\/[0-9a-f-]{36}$/);
  await dialog.getByRole("button", { name: "Done" }).click();

  await page.goto("/gallery");
  await page.getByRole("link", { name: /QA gallery deck/ }).click();
  await expect(page.getByRole("heading", { name: "QA gallery deck", level: 1 })).toBeVisible();
  const previewUrl = await page.getByRole("img", { name: "QA gallery deck, screen 1" }).getAttribute("src");
  const previewResponse = await request.get(previewUrl!);
  expect(previewResponse.headers()["content-type"]).toBe("image/jpeg");
  expect((await previewResponse.body()).byteLength).toBeGreaterThan(1_000);

  await page.getByRole("button", { name: "Use this template" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect.poll(async () => (await activeProject(request)).name).toBe("QA gallery deck");
  const reused = await activeProject(request);
  expect(reused.id).not.toBe("qa");
  expect(reused.slidesByDevice.iphone.map((slide: { headline: { en: string }; screenshot: string; id: string }) => [slide.headline.en, slide.screenshot])).toEqual([
    ["Your day, organized", ""],
    ["Less noise", ""],
  ]);
  expect(reused.slidesByDevice.iphone[0].frameStyle).toBe("white");
  expect(reused.slidesByDevice.iphone[0].id).not.toBe("screen-1");
  expect(JSON.stringify(reused)).not.toContain("private-one.png");

  await page.goto(new URL(link).pathname);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.getByRole("button", { name: "Remove from gallery" }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByText("No designs yet")).toBeVisible();
});

test("the gallery is public and an unknown post is a 404", async ({ request }) => {
  expect((await request.get("/gallery")).status()).toBe(200);
  expect((await request.get("/gallery/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
  expect((await request.get("/gallery/00000000-0000-4000-8000-000000000000/preview/0")).status()).toBe(404);
});
