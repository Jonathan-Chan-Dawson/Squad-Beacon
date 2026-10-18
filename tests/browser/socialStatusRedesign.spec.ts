import { expect, test, type Page } from "@playwright/test";

async function home(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByTestId("friends-right-now")).toBeAttached();
}

for (const width of [320, 375, 430]) {
  test(`compact discovery and social controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await home(page);
    const status = page.getByTestId("compact-own-status");
    const activity = page.getByTestId("home-personal-timeline");
    const friends = page.getByTestId("friends-right-now");
    const explore = page.getByTestId("home-explore-beacons");
    expect((await status.boundingBox())!.y).toBeLessThan(
      (await activity.boundingBox())!.y,
    );
    expect((await activity.boundingBox())!.y).toBeLessThan(
      (await friends.boundingBox())!.y,
    );
    expect((await friends.boundingBox())!.y).toBeLessThan(
      (await explore.boundingBox())!.y,
    );
    expect(
      await activity.getByTestId("personal-activity-preview").count(),
    ).toBeLessThanOrEqual(2);
    await expect(friends.getByTestId(/^social-friend-/)).toHaveCount(4);
    const plus = friends.getByRole("button", {
      name: /^Select .+ for planning$/,
    });
    await expect(plus).toHaveCount(4);
    for (const target of [
      plus.first(),
      page.getByTestId("availability-dropdown"),
      page.getByRole("button", { name: "Open Sonar", exact: true }),
    ]) {
      const box = await target.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(
      explore.getByRole("button", { name: "Explore all →", exact: true }),
    ).toHaveCount(1);
    await expect(
      explore.getByRole("button", { name: "See all", exact: true }),
    ).toHaveCount(0);
    expect(
      await explore.getByTestId("discovery-editorial-row").count(),
    ).toBeLessThanOrEqual(4);
    await expect(
      explore.getByTestId("beacon-category-artwork").first(),
    ).toBeAttached();
    await page.screenshot({
      path: `test-results/discovery-after-${width}.png`,
      fullPage: true,
    });
    await explore.screenshot({
      path: `test-results/discovery-explore-${width}.png`,
    });
    const card = explore.getByTestId(/^beacon-feed-card-/).first();
    const title = card.getByRole("heading").first();
    await title.evaluate((node) => {
      node.textContent =
        "A very long evening gathering with friends for coffee and conversations along the lakeshore";
      node.style.fontSize = "22px";
      node.style.lineHeight = "29px";
    });
    await card
      .getByTestId("discovery-going-count")
      .getByText(/going/)
      .evaluate((node) => {
        node.textContent = "12345 going";
      });
    const titleBox = await title.boundingBox();
    const countBox = await card
      .getByTestId("discovery-going-count")
      .boundingBox();
    expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(countBox!.y + 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card.screenshot({
      path: `test-results/discovery-long-text-${width}.png`,
    });
    await plus.nth(0).click();
    await plus.nth(0).click();
    await expect(
      friends.getByRole("button", { name: /^Deselect .+ for planning$/ }),
    ).toHaveCount(2);
    await friends
      .getByRole("button", { name: "View all friends", exact: true })
      .click();
    const full = page.getByTestId("friends-screen");
    await full
      .getByLabel("Search all friends", { exact: true })
      .fill("no-match-example");
    await expect(
      full.getByRole("button", { name: "Plan with 2", exact: true }),
    ).toBeVisible();
    await full
      .getByRole("button", { name: "Back to Beacons", exact: true })
      .click();
    await friends
      .getByRole("button", { name: "Plan with 2", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "2 selected friends · Edit",
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Availability dropdown confirms first use, remembers privacy/duration and supports clearing", async ({
  page,
}) => {
  await home(page);
  await expect(
    page.getByRole("button", { name: "Edit your status note", exact: true }),
  ).toBeVisible();
  // Demo fixtures include several future notes. Clear them explicitly to test
  // the first-use empty state rather than assuming the actor has no schedule.
  for (
    let index = 0;
    index < 12 &&
    (await page
      .getByRole("button", { name: "Edit your status note", exact: true })
      .count());
    index++
  ) {
    await page
      .getByRole("button", { name: "Status settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clear status", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Share your availability",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Status settings",
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(page.getByTestId("compact-own-status")).toContainText(
    "Not sharing",
  );
  await page
    .getByTestId("compact-own-status")
    .screenshot({ path: "test-results/social-status-empty.png" });
  await page
    .getByRole("button", { name: "Availability choices", exact: true })
    .click();
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Share your availability", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "2 hours", exact: true }).click();
  await page
    .getByRole("button", { name: "Share availability", exact: true })
    .click();
  await expect(page.getByTestId("compact-own-status")).toContainText(
    "Available",
  );
  await page
    .getByRole("button", { name: "Availability choices", exact: true })
    .click();
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Share your availability", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Status settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear status", exact: true }).click();
  await expect(page.getByTestId("compact-own-status")).toContainText(
    "Not sharing",
  );
});

test("invitee editing preserves form and returning to Plan resumes the draft", async ({
  page,
}) => {
  await home(page);
  const friends = page.getByTestId("friends-right-now");
  await friends
    .getByRole("button", { name: /^Select .+ for planning$/ })
    .first()
    .click();
  await friends
    .getByRole("button", { name: /^Select .+ for planning$/ })
    .first()
    .click();
  await friends
    .getByRole("button", { name: "Plan with 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Browse More Templates", exact: true })
    .click();
  await page.getByLabel("Search", { exact: true }).fill("Basketball");
  await page.getByRole("button", { name: "Basketball", exact: true }).click();
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Basketball");
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Dinner with my people");
  await page
    .getByRole("button", { name: "2 selected friends · Edit", exact: true })
    .click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Dinner with my people");
  await page.goBack();
  await expect(friends).toBeAttached();
  await friends
    .getByRole("button", { name: "Plan with 2", exact: true })
    .click();
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Dinner with my people");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Beacons", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(
    page.getByTestId("friends-right-now").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("social-plan-action").filter({ visible: true }),
  ).toHaveCount(0);
});

test("dedicated Friends page searches the network and shares planning selection", async ({
  page,
}) => {
  await home(page);
  const friends = page.getByTestId("friends-right-now");
  await expect(friends.getByTestId(/^social-friend-/)).toHaveCount(4);
  await friends
    .getByRole("button", { name: "View all friends", exact: true })
    .click();
  const full = page.getByTestId("friends-screen");
  await expect(page).toHaveURL(/\/friends$/);
  await expect(
    page.getByRole("dialog", { name: "All friends", exact: true }),
  ).toHaveCount(0);
  await full.getByLabel("Search all friends", { exact: true }).fill("Jordan");
  await expect(full.getByTestId(/^social-friend-/).first()).toBeVisible();
  await full
    .getByRole("button", { name: /^Select .+ for planning$/ })
    .first()
    .click();
  await expect(
    full.getByRole("button", { name: /^Deselect .+ for planning$/ }).first(),
  ).toBeVisible();
  await full.screenshot({ path: "test-results/social-full-friends.png" });
  await full
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await expect(
    friends.getByRole("button", { name: "Plan with 1", exact: true }),
  ).toBeVisible();
  await friends
    .getByRole("button", { name: /shared status$/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Status & activity", exact: true }),
  ).toBeVisible();
});

test("own-profile status shortcut sits on the identity card clear of the avatar", async ({
  page,
}) => {
  await home(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  const shortcut = page.getByTestId("profile-status-control");
  await expect(shortcut).toBeVisible();
  const badge = await shortcut.boundingBox();
  const avatar = await page.getByTestId("profile-avatar").boundingBox();
  expect(badge!.x).toBeGreaterThanOrEqual(avatar!.x + avatar!.width);
  await shortcut.click();
  await expect(
    page.getByRole("heading", { name: "Edit your status", exact: true }),
  ).toBeVisible();
});

test("homepage Sonar uses existing explicit recipient confirmation", async ({
  page,
}) => {
  await home(page);
  await page.getByRole("button", { name: "Open Sonar", exact: true }).click();
  const sheet = page.getByTestId("profile-sonar-confirmation");
  await expect(sheet).toContainText("The demo never shares");
  await expect(
    sheet.getByRole("button", { name: "Confirm and start Sonar", exact: true }),
  ).toBeDisabled();
  await sheet.getByRole("checkbox").first().click();
  await sheet
    .getByRole("button", { name: "Confirm and start Sonar", exact: true })
    .click();
  await expect(sheet).toContainText("The demo never shares");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open Sonar", exact: true }),
  ).toBeVisible();
});

test("Explore Map context is removable and keeps intentional discovery search changes", async ({
  page,
}) => {
  await home(page);
  await page
    .getByRole("button", { name: "Explore all →", exact: true })
    .click();
  const search = page.getByTestId("browse-beacons-search");
  await search.fill("Coffee");
  await page.getByRole("button", { name: "Open map", exact: true }).click();
  const context = page
    .getByRole("button", {
      name: "Remove Beacons filter",
      exact: true,
    })
    .filter({ visible: true });
  await expect(context).toBeVisible();
  const mapSearch = page
    .getByLabel("Search places, Beacons, people and communities", {
      exact: true,
    })
    .filter({ visible: true });
  await expect(mapSearch).toHaveValue("Coffee");
  await mapSearch.fill("Study");
  await context.click();
  await expect(context).toHaveCount(0);
  await expect(mapSearch).toHaveValue("Study");
});
