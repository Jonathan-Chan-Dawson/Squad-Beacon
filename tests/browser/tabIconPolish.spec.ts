import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  for (const appearance of ["dark", "light"]) {
    test(`bottom navigation fits ${width}px in ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        appearance,
      );
      await page.goto("/");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      const map = page.getByRole("tab", { name: "Map", exact: true });
      const beacons = page.getByRole("tab", { name: "Beacons", exact: true });
      const squads = page.getByRole("tab", { name: "Squads", exact: true });
      const profile = page.getByRole("tab", { name: "Profile", exact: true });
      const create = page.getByRole("button", { name: "Create", exact: true });
      for (const tab of [map, beacons, squads, profile]) {
        await expect(tab).toBeVisible();
        expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await expect(create).toBeVisible();
      const icons = await Promise.all(
        ["index", "activities", "squads", "profile"].map((name) =>
          page.getByTestId(`${name}-tab-icon`).boundingBox(),
        ),
      );
      for (const box of icons) {
        expect(box!.width).toBe(icons[0]!.width);
        expect(Math.abs(box!.y - icons[0]!.y)).toBeLessThanOrEqual(1);
      }
      const badge = page.getByTestId("squads-tab-badge");
      if (await badge.count()) {
        const box = (await badge.boundingBox())!;
        const icon = icons[2]!;
        expect(box.x + box.width).toBeLessThanOrEqual(icon.x + icon.width + 8);
        expect(box.y).toBeGreaterThanOrEqual(icon.y - 5);
        expect(box.y).toBeLessThanOrEqual(icon.y);
        await expect(badge.getByLabel(/pending responses/)).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.expo/tab-polish/navigation-${width}-${appearance}.png`,
      });
      await squads.click();
      await expect(squads).toHaveAttribute("aria-selected", "true");
      await profile.click();
      await expect(profile).toHaveAttribute("aria-selected", "true");
    });
  }
}
