import { expect, test, type Page } from "@playwright/test";

async function setAppearance(page: Page, appearance: "Light" | "Dark") {
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: appearance, exact: true }).click();
  await page.goBack();
}

async function openBrowse(page: Page, appearance: "Light" | "Dark") {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await setAppearance(page, appearance);
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
  await page.getByRole("button", { name: "Explore all →", exact: true }).click();
  await expect(page.getByTestId("browse-beacons-screen")).toBeVisible();
}

async function openMap(page: Page, appearance: "Light" | "Dark") {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await setAppearance(page, appearance);
  await page.getByRole("tab", { name: "Map", exact: true }).last().click();
}

test("Browse public card opens a scoped safe preview without joining", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "light" });
  await openBrowse(page, "Light");

  await page.getByTestId("browse-beacons-search").fill("photography");
  const card = page
    .getByTestId("browse-beacons-scroll")
    .getByTestId("discovery-beacon-card-map-public-photo-walk");
  await expect(card).toContainText("Five-person street photography meetup");
  await expect(card.getByTestId("discovery-going-count")).toContainText(
    /\bspots? left\b/i,
  );
  await expect(card.getByRole("button", { name: /View attendees/ })).toHaveCount(
    0,
  );
  await card.screenshot({ path: "test-results/adaptive-browse-public-card-320-light.png" });

  await card
    .getByRole("button", {
      name: "Open Five-person street photography meetup details",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  const preview = dialog.getByTestId("map-public-preview");
  await expect(preview).toContainText("Chicago");
  await expect(preview).toContainText(/approximate area/i);
  await expect(preview).not.toContainText("Hosted by");
  await expect(preview).not.toContainText("Plan stop");
  await expect(page).toHaveURL(/\/browse-beacons/);
  await dialog.screenshot({ path: "test-results/adaptive-browse-public-preview-320-light.png" });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(card).toBeVisible();
});

test("Browse attendee preview opens authorized People tab and restores Browse", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "light" });
  await openBrowse(page, "Light");

  await page
    .getByTestId("browse-beacons-search")
    .fill("Walk planning with the crew");
  const card = page.getByTestId("discovery-beacon-card-demo-tools");
  await expect(card).toBeVisible();
  const attendees = card.getByRole("button", { name: /View attendees/ });
  await expect(attendees).toBeVisible();
  await card.screenshot({
    path: "test-results/adaptive-browse-people-320-light.png",
  });

  await attendees.click();
  await expect(page).toHaveURL(/\/activity\/demo-tools.*tab=people/);
  await expect(page.getByText("Going", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(card).toBeVisible();
  await expect(page).toHaveURL(/\/browse-beacons/);
});

test("Browse readable card links only its authorized Plan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await openBrowse(page, "Dark");

  await page.getByTestId("browse-beacons-search").fill("Plan stop 1: Coffee together");
  const card = page.getByTestId("discovery-beacon-card-map-plan-coffee");
  await expect(card).toContainText("Plan stop 1: Coffee together");
  await expect(card.getByTestId("discovery-hosting-status")).toContainText(
    "Hosting",
  );
  await expect(
    card.getByRole("button", { name: "Hosting", exact: true }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Open Beacon", exact: true }),
  ).toBeVisible();
  const planLink = card.getByRole("button", {
    name: "Open Plan Coffee, art and a lakefront walk",
    exact: true,
  });
  await expect(planLink).toBeVisible();
  await expect(card.getByTestId("discovery-going-count")).toContainText(
    "spots left",
  );
  await expect(card.getByTestId("beacon-community-row")).toContainText(
    "Joined",
  );
  await expect(card).not.toContainText(/Stop \d+ of \d+/);
  await card.screenshot({
    path: "test-results/adaptive-browse-plan-community-capacity-390-dark.png",
  });

  await planLink.click();
  await expect(page).toHaveURL(/\/plan\/map-plan-city-afternoon/);
  await expect(
    page.getByRole("heading", { name: "Coffee, art and a lakefront walk" }),
  ).toBeVisible();
});

test("Map readable card keeps the selected marker and camera when details open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await openMap(page, "Light");

  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("basketball");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Open Pickup basketball Beacon",
      exact: true,
    })
    .first()
    .click();

  const preview = page.getByTestId("map-tooltip-card");
  await expect(preview).toContainText("Pickup basketball");
  await expect(preview.getByTestId("discovery-card-actions")).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Close map preview", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("map-control-rail")).toHaveCount(0);
  await preview.screenshot({ path: "test-results/adaptive-map-readable-card-390-light.png" });
  const camera = await page.locator(".leaflet-map-pane").getAttribute("style");
  await preview
    .getByRole("button", {
      name: "See overview",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/activity\/.+from=map/);
  await expect(page.getByTestId("activity-detail-hero")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(preview).toContainText("Pickup basketball");
  await expect(page.locator(".leaflet-map-pane")).toHaveAttribute(
    "style",
    camera!,
  );
  await expect(page.getByTestId("map-control-rail")).toHaveCount(0);
  await preview.getByRole("button", { name: "Close map preview" }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByTestId("map-control-rail")).toBeVisible();
});

test("Map attendee preview opens authorized People tab and restores selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await openMap(page, "Dark");

  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Plan stop 1: Coffee together");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Open Plan stop 1: Coffee together Beacon",
      exact: true,
    })
    .click();

  const preview = page.getByTestId("map-tooltip-card");
  await expect(preview).toContainText("Plan stop 1: Coffee together");
  const attendees = preview.getByRole("button", { name: /View attendees/ });
  await expect(attendees).toBeVisible();
  const camera = await page.locator(".leaflet-map-pane").getAttribute("style");
  await preview.screenshot({
    path: "test-results/adaptive-map-people-390-dark.png",
  });

  await attendees.click();
  await expect(page).toHaveURL(/activity\/map-plan-coffee/);
  await expect(page).toHaveURL(/tab=people/);
  await expect(page).toHaveURL(/from=map/);
  await expect(
    page.getByText("No participant details to show yet", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(preview).toContainText("Plan stop 1: Coffee together");
  await expect(page.locator(".leaflet-map-pane")).toHaveAttribute(
    "style",
    camera!,
  );
});

test("Map basic readable card shows neither Plan nor community context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await openMap(page, "Light");

  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Lakeside lunchtime yoga");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Open Lakeside lunchtime yoga Beacon",
      exact: true,
    })
    .click();

  const preview = page.getByTestId("map-tooltip-card");
  await expect(preview).toContainText("Lakeside lunchtime yoga");
  await expect(preview.getByTestId("beacon-community-row")).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: /Open Plan/ }),
  ).toHaveCount(0);
  await preview.screenshot({
    path: "test-results/adaptive-map-basic-no-plan-community-390-light.png",
  });
});

test("Map nonmember community row keeps its compact join action visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 520, height: 880 });
  await page.emulateMedia({ colorScheme: "dark" });
  await openMap(page, "Dark");

  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("basketball");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Open Pickup basketball Beacon",
      exact: true,
    })
    .first()
    .click();

  const preview = page.getByTestId("map-tooltip-card");
  const community = preview.getByTestId("beacon-community-row");
  await expect(community).toContainText("Weekend Hoops");
  await expect(
    community.getByRole("button", {
      name: "Join Squad Weekend Hoops",
      exact: true,
    }),
  ).toBeVisible();
  await preview.screenshot({
    path: "test-results/adaptive-map-nonmember-community-compact-520-dark.png",
  });
});

test("Map public preview stays safe and scrollable at phone width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "light" });
  await openMap(page, "Light");

  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("concert");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Preview Lakefront Summer Lights concert public Beacon",
      exact: true,
    })
    .click();

  const preview = page.getByTestId("map-public-preview");
  await expect(preview).toContainText("Lakefront Summer Lights concert");
  await expect(preview).toContainText(/approximate area/i);
  await expect(preview).not.toContainText("Hosted by");
  await expect(
    preview.getByRole("button", { name: "Close map preview", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("map-control-rail")).toHaveCount(0);
  await preview.screenshot({
    path: "test-results/adaptive-map-public-preview-320-light.png",
  });
  await preview.getByRole("button", { name: "Close map preview" }).click();
  await expect(page.getByTestId("map-public-callout")).toHaveCount(0);
  await expect(page.getByTestId("map-control-rail")).toBeVisible();
});
