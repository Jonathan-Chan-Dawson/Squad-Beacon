import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(
    "template browser is a full screen and preserves recipients at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/beacon-templates?inviteeIds=%5B%22jordan%22%5D");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      await expect(
        page.getByRole("heading", { name: "Beacon Templates", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.screenshot({
        path: ".expo/template-screen/categories-" + width + ".png",
      });
      await page
        .getByRole("button", { name: "Sports & Fitness", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Back to categories", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Search", exact: true })
        .fill("Basketball");
      await page.screenshot({
        path: ".expo/template-screen/search-" + width + ".png",
      });
      await page
        .getByRole("button", { name: "Basketball", exact: true })
        .click();
      await expect(
        page.getByLabel("Activity title", { exact: true }),
      ).toHaveValue("Basketball");
      await expect(
        page.getByRole("button", { name: "Remove Jordan Ellis", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    },
  );
}

test("launcher opens a dedicated template route and Back returns without applying a template", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Browse All", exact: true }).click();
  await expect(page).toHaveURL(/beacon-templates/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }),
  ).toBeVisible();
});

for (const appearance of ["light", "dark"]) {
  test(
    "starter previews are independent of applying a template in " + appearance,
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        appearance,
      );
      await page.goto("/create");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      const starters = page.getByTestId("creation-starters");
      const previews = starters.getByRole("button", { name: /^Preview / });
      await previews.first().click();
      await expect(previews.first()).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByRole("textbox", { name: "Activity title", exact: true }),
      ).toHaveCount(0);
      await previews.nth(1).click();
      await expect(previews.first()).toHaveAttribute("aria-expanded", "false");
      await expect(previews.nth(1)).toHaveAttribute("aria-expanded", "true");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: ".expo/template-preview/starter-" + appearance + ".png",
      });
      await page
        .getByRole("button", { name: "See All Templates", exact: true })
        .click();
      await expect(page).toHaveURL(/beacon-templates/);
      await page
        .getByRole("textbox", { name: "Search", exact: true })
        .fill("Basketball");
      await page
        .getByRole("button", { name: "Preview Basketball", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Preview Basketball", exact: true }),
      ).toHaveAttribute("aria-expanded", "true");
      await page
        .getByRole("button", { name: "Basketball", exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Activity title", exact: true }),
      ).toHaveValue("Basketball");
    },
  );
}
