import { expect, test, type Page } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { startDemoFromEntry } from "./demoEntry";

async function home(page: Page) {
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByTestId("friends-right-now")).toBeVisible();
}

test("a shared Beacon opens directly from its own Your People action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await home(page);
  const rail = page.getByTestId("friends-right-now");
  await rail.getByRole("button", { name: /^All · / }).click();
  const beacon = rail.getByRole("button", { name: /^Open Beacon:/ }).first();
  await expect(beacon).toBeVisible();
  const tiles = rail.getByTestId("your-people-card");
  await expect.poll(async () => {
    const heights = await tiles.evaluateAll((nodes) => nodes.slice(0, 4).map((node) => node.getBoundingClientRect().height));
    return Math.max(...heights) - Math.min(...heights);
  }).toBeLessThan(1);
  await rail.screenshot({ path: ".expo/your-people/browsing-390.png" });
  await beacon.press("Enter");
  await expect(page.getByTestId("activity-detail-hero")).toBeVisible();
});

for (const width of [320, 390, 1024]) {
  for (const appearance of ["light", "dark"]) {
    test(
      "Your People scope and planning at " + width + "px " + appearance,
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript(
          (mode) => localStorage.setItem("beacon.appearance", mode),
          appearance,
        );
        await home(page);
        const rail = page.getByTestId("friends-right-now");
        const carousel = rail.getByTestId("your-people-carousel");
        const self = carousel.getByTestId("your-people-self");
        const activity = page.getByTestId("home-personal-timeline");
        await expect(self).toContainText("You");
        expect((await rail.boundingBox())!.y).toBeLessThan((await activity.boundingBox())!.y);
        const seeAll = rail.getByRole("button", { name: /^See all \d+ friends$/ });
        const totalLabel = await seeAll.getAttribute("aria-label");
        for (const name of ["Free", "Favorites", "In Beacons", "All"]) {
          const filter = rail.getByRole("button", { name: new RegExp(`^${name} · `) });
          await filter.click();
          await expect(filter).toHaveAttribute("aria-pressed", "true");
          await expect(self).toBeVisible();
          await expect(seeAll).toHaveAttribute("aria-label", totalLabel!);
        }
        await rail.getByRole("button", { name: /^All · / }).click();
        const cards = carousel.getByTestId(/^social-friend-/);
        expect(await cards.count()).toBeGreaterThan(1);
        expect((await self.boundingBox())!.x).toBeLessThan((await cards.first().boundingBox())!.x);
        await cards.first().press("Enter");
        const detail = page.getByRole("dialog", { name: "Status & activity", exact: true });
        await expect(detail).toBeVisible();
        await detail.getByRole("button", { name: "Plan Together", exact: true }).click();
        await expect(page).toHaveURL(/\/create\?/);
        expect(JSON.parse(new URL(page.url()).searchParams.get("inviteeIds")!)).toHaveLength(1);
        await page.goBack();
        await expect(self).toBeVisible();
        expect(await carousel.evaluate((node) => node.scrollWidth)).toBeGreaterThan((await carousel.boundingBox())!.width);
        await carousel.evaluate((node) => node.scrollBy({ left: 260 }));
        await expect.poll(() => carousel.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
        await carousel.evaluate((node) => node.scrollTo({ left: 0 }));
        await page.screenshot({
          path: ".expo/your-people/home-" + width + "-" + appearance + ".png",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      },
    );
  }
}

test("Saved & Tools shortcuts enter their existing destinations directly", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await home(page);
  const tools = page.getByTestId("saved-tools-entry");
  for (const [title, destination] of [
    ["Plans", "/plans"],
    ["Saved", "/my-collection?section=saved"],
    ["Templates", "/my-collection?section=templates"],
    ["Library", "/library"],
  ]) {
    await tools.getByRole("button", { name: title, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(destination.replace("?", "\\?") + "$"),
    );
    await page.goBack();
  }
});

test("directory search never narrows homepage counts", async ({
  page,
}) => {
  await home(page);
  const rail = page.getByTestId("friends-right-now");
  const count = await rail.getByTestId("your-people-summary").innerText();
  await rail.getByRole("button", { name: /^See all \d+ friends$/ }).click();
  const directory = page.getByTestId("friends-screen");
  await directory
    .getByLabel("Search people and groups", { exact: true })
    .fill("no-match-example");
  await directory
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await expect(rail.getByTestId("your-people-summary")).toHaveText(count);
});

test("enlarged text retains the homepage filters and directory action at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await home(page);
  const rail = page.getByTestId("friends-right-now");
  await rail.evaluate((node) => {
    node.querySelectorAll<HTMLElement>('[dir="auto"]').forEach((text) => {
      const style = getComputedStyle(text);
      text.style.fontSize = parseFloat(style.fontSize) * 1.5 + "px";
      if (style.lineHeight !== "normal")
        text.style.lineHeight = parseFloat(style.lineHeight) * 1.5 + "px";
    });
  });
  await expect(rail.getByRole("button", { name: /^See all \d+ friends$/ })).toBeVisible();
  await expect(rail.getByRole("button", { name: /^Free · / })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await rail.screenshot({ path: ".expo/your-people/large-text-320.png" });
});
