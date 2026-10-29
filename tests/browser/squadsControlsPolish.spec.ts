import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  for (const appearance of ["light", "dark"]) {
    test(`chat controls at ${width}px in ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        appearance,
      );
      await page.goto("/");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      await page.getByRole("tab", { name: "Squads", exact: true }).click();
      const search = page.getByRole("textbox", {
        name: "Search conversations",
        exact: true,
      });
      await expect(search).toBeVisible();
      for (const filter of ["All", "Squads", "Friends", "Unread"]) {
        const button = page.getByRole("button", { name: filter, exact: true });
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(
          (await page
            .getByTestId(`chat-filter-visual-${filter}`)
            .boundingBox())!.height,
        ).toBeLessThan(44);
      }
      const responses = page.getByRole("button", {
        name: /Responses & Invitations, \d+ pending/,
      });
      await expect(responses).toBeVisible();
      const countLabel = await responses.getAttribute("aria-label");
      const divider = page.getByTestId("chat-list-divider");
      await expect(divider).toBeVisible();
      expect((await divider.boundingBox())!.y).toBeGreaterThanOrEqual(
        (await responses.boundingBox())!.y +
          (await responses.boundingBox())!.height,
      );
      await page.screenshot({
        path: `.expo/chat-controls/squads-${width}-${appearance}.png`,
      });
      await search.fill("Jordan");
      await expect(
        page.getByRole("button", { name: "Message Jordan Ellis", exact: true }),
      ).toBeVisible();
      await search.fill(
        "A very long search for a conversation that is not present",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Clear search", exact: true })
        .click();
      const unread = page.getByRole("button", { name: "Unread", exact: true });
      await unread.focus();
      await page.keyboard.press("Enter");
      await expect(unread).toHaveAttribute("aria-pressed", "true");
      await expect(responses).toHaveAttribute("aria-label", countLabel!);
      await responses.click();
      await expect(page).toHaveURL(/responses/);
    });
  }
}
