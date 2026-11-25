import { test, expect } from "@playwright/test";

test("availability can be timed, extended, cleared, and set until cleared", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => localStorage.setItem("beacon.appearance", "dark"));
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  const intro = page.getByRole("dialog", { name: "Make it yours." });
  if (await intro.isVisible()) await intro.getByRole("button", { name: "Got it" }).click();

  const control = page.getByRole("button", {
    name: "Change availability",
    exact: true,
  });
  const editor = page.getByRole("dialog", { name: "Availability & sharing" });
  const details = () =>
    editor.getByRole("button", { name: "Change end time", exact: true });
  const save = () =>
    editor.getByRole("button", { name: "Save availability", exact: true });
  await control.click();
  await details().click();
  await editor.getByRole("radio", { name: "30 min", exact: true }).click();
  await editor.getByLabel("Availability note (optional)").fill("Up for coffee");
  await editor.getByRole("button", { name: "Free", exact: true }).click();
  await expect(save()).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await save().click();
  await expect(editor).toBeHidden();

  await control.click();
  await expect(editor.getByText(/^Free until/)).toBeVisible();
  await expect(editor.getByLabel("Availability note (optional)")).toHaveValue("Up for coffee");
  await expect(editor.getByRole("button", { name: "Who can see this", exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath("timed-availability-320.png"), animations: "disabled" });
  await details().click();
  await editor.getByRole("radio", { name: "Custom time", exact: true }).click();
  await expect(editor.getByLabel("End date and time", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "+30 min", exact: true }).click();
  await expect(editor).toBeHidden();

  await control.click();
  await editor
    .getByRole("button", { name: "Clear availability", exact: true })
    .click();
  await expect(editor).toBeHidden();

  await control.click();
  await details().click();
  await editor
    .getByRole("radio", { name: "Until cleared", exact: true })
    .click();
  await editor.getByRole("button", { name: "Busy", exact: true }).click();
  await save().click();
  await expect(editor).toBeHidden();
  await control.click();
  await expect(
    editor.getByRole("button", { name: "+30 min", exact: true }),
  ).toHaveCount(0);
  await expect(
    editor.getByRole("button", { name: "Change end time", exact: true }),
  ).toBeVisible();
});
