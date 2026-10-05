import { test, expect, type Page } from "@playwright/test";
import { openBeaconFromMap } from "./mapHelpers";
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
async function chooseTheme(page: Page, theme: string) {
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Appearance", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: theme, exact: true }).click();
  await page.goBack();
}
test("map header opens the Beacons tab", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "View beacons", exact: true }).click();
  await expect(page).toHaveURL(/\/activities$/);
  await expect(page.getByText("Friends Now", { exact: true })).toBeVisible();
});
test("Squads is a unified people and groups directory", async ({ page }) => {
  await demo(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Open Friends & Lists", exact: true }).click();
  const directory = page.getByLabel("Directory sections");
  const directoryDialog = page.getByRole("dialog");
  await expect(
    directoryDialog.getByRole("button", {
      name: "Open squad The training crew",
    }),
  ).toBeVisible();
  await expect(
    directoryDialog.getByRole("button", { name: "Open profile Maya Chen" }),
  ).toBeVisible();
  await expect(
    directoryDialog.getByRole("button", { name: "Message Maya Chen" }),
  ).toBeVisible();
  await expect(
    directoryDialog.getByRole("button", {
      name: "Open private list Close Friends",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/squads-directory-390.png" });

  await directory.getByRole("button", { name: "Squads", exact: true }).click();
  await expect(
    directoryDialog.getByRole("button", { name: "Open profile Maya Chen" }),
  ).toHaveCount(0);
  await directory.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(
    directory.getByRole("button", { name: "Friends", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("\u2713 Friends", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    directoryDialog.getByRole("button", { name: "Open profile Maya Chen" }),
  ).toBeVisible();
  await directory
    .getByRole("button", { name: "Private lists", exact: true })
    .click();
  await expect(
    directoryDialog.getByRole("button", {
      name: "Open private list Close Friends",
    }),
  ).toBeVisible();
  await directoryDialog
    .getByRole("button", { name: "Find friends", exact: true })
    .click();
  await expect(page.getByLabel("Find test friends")).toBeVisible();
});
test("friend conversation opens from the main row and profile stays separate", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Open Friends & Lists", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Message Maya Chen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/messages\/maya$/);
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await page.goBack();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Open profile Maya Chen" })
    .click();
  await expect(page).toHaveURL(/\/person\/maya$/);
});
test("four tabs, Current friends, favorites, joining and map chat", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText("Friends Now", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Current", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("\u2713 Current", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(/Free til/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Favorites", exact: true }),
  ).toHaveCount(0);
  for (const utility of [
    "Beacon Plans",
    "My templates",
    "Library",
    "Pings & Decisions",
  ])
    await expect(
      page.getByRole("button", { name: utility, exact: true }),
    ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Starred Friends", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Starred Friends", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("\u2713 Starred Friends", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Everyone", exact: true }).click();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Upcoming", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("\u2713 Upcoming", { exact: true })).toHaveCount(
    0,
  );
  for (const utility of [
    "Beacon Plans",
    "Favorites",
    "My templates",
    "Library",
    "Pings & Decisions",
  ])
    await expect(
      page.getByRole("button", { name: utility, exact: true }),
    ).toHaveCount(0);
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Past", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("\u2713 Past", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Favorites", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page
    .getByRole("button", { name: "Favorite Maya Chen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Favorite Jordan Ellis", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unfavorite Maya Chen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Current", exact: true }).click();
  const beaconTitle = page.getByRole("button", {
    name: "View A few rounds. Good company. details",
  });
  const beaconCard = beaconTitle.locator("..").locator("..");
  await expect(beaconCard.getByRole("img", { name: /Priority:/ })).toHaveCount(
    0,
  );
  await beaconCard
    .getByRole("button", { name: "Save Beacon", exact: true })
    .click();
  await expect(
    beaconCard.getByRole("button", {
      name: "Remove saved Beacon",
      exact: true,
    }),
  ).toBeVisible();
  await beaconCard
    .getByRole("button", { name: "Remove saved Beacon", exact: true })
    .click();
  await beaconCard.getByRole("button", { name: "I'm In", exact: true }).click();
  await expect(
    beaconCard.getByRole("button", { name: "I'm Out", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Friends Now", { exact: true })).toBeVisible();
  await beaconCard
    .getByRole("button", { name: "I'm Out", exact: true })
    .click();
  await expect(
    beaconCard.getByRole("button", { name: "I'm In", exact: true }),
  ).toBeVisible();
  await beaconCard.getByRole("button", { name: "I'm In", exact: true }).click();
  await expect(
    beaconCard.getByRole("button", { name: "I'm Out", exact: true }),
  ).toBeVisible();
  await beaconTitle.click();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Open A few rounds. Good company. Beacon details",
    })
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.getByLabel("Message", { exact: true }).fill("On my way!");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("On my way!", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "I'm Out", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "I'm In", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "I'm Out", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.getByText("On my way!", { exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("personal templates save without publishing and hydrate creation", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
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
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "My templates" }).click();
  await page.getByRole("button", { name: "Use Usual coffee" }).click();
  await expect(page.getByLabel("What are you doing?")).toHaveValue(
    "Coffee on Friday",
  );
  await page.getByRole("button", { name: "Light up this beacon" }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View Coffee on Friday" }),
  ).toBeVisible();
});
test("template library searches editable recipes with mapped categories and durations", async ({
  page,
}) => {
  await demo(page);
  await create(page);
  await page.getByRole("button", { name: "Browse template library" }).click();
  await page
    .getByRole("button", { name: /^Nature \/ Outdoors, \d+ ideas$/ })
    .click();
  await page.getByLabel("Search templates").fill("Birdwatching");
  await page
    .getByRole("button", {
      name: "Use Birdwatching, 90 minutes, Other",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("What are you doing?")).toHaveValue(
    "Birdwatching",
  );
  await expect(
    page.getByRole("button", { name: "90 min", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Which trail or route?")).toBeVisible();
  await expect(page.getByText("READY WITH", { exact: true })).toBeVisible();
  await expect(page.getByText(/Chat.*Checklist.*Beacon Note/)).toBeVisible();
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
  await expect(
    page.getByText("Lives in Chicago", { exact: true }),
  ).toBeVisible();
});
for (const width of [320, 390])
  test(`persistent inbox and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await demo(page);
    for (const tab of ["Map", "Beacons", "Squads", "Profile"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      if (tab !== "Beacons") {
        await expect(
          page.getByRole("button", { name: /^Notifications/ }),
        ).toHaveCount(0);
      } else {
        await expect(
          page.getByRole("button", { name: /^Notifications/ }),
        ).toBeInViewport();
      }
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
    await expect(
      page.getByRole("button", {
        name: "View A few rounds. Good company. details",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Full", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Compact", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `test-results/current-card-${width}.png` });
    await create(page);
    await expect(
      page.getByRole("button", { name: "Light up this beacon" }),
    ).toBeInViewport();
  });
test("map pin opens inline details", async ({ page }) => {
  await demo(page);
  await openBeaconFromMap(page, "A few rounds. Good company.");
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await expect(page.getByTestId("map-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "I'm In", exact: true }).click();
  await page.getByRole("button", { name: "I'm Out", exact: true }).click();
  await expect(page.getByTestId("map-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "I'm In", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "I'm Out", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/map-inline-rsvp.png" });
  await page.getByRole("button", { name: "I'm Out", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Open A few rounds. Good company. Beacon details",
    })
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible();
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
  test.setTimeout(60000);
  await demo(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Midnight", exact: true }),
  ).toHaveCSS("background-color", "rgb(239, 243, 255)");
  await page.goBack();
  await chooseTheme(page, "Midnight");
  await page.getByRole("button", { name: "Style mini" }).click();
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
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("dark");
  await expect(
    page.getByRole("button", { name: "Midnight", exact: true }),
  ).toHaveCSS("background-color", "rgb(239, 243, 255)");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("light");
  await page.getByRole("button", { name: "Sunset", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("beacon.theme"))).toBe(
    "Sunset",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("light");
  await expect(
    page.getByRole("button", { name: "Sunset", exact: true }),
  ).toHaveCSS("background-color", "rgb(82, 44, 71)");
  await page.goBack();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.screenshot({ path: "test-results/neighborhood-sunset.png" });
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sunset", exact: true }),
  ).toHaveCSS("background-color", "rgb(247, 234, 240)");
  await page.getByRole("button", { name: "Ocean", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("beacon.theme"))).toBe(
    "Ocean",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("dark");
  await expect(
    page.getByRole("button", { name: "Ocean", exact: true }),
  ).toHaveCSS("background-color", "rgb(230, 243, 248)");
  await page.getByRole("button", { name: "Device", exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(
    page.getByRole("button", { name: "Ocean", exact: true }),
  ).toHaveCSS("background-color", "rgb(21, 58, 74)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(
    page.getByRole("button", { name: "Ocean", exact: true }),
  ).toHaveCSS("background-color", "rgb(230, 243, 248)");
  await page.goBack();
  await page.reload();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("system");
  await expect(
    page.getByRole("button", { name: "Ocean", exact: true }),
  ).toHaveCSS("background-color", "rgb(230, 243, 248)");
  await page.getByRole("button", { name: "Berry", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("beacon.theme"))).toBe(
    "Berry",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("system");
  await page.goBack();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
});
test("compact Beacons controls stay usable at narrow widths in every theme", async ({
  page,
}) => {
  await demo(page);
  for (const theme of ["Mint", "Sunset", "Midnight", "Ocean", "Berry"]) {
    await chooseTheme(page, theme);
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Current", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "View A few rounds. Good company. details",
      }),
    ).toBeVisible();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 740 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByText("Friends Now", { exact: true }),
      ).toBeVisible();
    }
  }
});
