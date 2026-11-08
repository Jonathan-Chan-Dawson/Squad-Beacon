import { expect, test } from "@playwright/test";
import { DEMO_ID, makeDemo } from "../../src/shared/demo";
const fixture = makeDemo(),
  squad = fixture.squads.find((s) =>
    fixture.squad_members.some(
      (m) => m.squad_id === s.id && m.user_id === DEMO_ID,
    ),
  )!;
test("focus sequences persist locally and a fresh demo session starts clean", async ({
  page,
}) => {
  await page.goto("/activity/demo-tools?tab=activity&tool=focus", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("button", { name: "Focus sequences", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "BEACON+ \u00b7 Explore Premium",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Demo tier: Pro", exact: true })
    .click();
  await page.goBack();
  await page
    .getByLabel("Session group \u00b7 optional", { exact: true })
    .fill("Reading circle");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start Reading circle", exact: true })
    .click();
  await expect(
    page.getByText("Focus \u00b7 1/2", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith("beacon.focus."))
          .some((k) => localStorage.getItem(k)?.includes('"deadline":')),
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: ".expo/premium-focus-sequence.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByText("Focus \u00b7 1/2", { exact: true })).toHaveCount(
    0,
  );
});
for (const appearance of ["light", "dark"]) {
  test(`Boost management pools slots, retains grace and keeps simulation separate · ${appearance}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (value) => localStorage.setItem("beacon.appearance", value),
      appearance,
    );
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/settings/premium", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page
      .getByRole("button", { name: "Demo tier: Plus", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Manage Boosts", exact: true })
      .click();
    await page.getByRole("button", { name: squad.name, exact: true }).click();
    const contribute = page.getByRole("button", {
      name: "Contribute one Boost",
      exact: true,
    });
    const visibility = page.getByRole("switch", {
      name: "Show contributor name",
    });
    await expect(visibility).toBeChecked();
    await visibility.click();
    await contribute.click();
    await expect(
      page.getByText("Anonymous member · 1 Boost", { exact: true }),
    ).toBeVisible();
    await visibility.click();
    await expect(
      page.getByText("You · 1 Boost", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1/5 active Boosts \u00b7 4 open slots", { exact: true }),
    ).toBeVisible();
    await contribute.click();
    await expect(page.getByText("Plus Squad", { exact: true })).toBeVisible();
    await expect(contribute).toBeDisabled();
    await page
      .getByRole("button", { name: "Withdraw one Boost", exact: true })
      .click();
    await expect(page.getByText(/Grace benefits until/)).toBeVisible();
    await expect(
      page.getByText("0 available · 1 allocated · 1 cooling down", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Simulate Squad Boosts", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Demo Squad Boost total: 4", exact: true })
      .click();
    await expect(page.getByText("Pro Squad", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Your contributions · 1", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByText("Pro Squad", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.expo/squad-boosts-${appearance}.png`,
      fullPage: true,
    });
  });
}
test("checklist advanced details unlock inline and stay readable after switching to Free", async ({
  page,
}) => {
  await page.goto("/activity/demo-tools?tab=activity&tool=checklist", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByLabel("Add a checklist item", { exact: true })
    .fill("Pack the map");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Edit checklist item Pack the map",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Assignment & deadline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "BEACON+ · Explore Premium", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Demo tier: Plus", exact: true })
    .click();
  await page.goBack();
  await page
    .getByLabel("Due date · optional", { exact: true })
    .fill("2028-01-31");
  await page
    .getByLabel("Remind minutes before · optional", { exact: true })
    .fill("30");
  await page
    .getByRole("button", { name: "Save checklist item", exact: true })
    .click();
  await expect(page.getByText(/Due 2028-01-31/)).toBeVisible();
  await page
    .getByRole("button", {
      name: "Edit checklist item Pack the map",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Assignment & deadline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Premium settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Demo tier: Free", exact: true })
    .click();
  await page.goBack();
  await expect(page.getByText(/Due 2028-01-31/)).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Check Pack the map", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Uncheck Pack the map", exact: true }),
  ).toBeVisible();
});
