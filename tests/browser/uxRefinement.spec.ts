import { expect, test, type Page } from "@playwright/test";
import { openConversation } from "./chatHelpers";

test("Chats accepts an inline Ping response without opening a separate inbox", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  const ping = page.getByTestId(/^planning-prompt-/).first();
  await expect(ping).toBeVisible();
  const promptId = await ping.getAttribute("data-testid");
  await expect(page.getByTestId(/^planning-prompt-/)).toHaveCount(1);
  await expect(
    ping.getByRole("button", { name: "Maybe", exact: true }),
  ).toBeVisible();
  await expect(
    ping.getByRole("button", { name: "Pass", exact: true }),
  ).toBeVisible();
  await ping.getByRole("button", { name: "Interested", exact: true }).click();
  await expect(page.getByTestId(promptId!)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "See all responses and invitations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^All responses & invitations/ }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/squads/);
});

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

test("saved-place exploration carries into Upcoming without adding Past shortcuts", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("textbox", {
      name: "Search Beacons, People, and places",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", {
      name: "Search Beacons, People, and places",
      exact: true,
    })
    .fill("game room");
  await page
    .getByRole("button", { name: /^Explore The game room$/i })
    .first()
    .click();
  await page.getByRole("button", { name: "View beacons", exact: true }).click();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose exploration area", exact: true }),
  ).toContainText("The game room");
  for (const name of ["Beacon Plans", "Favorites", "My templates", "Library"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  }
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Beacon Plans", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose exploration area", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Search Beacons, People, and places",
      exact: true,
    }),
  ).toBeVisible();
});

test("worldwide search is explicit and demo accounts get an honest sign-in message", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("textbox", {
      name: "Search Beacons, People, and places",
      exact: true,
    })
    .click();
  const search = page.getByRole("button", {
    name: "Search worldwide places",
    exact: true,
  });
  await expect(search).toHaveCount(0);
  await page
    .getByRole("textbox", {
      name: "Search Beacons, People, and places",
      exact: true,
    })
    .fill("Tokyo");
  await search.click();
  await expect(
    page.getByText(
      /Connect a real account to search worldwide places|Sign in to search worldwide places/,
    ),
  ).toBeVisible();
});

test("Midnight starts dark and Device appearance follows live system changes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await demo(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const midnight = page.getByRole("button", { name: "Midnight", exact: true });
  await expect(midnight).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(midnight).toHaveCSS("background-color", "rgb(239, 243, 255)");
  await page.getByRole("button", { name: "Device", exact: true }).click();
  await expect(midnight).toHaveCSS("background-color", "rgb(32, 45, 74)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(midnight).toHaveCSS("background-color", "rgb(239, 243, 255)");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(midnight).toHaveCSS("background-color", "rgb(32, 45, 74)");
  expect(
    await page.evaluate(() => localStorage.getItem("beacon.appearance")),
  ).toBe("light");
});

test("a Routine pauses, resumes and creates a fresh ordered Plan", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Beacon Plans", exact: true }).click();
  await page.getByRole("button", { name: "Routines", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Run once", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(
    page.getByRole("button", { name: "Open Beacon", exact: true }),
  ).toHaveCount(3);
  await expect(
    page.getByText("Dinner together", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bowling", { exact: true })).toBeVisible();
  await expect(page.getByText("Wind down", { exact: true })).toBeVisible();
});

test("Now keeps the useful actions close: status, friend star, message and profile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText("YOUR STATUS", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share your status", exact: true }),
  ).toBeVisible();
  const star = page.getByRole("button", {
    name: "Star Sam Rivera",
    exact: true,
  });
  await star.click();
  await expect(
    page.getByRole("button", { name: "Unstar Sam Rivera", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^Message Sam Rivera\./ }).click();
  await expect(page).toHaveURL(/\/messages\/sam\/?$/);
  await page.goBack();
  await page
    .getByRole("button", { name: "Open profile Sam Rivera", exact: true })
    .click();
  await expect(page).toHaveURL(/\/person\/sam\/?$/);
  expect(errors).toEqual([]);
});

test("an organization Ping preselects the audience and creates a usable decision", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview Lakefront Collective", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "View full organization profile",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await page.getByRole("button", { name: "+ Ping", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "organization", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByLabel("Question or decision", { exact: true })
    .fill("A Collective picnic?");
  await page
    .getByRole("button", { name: "Create ping or decision", exact: true })
    .click();
  await expect(page).toHaveURL(/\/council\//);
  await expect(
    page.getByText("A Collective picnic?", { exact: true }).last(),
  ).toBeVisible();
});

test("Profile is identity first and Appearance is in Settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await demo(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Midnight", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/refined-profile-320.png" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Midnight", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Midnight", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Midnight", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/refined-profile-midnight-320.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Squads centers real group chat, decisions and Organizations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await demo(page);
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Chats", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "test-results/refined-chats-390.png" });
  await openConversation(page, "The training crew");
  await expect(page).toHaveURL(
    /\/squad-chat\/boxing\?ping=demo-squad-ping-boxing$/,
  );
  await page
    .getByLabel("Message", { exact: true })
    .fill("Ready for the next round.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Ready for the next round.", { exact: true }).last(),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Pings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Needs your response", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await page
    .getByRole("button", { name: /Lakefront Collective/ })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "View full organization profile",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/organization\//);
  await page.screenshot({ path: "test-results/refined-organization-390.png" });
  expect(errors).toEqual([]);
});

test("an organization connects Squads, member invitations, chat and Beacon creation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await demo(page);
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create Organization", exact: true })
    .click();
  await page
    .getByLabel("Organization name", { exact: true })
    .fill("Weekend Collective");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Small plans with good people.");
  await page
    .getByRole("button", { name: "Create organization", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "View full organization profile",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/organization\//);
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Communities", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Members", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "More organization options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Members, invitations & bans", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Invite", exact: true }).click();
  await page.getByRole("button", { name: "Sam Rivera", exact: true }).click();
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(
    page.getByText("member · invited", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await expect(
    page.getByLabel("Search Weekend Collective", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Squad", exact: true }).click();
  await page
    .getByRole("button", { name: "The training crew", exact: true })
    .click();
  await page.getByRole("button", { name: "Link Squad", exact: true }).click();
  await expect(
    page.getByText("The training crew", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open organization chat", exact: true })
    .click();
  // Organization text chat remains available as a secondary header destination.
  await page
    .getByLabel("Message", { exact: true })
    .fill("First hello from the Collective.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("First hello from the Collective.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(
    page.getByLabel("Search activity", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Beacon", exact: true }).click();
  await expect(page).toHaveURL(/\/create\?organizationId=/);
  await expect(
    page.getByRole("button", { name: "organization", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByLabel("What are you doing?", { exact: true })
    .fill("Collective coffee");
  await page
    .getByRole("button", { name: "Preview my Beacon", exact: true })
    .click();
  await expect(
    page.getByText("Collective coffee", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
