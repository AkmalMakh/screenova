import { test, expect } from "@playwright/test";

// Regression: LOCAL-001 / LOCAL-002 — local users were prompted to register,
// and fixture testimonials appeared as verified customer endorsements.
// Found by /qa on 2026-10-16. Report: template/LOCAL-QA.md
test("local workspace entry explains no account is needed and opens Studio", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Loved by iOS & Android creators" })).toHaveCount(0);
  await expect(page.getByText(/increased our download conversions by 28%/)).toHaveCount(0);
  await expect(page.getByText(/Use local Studio without an account/)).toBeVisible();
  await page.getByRole("button", { name: "Your workspace", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Local mode needs no account or email verification.");
  await page.screenshot({ path: info.outputPath("local-workspace-entry.png") });
  await dialog.getByRole("button", { name: "Open Studio", exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByPlaceholder(/Describe your app/)).toBeVisible();
});
