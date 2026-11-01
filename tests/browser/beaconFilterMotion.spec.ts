import { expect, test, type Page } from "@playwright/test";

async function enter(
  page: Page,
  route: string,
  dark: boolean,
  reduced: boolean,
) {
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.addInitScript(
    (appearance) => {
      localStorage.setItem("beacon.appearance", appearance);
      localStorage.setItem(
        "beacon.map-device.v2",
        JSON.stringify({ hintsSeen: 3 }),
      );
    },
    dark ? "dark" : "light",
  );
  await page.goto(route);
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  await expect
    .poll(() =>
      demo.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$")),
      ),
    )
    .toBe(true);
  await demo.click();
  await expect(demo).toHaveCount(0);
}

for (const scenario of [
  { route: "/", dark: false, reduced: false, width: 390 },
  { route: "/browse-beacons", dark: true, reduced: false, width: 320 },
  { route: "/", dark: true, reduced: true, width: 320 },
  { route: "/browse-beacons", dark: false, reduced: true, width: 430 },
]) {
  test(`Filters fade and retain actions ${scenario.route} ${scenario.width}px ${scenario.dark ? "dark" : "light"} reduced=${scenario.reduced}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: 844 });
    await enter(page, scenario.route, scenario.dark, scenario.reduced);
    // Observe actual rendered frames, including the first attachment. A large
    // slide cannot pass simply because its final position looks centered.
    await page.evaluate(() => {
      const target = window as typeof window & {
        filterFrames?: Promise<{ opacity: number; y: number }[]>;
      };
      target.filterFrames = new Promise((resolve) => {
        const frames: { opacity: number; y: number }[] = [];
        let ticks = 0,
          settled = 0;
        const sample = () => {
          const root = document.querySelector(
            '[data-testid="shared-sheet-dialog"][aria-label="Filters"]',
          );
          const heading = root?.querySelector('[role="heading"]');
          if (root && heading) {
            const opacity = Number(getComputedStyle(root).opacity);
            frames.push({ opacity, y: heading.getBoundingClientRect().y });
            settled = opacity >= 0.999 ? settled + 1 : 0;
          }
          if (++ticks > 180 || settled >= 3) resolve(frames);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
    });
    const trigger = page
      .getByRole("button", { name: /^Filters(?:,|$)/ })
      .first();
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "Filters", exact: true });
    await expect(sheet).toBeVisible();
    const frames = await page.evaluate(
      () =>
        (
          window as typeof window & {
            filterFrames: Promise<{ opacity: number; y: number }[]>;
          }
        ).filterFrames,
    );
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)!.opacity).toBe(1);
    expect(
      frames.some((frame) => frame.opacity > 0.01 && frame.opacity < 0.99),
    ).toBe(!scenario.reduced);
    const visibleY = frames
      .filter((frame) => frame.opacity > 0.1)
      .map((frame) => frame.y);
    expect(Math.max(...visibleY) - Math.min(...visibleY)).toBeLessThan(12);
    const study = sheet.getByRole("checkbox", { name: "Study", exact: true });
    await study.click();
    await expect(study).toHaveAttribute("aria-checked", "true");
    await sheet
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await expect(study).toHaveAttribute("aria-checked", "false");
    const show = sheet.getByRole("button", { name: /^Show \d+ Beacons$/ });
    await expect(show).toBeInViewport({ ratio: 1 });
    await sheet.screenshot({
      path: `docs/screenshots/beacon-map-hotfix-2026-10-31/filters-${scenario.width}-${scenario.dark ? "dark" : "light"}-${scenario.reduced ? "reduced" : "motion"}.png`,
    });
    await show.click();
    await expect(sheet).toHaveCount(0);
    await trigger.click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
