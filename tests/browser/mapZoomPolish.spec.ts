import { expect, test } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";

const tiers = [
  ["close", "street", 17],
  ["medium", "neighborhood", 14],
  ["far", "city", 11],
  ["micro", "regional", 8],
] as const;

for (const appearance of ["light", "dark"] as const) {
  test(`Chicago Map keeps its zoom hierarchy in ${appearance}`, async ({ browser, baseURL }, info) => {
    test.setTimeout(120_000);
    for (const [scale, name, zoom] of tiers) {
      const context = await browser.newContext({ baseURL, viewport: { width: 580, height: 860 } });
      try {
        const page = await context.newPage();
        await mockOnboardingAccount(page, { signedOut: true });
        await page.addInitScript(({ appearance, zoom }) => {
          localStorage.setItem("beacon.appearance", appearance);
          localStorage.setItem("beacon.map-device.v2", JSON.stringify({
            hintsSeen: 3,
            camera: {
              center: { latitude: 41.883, longitude: -87.636 },
              zoom,
              bounds: {
                north: 41.883 + 0.005 * 2 ** (17 - zoom),
                south: 41.883 - 0.005 * 2 ** (17 - zoom),
                east: -87.636 + 0.005 * 2 ** (17 - zoom),
                west: -87.636 - 0.005 * 2 ** (17 - zoom),
              },
            },
          }));
        }, { appearance, zoom });
        await page.goto("/auth/sign-in");
        const demo = page.getByRole("button", { name: /Explore the demo/ });
        await expect.poll(() => demo.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$")),
        )).toBe(true);
        await demo.click();
        const map = page.locator(".leaflet-container");
        await expect(map).toBeVisible();
        const groups = map.locator(`[data-zoom-tier="${scale}"][role="button"]`);
        await expect(groups.first()).toBeVisible();
        await expect(map.getByTestId("map-person-projector")).toHaveCount(0);
        await expect(groups.first().getByTestId("map-cluster-count")).toBeVisible();
        if (scale === "close" || scale === "medium") {
          await expect(map.getByTestId("map-beacon-projector").first()).toBeVisible();
          // Street may suppress the shared effect in this crowded viewport.
          if (scale === "medium") await expect(groups.getByTestId("map-cluster-projector").first()).toBeVisible();
        } else {
          await expect(map.getByTestId("map-beacon-projector")).toHaveCount(0);
          await expect(map.getByTestId("map-cluster-projector")).toHaveCount(0);
        }
        if (scale === "far" || scale === "micro") {
          await expect(groups.getByTestId("cluster-constellation-dot").first()).toBeVisible();
          await expect(groups.getByTestId("cluster-friend-satellite")).toHaveCount(0);
          await expect(groups.locator(".map-petal-item")).toHaveCount(0);
        }
        await page.screenshot({ path: info.outputPath(`${name}-${appearance}.png`), animations: "disabled" });
      } finally {
        await context.close();
      }
    }
  });
}
