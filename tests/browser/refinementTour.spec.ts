import { test, expect } from "@playwright/test";

for (const appearance of ["light", "dark"]) {
  test(`main-screen consistency review in ${appearance}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(value => localStorage.setItem("beacon.appearance", value), appearance);
    for (const [name, route] of [
      ["map", "/"], ["beacons", "/activities"], ["squads", "/squads"],
      ["profile", "/profile"], ["your-activity", "/your-activity"],
      ["plans", "/plans"], ["calendar", "/calendar"], ["create", "/create?editor=yes"],
      ["inbox", "/responses"], ["chat", "/activity/demo-tools?tab=chat"],
      ["people", "/friends"], ["settings", "/settings"], ["help", "/help"],
    ]) {
      await page.goto(route);
      const demo = page.getByRole("button", { name: /Explore the demo/ });
      await expect(page.getByRole("button").first()).toBeVisible();
      if (await demo.isVisible()) await demo.click();
      await expect(page.getByRole("button").first()).toBeVisible();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.screenshot({ path: test.info().outputPath(`${name}-${appearance}.png`), animations: "disabled" });
    }
  });
}
