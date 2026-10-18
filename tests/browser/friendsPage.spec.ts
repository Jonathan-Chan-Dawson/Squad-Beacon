import { expect, test, type Page } from "@playwright/test";

async function home(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByTestId("friends-right-now")).toBeAttached();
}

for (const width of [320, 375, 430, 1024]) {
  test(`Friends page keeps planning compact and accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await home(page);
    const preview = page.getByTestId("friends-right-now");
    await expect(preview.getByTestId(/^social-friend-/)).toHaveCount(4);
    await expect(
      preview.getByRole("button", { name: /Show more|Show less/ }),
    ).toHaveCount(0);
    const all = preview.getByRole("button", {
      name: "View all friends",
      exact: true,
    });
    const box = await all.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    await preview.screenshot({ path: `.expo/friends-page/home-${width}.png` });
    await preview
      .getByRole("button", { name: /^Select .+ for planning$/ })
      .first()
      .click();
    await preview
      .getByRole("button", { name: /^Select .+ for planning$/ })
      .first()
      .click();
    await all.click();
    const screen = page.getByTestId("friends-screen");
    await expect(page).toHaveURL(/\/friends$/);
    await expect(
      screen.getByRole("heading", { name: "Friends", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "All friends", exact: true }),
    ).toHaveCount(0);
    await expect(screen.getByTestId("social-plan-action")).toHaveCount(1);
    const plan = screen.getByRole("button", {
      name: "Plan with 2",
      exact: true,
    });
    await expect(plan).toBeInViewport();
    const search = screen.getByLabel("Search all friends", { exact: true });
    await search.fill("no-match-example");
    await expect(
      screen.getByText("No friends match. Try another search or filter.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(plan).toBeInViewport();
    await screen
      .getByRole("button", { name: /^Remove .+ from plan$/ })
      .first()
      .click();
    await expect(
      screen.getByRole("button", { name: "Plan with 1", exact: true }),
    ).toBeInViewport();
    await search.fill("");
    await page.screenshot({ path: `.expo/friends-page/friends-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await screen
      .getByRole("button", { name: "Back to Beacons", exact: true })
      .click();
    await expect(
      preview.getByRole("button", { name: "Plan with 1", exact: true }),
    ).toBeVisible();
    await all.click();
    await expect(search).toHaveValue("");
    await screen
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    await expect(screen.getByTestId("friends-planning-footer")).toHaveCount(0);
    await search.fill("Jordan");
    await expect(screen.getByTestId(/^social-friend-/).first()).toBeVisible();
    await screen
      .getByRole("button", { name: /^Select .+ for planning$/ })
      .first()
      .click();
    await screen
      .getByRole("button", { name: "Plan with 1", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "1 selected friends · Edit",
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Friends filters, list position, detail/profile return and selection survive navigation", async ({
  page,
}) => {
  await home(page);
  const preview = page.getByTestId("friends-right-now");
  const homePosition = await preview.boundingBox();
  await preview
    .getByRole("button", { name: "View all friends", exact: true })
    .click();
  const screen = page.getByTestId("friends-screen");
  const search = screen.getByLabel("Search all friends", { exact: true });
  await search.fill("Jordan");
  await screen.getByRole("button", { name: "Available", exact: true }).click();
  await screen
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  const returnedPosition = await preview.boundingBox();
  expect(Math.abs(returnedPosition!.y - homePosition!.y)).toBeLessThan(2);
  await preview
    .getByRole("button", { name: "View all friends", exact: true })
    .click();
  await expect(search).toHaveValue("Jordan");
  await screen.getByRole("button", { name: "All", exact: true }).click();
  await search.fill("");
  const scroll = screen.getByTestId("friends-list");
  await expect
    .poll(() =>
      scroll.evaluate((node) => node.scrollHeight - node.clientHeight),
    )
    .toBeGreaterThan(900);
  await scroll.evaluate((node) => {
    node.scrollTop = 900;
  });
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(850);
  const visibleProfile = screen
    .getByRole("button", { name: /^View .+'s profile$/ })
    .filter({ visible: true });
  // Pick a row actually inside the list viewport rather than forcing another scroll.
  const profiles = await visibleProfile.all();
  let chosen = profiles[0];
  for (const profile of profiles) {
    const box = await profile.boundingBox();
    if (box && box.y > 120 && box.y < 700) {
      chosen = profile;
      break;
    }
  }
  const before = await scroll.evaluate((node) => node.scrollTop);
  await chosen.click();
  await expect(page).toHaveURL(/\/person\//);
  await page.goBack();
  await expect(screen).toBeVisible();
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(before - 3);
  await screen
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await preview
    .getByRole("button", { name: "View all friends", exact: true })
    .click();
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(before - 3);
  await scroll.evaluate((node) => {
    node.scrollTop = 0;
  });
  await search.fill("Jordan");
  await screen
    .getByRole("button", { name: /shared status$/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Status & activity", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "More Status actions", exact: true }).click();
  await page
    .getByRole("button", { name: "Select for planning", exact: true })
    .click();
  await expect(
    screen.getByRole("button", { name: "Plan with 1", exact: true }),
  ).toBeInViewport();
});

test("direct Friends entry has a working Beacons fallback", async ({
  page,
}) => {
  await page.goto("/friends");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("friends-screen")).toBeVisible();
  await page
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await expect(page.getByTestId("friends-right-now")).toBeAttached();
});
test("full-network search and private/favorite filters stay distinct", async ({
  page,
}) => {
  await home(page);
  await page
    .getByRole("button", { name: "View all friends", exact: true })
    .click();
  const screen = page.getByTestId("friends-screen");
  await expect(screen.getByTestId("friends-summary")).toContainText(
    "146 friends",
  );
  expect(await screen.getByTestId(/^social-friend-/).count()).toBeLessThan(146);
  const search = screen.getByLabel("Search all friends", { exact: true });
  await search.fill("Zoe Chen");
  await expect(
    screen.getByRole("button", {
      name: "Select Zoe Chen for planning",
      exact: true,
    }),
  ).toBeVisible();
  await search.fill("");
  await screen.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(screen.getByTestId(/^social-friend-/)).toHaveCount(1);
  await expect(
    screen.getByRole("button", {
      name: "Select Casey Nguyen for planning",
      exact: true,
    }),
  ).toBeVisible();
  await screen.getByRole("button", { name: "All", exact: true }).click();
  await screen
    .getByRole("button", { name: "Close Friends", exact: true })
    .click();
  await expect(
    screen.getByText("No friends match. Try another search or filter.", {
      exact: true,
    }),
  ).toBeVisible();
  await screen
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View all friends", exact: true })
    .click();
  await expect(screen.getByTestId(/^social-friend-/)).toHaveCount(0);
  await screen.getByRole("button", { name: "All lists", exact: true }).click();
  await expect(screen.getByTestId(/^social-friend-/).first()).toBeVisible();
});

test("large text and a long name fit the narrow Friends page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await home(page);
  await page
    .getByRole("button", { name: "View all friends", exact: true })
    .click();
  const screen = page.getByTestId("friends-screen");
  await screen
    .getByRole("button", { name: /^Select .+ for planning$/ })
    .first()
    .click();
  await screen
    .getByText("Amara Alvarez", { exact: true })
    .first()
    .evaluate((node) => {
      node.textContent =
        "Amara Alexandria Alvarez with an exceptionally long name";
    });
  await screen.evaluate((node) => {
    node.querySelectorAll<HTMLElement>('[dir="auto"]').forEach((text) => {
      const style = getComputedStyle(text);
      text.style.fontSize = `${parseFloat(style.fontSize) * 1.5}px`;
      if (style.lineHeight !== "normal")
        text.style.lineHeight = `${parseFloat(style.lineHeight) * 1.5}px`;
    });
  });
  await expect(
    screen.getByRole("button", { name: "Plan with 1", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".expo/friends-page/large-text-320.png" });
});
