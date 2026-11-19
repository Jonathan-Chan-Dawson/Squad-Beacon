import { startDemoFromEntry } from "./demoEntry";
import { expect, test } from "@playwright/test";

for (const [width, mode] of [
  [320, "light"],
  [390, "dark"],
  [1100, "light"],
] as const) {
  test(`BEACON+ stays visible without crowding Home and Profile ${width} ${mode}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      mode,
    );
    await page.goto("/");
    await startDemoFromEntry(page);
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    const premium = page.getByRole("button", {
      name: "BEACON+ · Explore benefits",
      exact: true,
    });
    const membership = page
      .getByTestId("personal-membership-summary")
      .filter({ visible: true });
    await expect(premium).toBeInViewport();
    const controls = [
      premium,
      page.getByRole("button", { name: "Open calendar", exact: true }),
    ];
    const bounds = await Promise.all(controls.map((c) => c.boundingBox()));
    expect(bounds[0]!.height).toBeGreaterThanOrEqual(44);
    expect(bounds[0]!.x + bounds[0]!.width).toBeLessThanOrEqual(bounds[1]!.x);
    await page.screenshot({ path: `.expo/frontend-4a-home-${width}.png` });
    await premium.click();
    await expect(page).toHaveURL(/settings\/premium/);
    await expect(membership).toContainText("Free");
    await expect(page.getByTestId("premium-benefits-intro")).toContainText(
      "Coordinate the details",
    );
    await expect(page.getByTestId("premium-benefits-intro")).toContainText(
      "Free members",
    );
    await expect(
      page.getByRole("button", { name: /buy|subscribe|upgrade now/i }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `.expo/frontend-4a-premium-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Demo tier: Plus", exact: true })
      .click();
    await expect(membership).toContainText("2 of 2");
    await page.goBack();
    await page.getByRole("tab", { name: "Profile", exact: true }).click();
    await expect(premium).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Settings", exact: true }),
    ).toBeInViewport();
    await expect(membership).toContainText("BEACON+");
    await expect(membership).toContainText("Demo simulation");
    await page.screenshot({
      path: `.expo/frontend-4a-profile-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 320) {
      await page.addStyleTag({
        content:
          '[data-testid="personal-membership-summary"] [dir="auto"] {font-size:20px!important;line-height:28px!important}',
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}

test("community overlap, shared benefits and focused destinations stay distinct", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/squad/boxing");
  await startDemoFromEntry(page);
  await expect(page.getByTestId("community-in-common")).toContainText(
    "Friends here",
  );
  await expect(page.getByTestId("squad-benefits-summary")).toContainText(
    "0/2 Boosts toward Plus",
  );
  await expect(
    page.getByRole("button", {
      name: "BEACON+ · Explore benefits",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".expo/frontend-4a-squad.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "View members", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search Squad members", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("squad-benefits-summary")).toBeVisible();
  await page.goto("/space/space-neighborhood-studio");
  await startDemoFromEntry(page);
  await expect(page.getByTestId("community-in-common")).toContainText(
    "Friends here",
  );
  await page.screenshot({
    path: ".expo/frontend-4a-organization.png",
    fullPage: true,
  });
  await page.goto("/organization/org-lakefront-collective");
  await startDemoFromEntry(page);
  await expect(page.getByTestId("community-in-common")).toContainText(
    "Organizations in common",
  );
  await page.screenshot({
    path: ".expo/frontend-4a-network.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
