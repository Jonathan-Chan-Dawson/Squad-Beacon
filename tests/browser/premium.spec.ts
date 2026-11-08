import { expect, test } from "@playwright/test";

for (const appearance of ["light", "dark"]) {
  test(`Premium tiers and demo controls preserve shared session state · ${appearance}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      appearance,
    );
    await page.goto("/settings");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("button", { name: "Premium", exact: true }).click();
    await expect(page).toHaveURL(/settings\/premium/);
    await expect(
      page.getByText("Personal Beacon templates:", { exact: false }),
    ).toContainText("/10");
    for (const [tier, quota] of [
      ["Plus", "50"],
      ["Pro", "Unlimited"],
      ["Free", "10"],
    ]) {
      await page
        .getByRole("button", { name: `Demo tier: ${tier}`, exact: true })
        .click();
      await expect(
        page.getByText("Personal Beacon templates:", { exact: false }),
      ).toContainText(`/${quota}`);
      await expect(
        page.getByRole("button", { name: `Demo tier: ${tier}`, exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    }
    await expect(
      page.getByText("Billing management · Coming soon", { exact: true }),
    ).toBeVisible();
    const plusDetails = page.getByRole("button", {
      name: "BEACON+",
      exact: true,
    });
    await plusDetails.focus();
    await plusDetails.press("Enter");
    await expect(plusDetails).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByText("Recurring multi-Beacon Plans included.", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByText("SIMULATED MEMBERSHIP", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.expo/premium-${appearance}.png`,
      fullPage: true,
    });
    await page.goBack();
    await page
      .getByRole("button", { name: "Demo Controls", exact: true })
      .click();
    const sheet = page.getByRole("dialog");
    await sheet
      .getByRole("button", { name: "Demo tier: Plus", exact: true })
      .click();
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Premium", exact: true }).click();
    await expect(
      page.getByText("Personal Beacon templates:", { exact: false }),
    ).toContainText("/50");
    await page.goBack();
    await page.getByRole("button", { name: "Leave demo", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Leave demo", exact: true })
      .click();
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("tab", { name: "Profile", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Premium", exact: true }).click();
    await expect(
      page.getByText("Personal Beacon templates:", { exact: false }),
    ).toContainText("/10");
  });
}

test("template editor survives Premium navigation and quotas explain the upgrade", async ({
  page,
}) => {
  await page.goto("/create?saveTemplate=yes");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  // Start from the existing creation launcher to retain its normal draft handoff.
  const blank = page.getByRole("button", {
    name: "+ Create Blank Beacon",
    exact: true,
  });
  if (await blank.isVisible()) await blank.click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Premium round trip");
  await page
    .getByLabel("Template name", { exact: true })
    .fill("My reusable Beacon");
  await page
    .getByRole("button", { name: "Template limits · Premium", exact: true })
    .click();
  await expect(page).toHaveURL(/settings\/premium/);
  await page
    .getByRole("button", { name: "Demo tier: Plus", exact: true })
    .click();
  await page.goBack();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Premium round trip",
  );
  await expect(page.getByLabel("Template name", { exact: true })).toHaveValue(
    "My reusable Beacon",
  );
  await expect(
    page.getByText(/personal Beacon templates · BEACON\+/),
  ).toBeVisible();
});

test("Free template quota explains limits and Plus unlocks a new save without losing content", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/create");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("A saved favorite");
  await page
    .getByRole("button", { name: "Advanced Options", exact: true })
    .click();
  await page.getByLabel("Template name", { exact: true }).fill("My favorite");
  const usage = page.getByText(/\d+\/10 personal Beacon templates/);
  const initial = Number((await usage.innerText()).match(/(\d+)\/10/)![1]);
  for (let used = initial; used < 10; used++) {
    await page
      .getByRole("button", { name: "Save as template", exact: true })
      .click();
    await expect(usage).toContainText(`${used + 1}/10`);
  }
  await page
    .getByRole("button", { name: "Save as template", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "10/10 personal Beacon templates saved",
  );
  await page
    .getByRole("button", { name: "Template limits · Premium", exact: true })
    .click();
  await expect(
    page.getByText("Personal Beacon templates:", { exact: false }),
  ).toContainText("10/10");
  await page
    .getByRole("button", { name: "Demo tier: Plus", exact: true })
    .click();
  await page.goBack();
  // Restored drafts deliberately reopen optional sections collapsed.
  const templateName = page.getByLabel("Template name", { exact: true });
  if (!(await templateName.isVisible()))
    await page
      .getByRole("button", { name: "Advanced Options", exact: true })
      .click();
  await expect(templateName).toHaveValue("My favorite");
  await page
    .getByRole("button", { name: "Save as template", exact: true })
    .click();
  await expect(
    page.getByText(/11\/50 personal Beacon templates/),
  ).toBeVisible();
});
