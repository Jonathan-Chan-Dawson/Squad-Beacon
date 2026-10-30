import { expect, test, type Page } from "@playwright/test";
import { getDesignColorTheme } from "@/src/theme/data";
import { themeNames } from "@/src/theme/palettes";

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
      { timeout: 90_000 },
    )
    .toBe(true);
  await enter.click({ timeout: 15_000 });
  await expect(enter).toHaveCount(0);
}

function rgb(hex: string) {
  return `rgb(${hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16))
    .join(", ")})`;
}

for (const [index, theme] of themeNames.entries()) {
  for (const appearance of ["light", "dark"] as const) {
    const width = [320, 390, 430][index % 3];
    test(`${theme} ${appearance} themes main screens at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        ({ theme, appearance }) => {
          localStorage.setItem("beacon.theme", theme);
          localStorage.setItem("beacon.appearance", appearance);
          localStorage.setItem(
            "beacon.map-device.v2",
            JSON.stringify({ hintsSeen: 3 }),
          );
        },
        { theme, appearance },
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const design = getDesignColorTheme(theme, appearance);
      const colors = design.colors;
      for (const [screen, route] of [
        ["settings", "/settings"],
        ["map", "/"],
        ["beacons", "/activities"],
        ["create", "/create?editor=yes"],
        ["squads", "/squads"],
        ["friends", "/friends"],
        ["profile", "/profile"],
      ]) {
        await demo(page, route);
        await expect
          .poll(() =>
            page.evaluate(
              ({ background, foreground }) => {
                const nodes = Array.from(
                  document.querySelectorAll("div,button,input"),
                );
                return (
                  nodes.some(
                    (node) =>
                      getComputedStyle(node).backgroundColor === background,
                  ) &&
                  nodes.some(
                    (node) => getComputedStyle(node).color === foreground,
                  )
                );
              },
              {
                background: rgb(colors.background),
                foreground: rgb(colors.textPrimary),
              },
            ),
          )
          .toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (screen === "create") {
          const title = page.getByRole("textbox", { name: "Activity title", exact: true });
          await title.focus();
          await expect(title).toHaveCSS("border-top-color", rgb(colors.primary));
          await title.blur();
          await expect(title).toHaveCSS("border-top-color", rgb(colors.borderStrong));
        }
        await page.screenshot({
          path: test.info().outputPath(`${theme}-${appearance}-${screen}-${width}.png`),
        });
        if (
          screen === "squads" &&
          ["Essential", "Sunflower", "Sunset"].includes(theme)
        ) {
          await page
            .getByRole("button", { name: "New conversation", exact: true })
            .click();
          const dialog = page.getByRole("dialog", {
            name: "New conversation",
            exact: true,
          });
          await expect(dialog).toBeVisible();
          await expect(dialog).toHaveCSS(
            "background-color",
            rgb(colors.surface),
          );
          await page.screenshot({
            path: `.expo/sunflower-themes/${theme}-${appearance}-dialog-${width}.png`,
          });
          await dialog
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        }
      }
      expect(errors).toEqual([]);
    });
  }
}

test("warm Essential and Sunflower previews persist choices and follow live System appearance", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await demo(page, "/settings");
  const picker = page.getByTestId("theme-picker");
  const dark = picker.getByRole("button", {
    name: "Essential Dark palette",
    exact: true,
  });
  const light = picker.getByRole("button", {
    name: "Essential Light palette",
    exact: true,
  });
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await light.click();
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem("beacon.theme"),
        localStorage.getItem("beacon.appearance"),
      ]),
    )
    .toEqual(["Essential", "light"]);
  await page.screenshot({
    path: ".expo/theme-refinement/essential-settings-light-320.png",
  });
  await demo(page, "/settings");
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("beacon.appearance")))
    .toBe("system");
  await picker
    .getByRole("button", { name: "Sunflower palette", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("beacon.theme")))
    .toBe("Sunflower");
  await demo(page, "/settings");
  await expect(
    picker.getByRole("button", { name: "Sunflower palette", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    picker.getByRole("button", { name: "System", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.screenshot({
    path: ".expo/sunflower-themes/sunflower-system-settings-320.png",
  });
});

for (const appearance of ["light", "dark"] as const) {
  test(`gold palette comparison and Sunflower sizing in ${appearance}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    for (const theme of ["Essential", "Sunflower", "Sunset"]) {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.evaluate(
        ({ theme, appearance }) => {
          localStorage.setItem("beacon.theme", theme);
          localStorage.setItem("beacon.appearance", appearance);
        },
        { theme, appearance },
      );
      await demo(page, "/activities");
      await page.screenshot({
        path: `.expo/sunflower-themes/compare-${theme}-${appearance}-390.png`,
      });
      if (theme === "Sunflower") {
        await page.setViewportSize({ width: 430, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.expo/sunflower-themes/Sunflower-${appearance}-beacons-430.png`,
        });
        await demo(page, "/settings");
        const picker = page.getByTestId("theme-picker");
        await picker.scrollIntoViewIfNeeded();
        await picker.screenshot({
          path: `.expo/sunflower-themes/Sunflower-${appearance}-picker-430.png`,
        });
      }
    }
  });
}
