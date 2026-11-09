import type { Page } from "@playwright/test";

export const DEVICE_NAMES = {
  iphone: "iPhone",
  ipad: "iPad",
  android: "Android Phone",
  "android-7": 'Android 7" Tablet',
  "android-10": 'Android 10" Tablet',
  "feature-graphic": "Feature Graphic",
} as const;

/** Opens Export bundle, ticks exactly these devices, and starts the export. */
export async function exportDevices(page: Page, devices: Array<keyof typeof DEVICE_NAMES>) {
  await page.getByRole("button", { name: "Export bundle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const wanted = new Set<string>(devices.map((device) => DEVICE_NAMES[device]));
  for (const option of await dialog.getByRole("group").getByRole("button").all()) {
    const name = (await option.locator("span > span").first().innerText()).trim();
    const pressed = (await option.getAttribute("aria-pressed")) === "true";
    if (pressed !== wanted.has(name)) await option.click();
  }
  await dialog.getByRole("button", { name: /^Export \d+ devices?$/ }).click();
}
