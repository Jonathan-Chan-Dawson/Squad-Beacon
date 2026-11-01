import { test, expect, chromium, type Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import path from "node:path";

async function demo(page: Page, route: string) {
  await page.goto(route);
  const enter = page.getByRole("button", { name: /Explore the demo/ });
  await expect(enter).toBeVisible();
  await expect
    .poll(
      () =>
        enter.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90000 },
    )
    .toBe(true);
  await enter.click();
  await expect(enter).toHaveCount(0);
}

async function column(page: Page, id: string) {
  const box = await page.getByTestId(id).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(640);
  const viewport = await page.evaluate(() => innerWidth);
  expect(Math.abs(box!.x - (viewport - box!.width) / 2)).toBeLessThan(10);
  return box!;
}

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 375, 390, 430, 1440, 1920]) {
    test(`shared main-page columns ${width}px ${appearance}`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        appearance,
      );
      await demo(page, "/activities");
      const home = await column(page, "beacons-header-column");
      const feed = page.getByTestId("home-explore-beacons");
      await expect(feed).toBeAttached();
      const feedBox = await feed.boundingBox();
      expect(Math.abs(feedBox!.x - home.x - 16)).toBeLessThan(2);
      expect(feedBox!.width).toBeLessThanOrEqual(608);
      await page.screenshot({
        path: `docs/screenshots/activity-consistency-2026-10-30/${appearance}-${width}-beacons.png`,
      });
      await demo(page, "/your-activity");
      const header = await column(page, "activity-header-column");
      const actions = await column(page, "activity-actions-column");
      expect(Math.abs(header.x - actions.x)).toBeLessThan(2);
      const tabs = await page
        .getByTestId("activity-segmented-tabs")
        .boundingBox();
      expect(tabs!.width).toBeLessThanOrEqual(360);
      const search = await page
        .getByRole("textbox", { name: "Search your activities" })
        .locator("..")
        .boundingBox();
      expect(Math.abs(search!.x - actions.x - 16)).toBeLessThan(2);
      for (const tab of ["Beacons", "Plans", "Calendar"]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expect(
          page.getByRole("tab", { name: tab, exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (tab === "Calendar") {
          await page.getByRole("button", { name: "Week", exact: true }).click();
          await expect(
            page.getByRole("button", { name: "Next week", exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Month", exact: true })
            .click();
        }
        await page.screenshot({
          path: `docs/screenshots/activity-consistency-2026-10-30/${appearance}-${width}-${tab.toLowerCase()}-workspace.png`,
        });
      }
      await demo(page, "/squads");
      await column(page, "chats-content-column");
      await expect(
        page.getByRole("button", { name: "Chats", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `docs/screenshots/activity-consistency-2026-10-30/${appearance}-${width}-chats.png`,
      });
      await page
        .getByRole("button", { name: "Communities", exact: true })
        .click();
      await column(page, "chats-content-column");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
  test(`desktop actual 75 percent browser zoom ${appearance}`, async ({
    baseURL,
  }) => {
    test.setTimeout(180000);
    const profile = mkdtempSync(path.resolve(".expo/activity-browser-zoom-"));
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chrome",
      headless: true,
      viewport: null,
      args: ["--window-size=1440,1000", "--force-device-scale-factor=1"],
    });
    try {
      const page = context.pages()[0];
      await page.goto("chrome://settings/appearance");
      await page.locator("select#zoomLevel").selectOption("0.75");
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        appearance,
      );
      await demo(page, `${baseURL}/activities`);
      expect(await page.evaluate(() => devicePixelRatio)).toBeCloseTo(0.75, 2);
      await column(page, "beacons-header-column");
      await page.screenshot({
        path: `docs/screenshots/activity-consistency-2026-10-30/${appearance}-desktop-75-beacons.png`,
      });
      await demo(page, `${baseURL}/your-activity`);
      await column(page, "activity-header-column");
      await column(page, "activity-actions-column");
      await page.getByRole("tab", { name: "Calendar", exact: true }).click();
      await page.screenshot({
        path: `docs/screenshots/activity-consistency-2026-10-30/${appearance}-desktop-75-calendar.png`,
      });
      await demo(page, `${baseURL}/squads`);
      await column(page, "chats-content-column");
    } finally {
      await context.close();
    }
  });
}
for (const appearance of ["light", "dark"] as const) {
  test(`keyboard tabs and bounded conversation ${appearance}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(
      (value) => localStorage.setItem("beacon.appearance", value),
      appearance,
    );
    await demo(page, "/your-activity");
    for (const name of ["Plans", "Calendar", "Beacons"]) {
      const tab = page.getByRole("tab", { name, exact: true });
      await tab.focus();
      await page.keyboard.press("Enter");
      await expect(tab).toHaveAttribute("aria-selected", "true");
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const create = page.getByRole("button", {
      name: "Create Beacon",
      exact: true,
    });
    expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await create.boundingBox())!.height).toBeLessThanOrEqual(52);
    await demo(page, "/squads");
    await page
      .getByRole("button", { name: "Message Avery Bennett", exact: true })
      .click();
    await expect(page).toHaveURL(/\/messages\//);
    const frame = await page
      .getByRole("button", { name: "Back", exact: true })
      .locator("..")
      .locator("..")
      .boundingBox();
    expect(frame!.width).toBeLessThanOrEqual(640);
    expect(Math.abs(frame!.x - (1440 - frame!.width) / 2)).toBeLessThan(10);
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/activity-consistency-2026-10-30/${appearance}-1440-conversation.png`,
    });
  });
}
for (const width of [320, 1440]) {
  test(`visible personal card keeps RSVP changes and cancellation at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await demo(page, "/your-activity");
    const cardId = await page
      .getByTestId(/^beacon-feed-card-/)
      .filter({
        has: page.getByRole("button", { name: "Going ✓", exact: true }),
      })
      .first()
      .getAttribute("data-testid");
    const card = page.getByTestId(cardId!);
    await card.getByRole("button", { name: "Going ✓", exact: true }).click();
    const choices = page.getByRole("dialog", {
      name: "Your RSVP",
      exact: true,
    });
    await choices.getByRole("button", { name: "Maybe", exact: true }).click();
    const maybe = page.getByRole("dialog", {
      name: "Change to Maybe?",
      exact: true,
    });
    await maybe
      .getByRole("button", { name: "Keep my response", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Going ✓", exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Going ✓", exact: true }).click();
    await choices
      .getByRole("button", { name: "Leave Beacon", exact: true })
      .click();
    const leave = page.getByRole("dialog", {
      name: "Leave Beacon?",
      exact: true,
    });
    await expect(leave).toBeVisible();
    await leave
      .getByRole("button", { name: "Keep my response", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Going ✓", exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Going ✓", exact: true }).click();
    await choices.getByRole("button", { name: "Maybe", exact: true }).click();
    await maybe
      .getByRole("button", { name: "Change to Maybe", exact: true })
      .click();
    // The committed personal list intentionally excludes tentative responses.
    await expect(card).toHaveCount(0);
  });
}
