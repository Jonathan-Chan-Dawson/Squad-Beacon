import { expect, test, type Page } from "@playwright/test";

async function home(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByTestId("friends-right-now")).toBeVisible();
}

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
        const status = page.getByTestId("home-my-status");
        const activity = page.getByTestId("home-personal-timeline");
        expect((await status.boundingBox())!.y).toBeLessThan(
          (await rail.boundingBox())!.y,
        );
        expect((await rail.boundingBox())!.y).toBeLessThan(
          (await activity.boundingBox())!.y,
        );
        const seeAll = rail.getByRole("button", {
          name: /^See all \d+ friends$/,
        });
        await expect(
          rail.getByRole("button", { name: "★ Favorites", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        const summary = await rail
          .getByTestId("your-people-summary")
          .innerText();
        await expect(seeAll).toHaveText(
          "See all " + summary.split(" ")[0] + " →",
        );
        await rail
          .getByRole("button", { name: "All Friends", exact: true })
          .click();
        const carousel = rail.getByTestId("your-people-carousel");
        const cards = carousel.getByTestId(/^social-friend-/);
        expect(await cards.count()).toBeGreaterThan(1);
        expect(await cards.count()).toBeLessThan(146);
        const cardBox = await cards.first().boundingBox();
        expect(cardBox!.width).toBe(108);
        await cards.first().click();
        await expect(
          page.getByRole("dialog", { name: "Status & activity", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await rail.getByRole("button", { name: "Plan", exact: true }).click();
        await rail
          .getByRole("button", { name: /^Select .+ for planning$/ })
          .first()
          .click();
        await expect(
          rail.getByTestId("ping-audience-explanation"),
        ).toContainText("not the selected people");
        await rail
          .getByRole("button", { name: "★ Favorites", exact: true })
          .click();
        await expect(rail.getByTestId("social-plan-action")).toContainText(
          "1 selected",
        );
        await rail.getByRole("button", { name: "Done", exact: true }).click();
        await expect(rail.getByTestId("social-plan-action")).toHaveCount(0);
        await expect(
          rail.getByRole("button", {
            name: "1 selected · Continue planning",
            exact: true,
          }),
        ).toBeVisible();
        await seeAll.click();
        const directory = page.getByTestId("friends-screen");
        await expect(
          directory.getByRole("button", { name: "Favorites", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await directory
          .getByLabel("Search people and groups", { exact: true })
          .fill("no-match-example");
        await expect(
          directory.getByTestId("friends-planning-footer"),
        ).toContainText("1 selected");
        await directory
          .getByRole("button", { name: "All Friends", exact: true })
          .click();
        await expect(
          directory.getByLabel("Search people and groups", { exact: true }),
        ).toHaveValue("");
        const add = directory
          .getByRole("button", { name: /^Select .+ for planning$/ })
          .first();
        await expect(add).toHaveText("Plan");
        await add.click();
        await expect(
          directory
            .getByRole("button", { name: /^Deselect .+ for planning$/ })
            .first(),
        ).toHaveText("✓ Added");
        await directory
          .getByRole("button", { name: "Back to Beacons", exact: true })
          .click();
        await rail
          .getByRole("button", {
            name: "2 selected · Continue planning",
            exact: true,
          })
          .click();
        await rail.getByRole("button", { name: "Ping", exact: true }).click();
        await expect(page).toHaveURL(/planning\/create\?kind=ping/);
        expect(new URL(page.url()).searchParams.has("inviteeIds")).toBe(false);
        expect(new URL(page.url()).searchParams.has("planSession")).toBe(false);
        await page.goBack();
        await expect(rail.getByTestId("social-plan-action")).toContainText(
          "2 selected",
        );
        await rail.getByRole("button", { name: "Beacon", exact: true }).click();
        await expect(page).toHaveURL(/\/create\?/);
        const url = new URL(page.url());
        expect(url.pathname).toBe("/create");
        expect(JSON.parse(url.searchParams.get("inviteeIds")!)).toHaveLength(2);
        expect(url.searchParams.get("editor")).toBe("yes");
        await page.goBack();
        await rail
          .getByRole("button", { name: "Clear selection", exact: true })
          .click();
        await expect(rail.getByTestId("social-plan-action")).toHaveCount(0);
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

test("directory search never narrows homepage counts; private lists carry across without selecting", async ({
  page,
}) => {
  await home(page);
  const rail = page.getByTestId("friends-right-now");
  await rail.getByRole("button", { name: "Lists", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Private Lists", exact: true })
    .getByRole("button", {
      name: "Filter people by Close Friends",
      exact: true,
    })
    .click();
  await expect(
    rail.getByRole("button", { name: "Lists: Close Friends", exact: true }),
  ).toBeVisible();
  await expect(rail.getByTestId("social-plan-action")).toHaveCount(0);
  const count = await rail.getByTestId("your-people-summary").innerText();
  await rail.getByRole("button", { name: /^See all \d+ friends$/ }).click();
  const directory = page.getByTestId("friends-screen");
  await expect(
    directory.getByRole("button", { name: "Clear list", exact: true }),
  ).toBeVisible();
  await directory
    .getByLabel("Search people and groups", { exact: true })
    .fill("no-match-example");
  await directory
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await expect(rail.getByTestId("your-people-summary")).toHaveText(count);
});

test("enlarged text retains homepage actions and selected directory footer at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await home(page);
  const rail = page.getByTestId("friends-right-now");
  await rail.getByRole("button", { name: "All Friends", exact: true }).click();
  await rail.getByRole("button", { name: "Plan", exact: true }).click();
  await rail
    .getByRole("button", { name: /^Select .+ for planning$/ })
    .first()
    .click();
  await rail.evaluate((node) => {
    node.querySelectorAll<HTMLElement>('[dir="auto"]').forEach((text) => {
      const style = getComputedStyle(text);
      text.style.fontSize = parseFloat(style.fontSize) * 1.5 + "px";
      if (style.lineHeight !== "normal")
        text.style.lineHeight = parseFloat(style.lineHeight) * 1.5 + "px";
    });
  });
  await expect(
    rail.getByRole("button", { name: "Done", exact: true }),
  ).toBeVisible();
  await expect(
    rail.getByRole("button", { name: "Beacon", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await rail.screenshot({ path: ".expo/your-people/large-text-320.png" });
});
