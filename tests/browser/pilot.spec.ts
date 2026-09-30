import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}
async function create(page: Page, action = "Create a beacon") {
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await page.getByRole("button", { name: action, exact: true }).click();
}
test("map header opens the Beacons tab", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "View beacons", exact: true }).click();
  await expect(page).toHaveURL(/\/activities$/);
  await expect(page.getByText("Friends Now", { exact: true })).toBeVisible();
});
test("Squads is a unified people and groups directory", async ({ page }) => {
  await demo(page);
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open squad The training crew" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open profile Maya Chen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open private list Close Friends" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/squads-directory-390.png" });

  await page.getByRole("button", { name: "Squads", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open profile Maya Chen" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open profile Maya Chen" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Private lists", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open private list Close Friends" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find friends", exact: true }).click();
  await expect(page.getByLabel("Find test friends")).toBeVisible();
});
test("four tabs, Now friends, favorites, joining and map chat", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText("Friends Now", { exact: true })).toBeVisible();
  await expect(page.getByText(/Free til/).first()).toBeVisible();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page
    .getByRole("button", { name: "Favorite Maya Chen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unfavorite Maya Chen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", {
      name: "View A few rounds. Good company.",
      exact: true,
    })
    .locator("..")
    .getByRole("button", { name: "Join", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Going - view beacon", exact: true })
    .click();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await expect(page.getByTestId("map-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Beacon details" }).click();
  await expect(page.getByTestId("map-panel")).toBeVisible();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.getByLabel("Message", { exact: true }).fill("On my way!");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("On my way!", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "I'm out", exact: true }).click();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.getByText("A room for the crew")).toBeVisible();
  await page.getByRole("button", { name: "Back to map tooltip" }).click();
  await page.getByRole("button", { name: /^Inbox/ }).click();
  await expect(page.getByText("Your inbox", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("personal templates save without publishing and hydrate creation", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "My templates" }).click();
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByLabel("Template name", { exact: true }).fill("Usual coffee");
  await page.getByLabel("What are you doing?").fill("Coffee on Friday");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "View Coffee on Friday" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "My templates" }).click();
  await page.getByRole("button", { name: "Use Usual coffee" }).click();
  await expect(page.getByLabel("What are you doing?")).toHaveValue(
    "Coffee on Friday",
  );
  await page.getByRole("button", { name: "Light up this beacon" }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View Coffee on Friday" }),
  ).toBeVisible();
});
test("status availability and removed goals", async ({ page }) => {
  await demo(page);
  await create(page, "Share a status");
  await page.getByLabel("What are you doing?").fill("Anyone for lunch?");
  await page.getByRole("button", { name: "Free to hang", exact: true }).click();
  await page.getByRole("button", { name: "Share my status" }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByText("Goals & habits")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("Lives in (optional)").fill("Chicago");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Chicago", { exact: true })).toBeVisible();
});
for (const width of [320, 390])
  test(`persistent inbox and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await demo(page);
    for (const tab of ["Map", "Beacons", "Squads", "Profile"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(
        page.getByRole("button", { name: /^Inbox/ }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Create Beacon", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    await page.getByRole("button", { name: "Compact", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "View A few rounds. Good company.",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({ path: `test-results/now-compact-${width}.png` });
    await page.getByRole("button", { name: "Full", exact: true }).click();
    await page.screenshot({ path: `test-results/now-${width}.png` });
    await create(page);
    await expect(
      page.getByRole("button", { name: "Light up this beacon" }),
    ).toBeInViewport();
  });
test("map pin opens inline details", async ({ page }) => {
  await demo(page);
  await page
    .getByRole("button", {
      name: "Map: A few rounds. Good company.",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await expect(page.getByTestId("map-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(page.getByTestId("map-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "In", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Going", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "test-results/map-inline-rsvp.png" });
  await page.getByRole("button", { name: "Out", exact: true }).click();
  await page.getByRole("button", { name: "Beacon details" }).click();
  await expect(page.getByTestId("map-panel")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to map tooltip" }).click();
  await expect(page.getByTestId("map-panel")).toHaveCount(0);
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
});

test("test neighborhood discovery and simulated acceptance", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText(/23 friends/)).toBeVisible();
  await page.getByRole("button", { name: "Find friends", exact: true }).click();
  await page.getByLabel("Find test friends").fill("Luca Hayes");
  await page
    .getByRole("button", { name: "Add Luca Hayes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simulate Luca accepting", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to Friends Now", exact: true })
    .click();
  await expect(page.getByText(/24 friends/)).toBeVisible();
  await page.getByRole("button", { name: "See more", exact: true }).click();
  await page.getByLabel("Search your friends").fill("Luca");
  await expect(
    page.getByRole("button", { name: "See Luca Hayes now" }),
  ).toBeVisible();
});
test("themes persist and mini avatar customization works", async ({ page }) => {
  await demo(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Midnight", exact: true }).click();
  await page.getByRole("button", { name: "Style my mini" }).click();
  await page.getByRole("button", { name: "Change outfit" }).click();
  await page.getByRole("button", { name: "Use this mini" }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.screenshot({ path: "test-results/neighborhood-midnight.png" });
  expect(await page.evaluate(() => localStorage.getItem("beacon.theme"))).toBe(
    "Midnight",
  );
  await page.reload();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Midnight", exact: true }),
  ).toHaveCSS("background-color", "rgb(239, 243, 255)");
  await page.getByRole("button", { name: "Sunset", exact: true }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.screenshot({ path: "test-results/neighborhood-sunset.png" });
});
