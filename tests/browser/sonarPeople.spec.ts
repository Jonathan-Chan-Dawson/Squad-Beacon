import { expect, test } from "@playwright/test";

for (const width of [320, 430]) {
  for (const appearance of ["light", "dark"]) {
    test(`Sonar people filters retain individual selections at ${width}px in ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        ({ appearance }) => {
          localStorage.setItem("beacon.theme", "Mint");
          localStorage.setItem("beacon.appearance", appearance);
        },
        { appearance },
      );
      await page.goto("/");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      await page.getByRole("tab", { name: "Profile", exact: true }).click();
      await page
        .getByRole("button", { name: "Open Sonar", exact: true })
        .click();
      const sheet = page.getByRole("dialog", {
        name: "Start Sonar",
        exact: true,
      });
      const search = sheet.getByRole("textbox", {
        name: "Search people and groups",
        exact: true,
      });
      const firstLabel = (await sheet
        .getByRole("checkbox")
        .nth(0)
        .getAttribute("aria-label"))!;
      const secondLabel = (await sheet
        .getByRole("checkbox")
        .nth(1)
        .getAttribute("aria-label"))!;
      await search.fill(firstLabel.replace("Share location with ", ""));
      const first = sheet.getByRole("checkbox", {
        name: firstLabel,
        exact: true,
      });
      await first.focus();
      await page.keyboard.press("Space");
      await expect(first).toBeChecked();
      await page.keyboard.press("Enter");
      await expect(first).not.toBeChecked();
      await page.keyboard.press("Space");
      await expect(first).toBeChecked();
      expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await search.fill(secondLabel.replace("Share location with ", ""));
      await sheet
        .getByRole("checkbox", { name: secondLabel, exact: true })
        .click();
      await sheet
        .getByRole("button", { name: "Selected · 2", exact: true })
        .click();
      await expect(sheet.getByRole("checkbox")).toHaveCount(2);
      for (const category of [
        "Favorites",
        "Private Lists",
        "Squads",
        "Organizations",
        "Networks",
      ]) {
        const filter = sheet.getByRole("button", {
          name: category,
          exact: true,
        });
        if (!(await filter.count())) continue;
        await filter.click();
        const group = sheet
          .getByRole("button", { name: /^Filter friends in / })
          .first();
        if (await group.count()) {
          await group.click();
          await expect(
            sheet.getByRole("button", { name: "Back to groups", exact: true }),
          ).toBeVisible();
        }
        await expect(
          sheet.getByRole("button", { name: "Selected · 2", exact: true }),
        ).toBeVisible();
      }
      await sheet
        .getByRole("button", { name: "Selected · 2", exact: true })
        .click();
      await expect(sheet.getByRole("checkbox")).toHaveCount(2);
      await sheet
        .getByRole("button", { name: "30 minutes", exact: true })
        .click();
      const start = sheet.getByRole("button", {
        name: "Start Sonar · 2 people",
        exact: true,
      });
      await expect(start).toBeInViewport();
      expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.expo/sonar/people-${width}-${appearance}.png`,
      });
      await start.click();
      await expect(sheet.getByRole("alert")).toContainText("demo never shares");
      await sheet.getByRole("button", { name: "Close", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Open Sonar", exact: true }),
      ).toBeVisible();
    });
  }
}
