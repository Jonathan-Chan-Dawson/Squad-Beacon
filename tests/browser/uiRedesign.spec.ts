import { expect, test } from "@playwright/test";

const phones = [
  { name: "iPhone 15", width: 390, height: 844 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "small Android", width: 360, height: 780 },
  { name: "Pro Max", width: 430, height: 932 },
];

for (const phone of phones) {
  test(`mobile redesign remains usable at ${phone.name} dimensions`, async ({ page }) => {
    await page.setViewportSize(phone);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();

    const current = page.getByRole("button", { name: "Current", exact: true });
    await expect(current).toBeVisible();
    await expect(current).toHaveAttribute("aria-selected", "true");
    for (const name of ["Current", "Upcoming", "Past"]) {
      const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Upcoming", exact: true }).click();
    await expect(page.getByText("Coming up", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Past", exact: true }).click();
    await expect(page.getByText("Beacon history", { exact: true })).toBeVisible();
    await current.click();

    const create = page.getByRole("button", { name: "Create Beacon", exact: true });
    const createBounds = await create.boundingBox();
    expect(createBounds?.width).toBe(58);
    expect(createBounds?.height).toBe(58);
    await create.click();
    await expect(page.getByRole("heading", { name: "What are you up to?", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create a beacon", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("button", { name: "Create a beacon", exact: true })).toHaveCount(0);
    await create.click();
    await expect(page.getByRole("button", { name: "Create a beacon", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("shared-sheet-dialog")).toHaveCount(0);

    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/ui-redesign-${phone.width}x${phone.height}.png` });
  });
}

test("a sheet queues Escape during opening and can be reopened", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();

  const create = page.getByRole("button", { name: "Create Beacon", exact: true });
  const dialog = page.getByRole("dialog");
  await create.click();
  await expect(dialog).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await create.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("the honest Demo chip is dismissed across tabs for the session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText("Demo · Sample people and plans", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss demo notice", exact: true }).click();
  await expect(page.getByText("Demo · Sample people and plans", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByText("Demo · Sample people and plans", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(page.getByText("Demo · Sample people and plans", { exact: true })).toHaveCount(0);
});
