import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  for (const appearance of ["light", "dark"]) {
    test(`Friends sections and inline selection at ${width}px ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        appearance,
      );
      await page.goto("/friends");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      const screen = page.getByTestId("friends-screen");
      const groups = screen.getByRole("button", { name: /^Groups \(/ });
      const friends = screen.getByRole("button", { name: /^Friends \(/ });
      await expect(groups).toHaveAttribute("aria-expanded", "false");
      await expect(friends).toHaveAttribute("aria-expanded", "true");
      await expect(
        screen.getByRole("button", {
          name: "Manage Private Lists",
          exact: true,
        }),
      ).toBeVisible();
      await expect(screen.getByTestId(/^social-friend-/).first()).toBeVisible();
      await page.screenshot({
        path: `.expo/friends-refinement/friends-${width}-${appearance}.png`,
      });
      await groups.click();
      const group = screen
        .getByRole("button", { name: /^Filter friends in / })
        .first();
      await expect(group).toBeVisible();
      await group.focus();
      await page.keyboard.press("Enter");
      await expect(group).toHaveAttribute("aria-expanded", "true");
      const groupContainer = group.locator("..");
      const person = groupContainer
        .getByRole("button", { name: /^Select .+ for planning$/ })
        .first();
      await expect(person).toBeVisible();
      const label = await person.getAttribute("aria-label");
      await person.click();
      await expect(
        groupContainer.getByRole("button", {
          name: label!.replace("Select", "Deselect"),
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        screen.getByRole("button", { name: "Plan with 1", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `.expo/friends-refinement/groups-${width}-${appearance}.png`,
      });
      await group.click();
      await expect(group).toHaveAttribute("aria-expanded", "false");
      await screen.getByRole("button", { name: "Squads", exact: true }).click();
      await expect(
        screen.getByRole("button", { name: "Plan with 1", exact: true }),
      ).toBeVisible();
      await screen.getByRole("button", { name: "All", exact: true }).click();
      await expect(
        screen.getByRole("button", { name: "Plan with 1", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    });
  }
}
