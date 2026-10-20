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
    const width = [320, 375, 430][index % 3];
    test(`${theme} ${appearance} themes six main screens at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 900 });
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
        ["create", "/create"],
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
        if (screen === "beacons") {
          await expect(
            page.getByTestId("availability-dropdown-face"),
          ).toHaveCSS(
            "background-color",
            rgb(design.availability.available.tint),
          );
        }
        if (screen === "profile") {
          await expect(
            page
              .getByRole("button", { name: "Edit your status", exact: true })
              .locator(":scope > div")
              .first(),
          ).toHaveCSS(
            "background-color",
            rgb(design.availability.available.color),
          );
        }
        await page.screenshot({
          path: `.expo/theme-refinement/${theme}-${appearance}-${screen}-${width}.png`,
        });
      }
      expect(errors).toEqual([]);
    });
  }
}

test("neutral previews use one family, persist choices, and follow live System appearance", async ({
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
    .getByRole("button", { name: "Sunset palette", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("beacon.theme")))
    .toBe("Sunset");
  await demo(page, "/settings");
  await expect(
    picker.getByRole("button", { name: "Sunset palette", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    picker.getByRole("button", { name: "System", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.screenshot({
    path: ".expo/theme-refinement/sunset-settings-light-320.png",
  });
});
