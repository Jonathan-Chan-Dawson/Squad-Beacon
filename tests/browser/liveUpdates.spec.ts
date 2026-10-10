import { expect, test, type Page } from "@playwright/test";

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const state = window as Window & { liveUpdateLocationRequests: number };
    state.liveUpdateLocationRequests = 0;
    const unavailable = (error?: PositionErrorCallback | null) => {
      state.liveUpdateLocationRequests += 1;
      error?.({ code: 1, message: "Location was not authorized by this test", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    };
    navigator.geolocation.getCurrentPosition = (_success, error) => unavailable(error);
    navigator.geolocation.watchPosition = (_success, error) => { unavailable(error); return 0; };
  });
});

test.afterEach(async ({ page }, info) => {
  const errors = pageErrors.get(page) ?? [];
  if (errors.length) await info.attach("page-errors", { body: errors.join("\n"), contentType: "text/plain" });
  expect(errors).toEqual([]);
});

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

async function openPlace(page: Page, name: string) {
  await page.getByRole("textbox", { name: "Search places, Beacons, people and communities", exact: true }).fill(name);
  await page.getByRole("button", { name: `Explore ${name}`, exact: true }).click();
  const preview = page.getByTestId("live-update-place-preview");
  await expect(preview.getByText(name, { exact: true })).toBeVisible();
  return preview;
}

test("place categories show their own choices and selecting again clears the draft", async ({ page }) => {
  await enterDemo(page);
  const cafe = await openPlace(page, "Riverbend Cafe");
  await cafe.getByRole("button", { name: "Update", exact: true }).click();
  const sheet = page.getByTestId("add-live-update-sheet");
  for (const group of ["Crowd", "Wait", "Availability"]) await expect(sheet.getByText(group, { exact: true })).toBeVisible();
  await expect(sheet.getByText("Parking", { exact: true })).toHaveCount(0);
  const post = page.getByRole("button", { name: "Post", exact: true });
  await expect(post).toBeDisabled();
  const busy = sheet.getByRole("button", { name: "Busy", exact: true });
  await busy.click();
  await expect(busy).toHaveAttribute("aria-pressed", "true");
  await expect(post).toBeEnabled();
  await busy.click();
  await expect(busy).toHaveAttribute("aria-pressed", "false");
  await expect(post).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await cafe.getByRole("button", { name: "Close place preview", exact: true }).click();

  const court = await openPlace(page, "Willow Courts");
  await court.getByRole("button", { name: "Update", exact: true }).click();
  for (const group of ["Availability", "Conditions"]) await expect(sheet.getByText(group, { exact: true })).toBeVisible();
  for (const group of ["Crowd", "Wait", "Parking"]) await expect(sheet.getByText(group, { exact: true })).toHaveCount(0);
  for (const option of ["Courts open", "Courts occupied", "People waiting", "Wet field"]) await expect(sheet.getByRole("button", { name: option, exact: true })).toBeVisible();
  await expect(post).toBeDisabled();
  await sheet.getByRole("button", { name: "Courts open", exact: true }).click();
  await expect(post).toBeEnabled();
  await sheet.getByRole("button", { name: "Courts open", exact: true }).click();
  await expect(post).toBeDisabled();
});

test("a place without recent updates offers one add action and a crowd-only draft", async ({ page }) => {
  await enterDemo(page);
  const preview = await openPlace(page, "Montrose Harbor");
  await expect(preview.getByText("No recent updates", { exact: true })).toBeVisible();
  for (const action of ["Still true", "Update", "Create Beacon here"]) await expect(preview.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Add Live Update", exact: true }).click();
  const sheet = page.getByTestId("add-live-update-sheet");
  await expect(sheet.getByText("Crowd", { exact: true })).toBeVisible();
  for (const group of ["Wait", "Parking", "Availability", "Conditions"]) await expect(sheet.getByText(group, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Post", exact: true })).toBeDisabled();
});

test("posting updates the summary and badge, preserves own choices, and confirmation stays in cooldown without GPS", async ({ page }) => {
  await enterDemo(page);
  const preview = await openPlace(page, "Riverbend Cafe");
  await expect(preview.getByText(/4 recent updates/)).toBeVisible();
  await preview.getByRole("button", { name: "Update", exact: true }).click();
  const sheet = page.getByTestId("add-live-update-sheet");
  await sheet.getByRole("button", { name: "Busy", exact: true }).click();
  await sheet.getByRole("button", { name: "No wait", exact: true }).click();
  await sheet.getByRole("button", { name: /Add a short update/ }).click();
  const note = "The outdoor seating area is open.";
  await sheet.getByRole("textbox", { name: "Short place update", exact: true }).fill(note);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(preview.getByText(/6 recent updates/)).toBeVisible();
  await expect(preview.getByText(/Updated just now/)).toBeVisible();
  await expect(preview.getByText(note, { exact: true })).toBeVisible();
  const map = page.getByLabel("Beacon map", { exact: true }).locator("..");
  await expect(map.getByRole("button", { name: /Riverbend Cafe:.*6 recent updates/ })).toBeVisible();

  await preview.getByRole("button", { name: "Update", exact: true }).click();
  for (const choice of ["Busy", "No wait"]) await expect(sheet.getByRole("button", { name: choice, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await preview.getByRole("button", { name: "Still true", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Thanks, confirmed", exact: true })).toBeDisabled();
  await expect(preview.getByText(/6 recent updates/)).toBeVisible();
  await preview.getByRole("button", { name: "Close place preview", exact: true }).click();
  await openPlace(page, "Riverbend Cafe");
  await expect(preview.getByRole("button", { name: "Thanks, confirmed", exact: true })).toBeDisabled();
  await preview.getByRole("button", { name: "Update note options", exact: true }).click();
  await preview.getByRole("button", { name: "Report", exact: true }).click();
  await expect(preview.getByText(note, { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as Window & { liveUpdateLocationRequests: number }).liveUpdateLocationRequests)).toBe(0);
  await expect(preview).not.toContainText(/\bPulse\b/);
});
