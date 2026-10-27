import { expect, test } from "@playwright/test";

test("decision sections collapse independently and preserve saved responses", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  const open = page.getByRole("button", { name: "Open", exact: true });
  const answered = page.getByRole("button", {
    name: "Answered & Active",
    exact: true,
  });
  await expect(open).toHaveAttribute("aria-expanded", "true");
  const row = page.getByTestId("decision-row-demo-squad-ping-boxing");
  await open.click();
  await expect(row).not.toBeVisible();
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Interested", exact: true }).click();
  await page.getByRole("button", { name: "Pings", exact: true }).click();
  await expect(answered).toHaveAttribute("aria-expanded", "false");
  await expect(row).not.toBeVisible();
  await answered.click();
  await expect(
    row.getByRole("button", { name: "Interested", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await answered.click();
  await expect(row).not.toBeVisible();
});

for (const width of [320, 390, 430]) {
  test(`Ping quick responses stay in place across expansion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("tab", { name: "Squads", exact: true }).click();
    await page
      .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
      .click();
    await page.getByRole("button", { name: "Pings", exact: true }).click();
    const row = page.getByTestId("decision-row-demo-ping-maya");
    const header = row.getByRole("button", {
      name: "Open A Saturday trail loop?",
      exact: true,
    });
    const interested = row.getByRole("button", {
      name: "Interested",
      exact: true,
    });
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(interested).toBeVisible();
    await interested.click();
    await expect(interested).toHaveAttribute("aria-pressed", "true");
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(interested).toBeEnabled();
    await row.scrollIntoViewIfNeeded();
    if (width === 390)
      await page.screenshot({
        path: "test-results/ping-list-collapsed-390.png",
        animations: "disabled",
      });
    const before = await interested.boundingBox();
    for (const name of ["Maybe", "Pass"]) {
      const box = await row
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box!.y).toBeCloseTo(before!.y, 0);
    }
    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(interested).toHaveCount(1);
    const after = await interested.boundingBox();
    expect(after!.y).toBeCloseTo(before!.y, 0);
    expect(after!.height).toBeGreaterThanOrEqual(44);
    await row.getByRole("button", { name: "Maybe", exact: true }).click();
    await expect(
      row.getByRole("button", { name: "Maybe", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(header).toHaveAttribute("aria-expanded", "true");
    if (width === 390)
      await page.screenshot({
        path: "test-results/ping-list-expanded-390.png",
        animations: "disabled",
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await header.focus();
    await page.keyboard.press("Enter");
    await expect(header).toHaveAttribute("aria-expanded", "false");
  });
}
