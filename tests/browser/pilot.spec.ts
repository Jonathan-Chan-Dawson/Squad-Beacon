import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}
async function create(page: Page, action = "Create a beacon") {
  await page
    .getByRole("button", { name: "+ Create Beacon", exact: true })
    .click();
  await page.getByRole("button", { name: action, exact: true }).click();
}
test("three tabs, easy RSVP, goals, squads and compact creation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page
    .getByRole("button", { name: "View A few rounds. Good company." })
    .click();
  await page.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(
    page
      .getByText("You're considering it. No pressure.")
      .filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I'm in", exact: true }).click();
  await expect(
    page.getByText("You're in. See you there!").filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I'm out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "I'm in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Add a comment").fill("See you there!");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("See you there!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("tab", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Goals & habits" }).click();
  await page.getByRole("button", { name: "+ Goal", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Finish my first 10K");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit goal Finish my first 10K" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Squads" }).click();
  await page.getByRole("button", { name: "+ Create a squad" }).click();
  await page.getByLabel("Name", { exact: true }).fill("The study crew");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Open squad The study crew" }).click();
  await page.getByRole("button", { name: "Create an activity" }).click();
  await expect(
    page.getByRole("button", { name: /The study crew/ }),
  ).toBeVisible();
  await page.getByLabel("What are you doing?").fill("A focused afternoon");
  await page.getByRole("button", { name: "Light up this beacon" }).click();
  await expect(
    page.getByRole("button", { name: "View A focused afternoon" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("status to beacon to real memory and repeat template", async ({
  page,
}) => {
  await demo(page);
  await create(page, "Share a status");
  await page
    .getByRole("button", { name: "Coffee & catch-up", exact: true })
    .click();
  await page.getByRole("button", { name: "Share my status" }).click();
  await page
    .getByRole("button", { name: "View Coffee and a little catch-up" })
    .click();
  await page
    .getByRole("button", { name: "Invite company: turn into a beacon" })
    .click();
  await expect(
    page.getByRole("button", { name: "Invite company: turn into a beacon" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Mark completed" }).click();
  await page.getByLabel("Keep a memory").fill("We stayed for a second coffee.");
  await page.getByRole("button", { name: "Save memory" }).click();
  await expect(
    page.getByText("We stayed for a second coffee.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Do this again" }).click();
  await expect(page.getByLabel("What are you doing?")).toHaveValue(
    "Coffee and a little catch-up",
  );
  await expect(
    page.getByRole("button", { name: "Again? Coffee and a little catch-up" }),
  ).toBeVisible();
});
test("normal and advanced retain edits and crew target", async ({ page }) => {
  await demo(page);
  await create(page);
  await page.getByRole("button", { name: "Light up this beacon" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("What are you doing?").fill("Doubles in the park");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByLabel("How many make it happen? (optional)").fill("4");
  await page
    .getByRole("button", { name: "Host approval", exact: true })
    .click();
  await page.getByRole("button", { name: "Normal", exact: true }).click();
  await expect(page.getByLabel("What are you doing?")).toHaveValue(
    "Doubles in the park",
  );
  await expect(
    page.getByText("People request to join. You give the okay."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Light up this beacon" }).click();
  await expect(
    page.getByRole("button", { name: "View Doubles in the park" }),
  ).toContainText("Need 3 more");
});
test("demo never accesses contacts or live location", async ({ page }) => {
  await demo(page);
  await page.getByText("Your live location is off", { exact: true }).click();
  await page.getByRole("button", { name: "Start temporary sharing" }).click();
  await expect(
    page.getByText("The demo never shares your device location.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("tab", { name: "Squads" }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page.getByRole("button", { name: "Connect with a contact" }).click();
  await expect(
    page.getByText(/The demo does not access contacts/),
  ).toBeVisible();
});
for (const width of [320, 375, 390]) {
  test(`small phone layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 667 });
    await demo(page);
    for (const tab of ["Beacons", "Squads", "Profile"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(
        page.getByRole("tab", { name: tab, exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "+ Create Beacon", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("switch", { name: "Show avatars" }).click();
    await expect(page.getByTestId("user-avatar")).toHaveCount(0);
    await page.getByRole("tab", { name: "Beacons" }).click();
    await page.screenshot({ path: `test-results/beacons-${width}.png` });
    await create(page);
    await expect(
      page.getByRole("button", { name: "Light up this beacon" }),
    ).toBeInViewport();
    await page.screenshot({ path: `test-results/create-${width}.png` });
  });
}

test("map preview opens a beacon and closes its sheet", async ({ page }) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Map: A few rounds. Good company." })
    .click();
  await expect(
    page.getByText("Meet you there?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open full beacon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Back", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Meet you there?", { exact: true })).toHaveCount(
    0,
  );
});

test("profile memories work after the inbox was already opened", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Past & inbox" }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Your memories", exact: true }).click();
  await expect(page.getByText("Little plans. Real memories.", { exact: true }).filter({ visible: true })).toBeVisible();
});
