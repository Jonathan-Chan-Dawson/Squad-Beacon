import { expect, test } from "@playwright/test";

for (const width of [320, 430]) {
  for (const appearance of ["light", "dark"]) {
    test(`pending responses appear on the bell at ${width}px in ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        appearance,
      );
      await page.goto("/activities");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      const badge = page.getByTestId("notifications-badge");
      const tabBadge = page.getByTestId("squads-tab-badge");
      await expect(badge).toBeVisible();
      await expect(tabBadge).toBeVisible();
      expect(await badge.textContent()).toBe(await tabBadge.textContent());
      const bell = page.getByRole("button", {
        name: /Notifications, .*pending responses and invitations/,
      });
      await expect(bell).toBeVisible();
      await bell.click();
      await expect(page).toHaveURL(/\/responses$/);
    });
  }
}
