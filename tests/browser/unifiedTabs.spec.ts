import { expect, test } from "@playwright/test";

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 390, 430, 1440]) {
    test(`navigation and filters at ${width}px in ${appearance}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        appearance,
      );
      async function demo(route: string) {
        await page.goto(route);
        const enter = page.getByRole("button", { name: /Explore the demo/ });
        await expect(enter).toBeVisible();
        await expect
          .poll(
            () =>
              enter.evaluate((node) =>
                Object.keys(node).some((key) =>
                  key.startsWith("__reactProps$"),
                ),
              ),
            { timeout: 90000 },
          )
          .toBe(true);
        await enter.click();
        await expect(enter).toHaveCount(0);
      }
      async function noOverflow() {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await demo("/your-activity");
      const tabs = page.getByRole("tablist", { name: "Your Activity views" });
      await expect(tabs).toBeVisible();
      for (const name of ["Plans", "Calendar", "Beacons"]) {
        const tab = tabs.getByRole("tab", { name, exact: true });
        await tab.focus();
        await expect(tab).toHaveCSS("border-top-width", "2px");
        await page.keyboard.press("Enter");
        await expect(tab).toHaveAttribute("aria-selected", "true");
        expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await noOverflow();
      }
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      await page.screenshot({
        path: `docs/screenshots/unified-tabs-2026-10-31/${appearance}-${width}-activity.png`,
      });
      await demo("/squads");
      const search = page.getByRole("textbox", {
        name: "Search conversations",
      });
      await search.fill("Avery");
      await page
        .getByRole("button", { name: "Communities", exact: true })
        .click();
      await page.getByRole("button", { name: "Chats", exact: true }).click();
      await expect(search).toHaveValue("Avery");
      await search.clear();
      const unread = page.getByRole("button", { name: "Unread", exact: true });
      await unread.click();
      await expect(unread).toHaveAttribute("aria-pressed", "true");
      await noOverflow();
      await page.screenshot({
        path: `docs/screenshots/unified-tabs-2026-10-31/${appearance}-${width}-chats.png`,
      });
      await demo("/friends");
      await page.getByRole("button", { name: "Friends", exact: true }).click();
      const favorites = page.getByRole("button", {
        name: "Favorites",
        exact: true,
      });
      await favorites.click();
      await expect(favorites).toHaveAttribute("aria-pressed", "true");
      await favorites.click();
      await expect(favorites).toHaveAttribute("aria-pressed", "false");
      const lists = page.getByRole("button", {
        name: "Manage Private Lists",
        exact: true,
      });
      const tabsBounds = (await page
        .getByTestId("friends-primary-tabs")
        .boundingBox())!;
      const listsBounds = (await lists.boundingBox())!;
      expect(Math.abs(tabsBounds.y - listsBounds.y)).toBeLessThanOrEqual(2);
      expect(listsBounds.x).toBeGreaterThanOrEqual(
        tabsBounds.x + tabsBounds.width,
      );
      await lists.click();
      await expect(
        page.getByRole("dialog", { name: "Private Lists", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await noOverflow();
      await page.screenshot({
        path: `docs/screenshots/card-context-social-2026-10-31/${appearance}-${width}-friends.png`,
      });
    });
  }
}
