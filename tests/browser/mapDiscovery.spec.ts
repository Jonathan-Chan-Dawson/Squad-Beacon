import { expect, test } from "@playwright/test";

const searchName = "Search places, Beacons, people and communities";

test("one activity search finds people by interest and connects through the existing preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("textbox", { name: searchName }).fill("basketball");
  const results = page.getByTestId("map-search-results");
  await expect(
    results
      .getByRole("button", {
        name: "Open Pickup basketball Beacon",
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(
    results.getByRole("button", {
      name: "View Weekend Hoops Squad",
      exact: true,
    }),
  ).toBeVisible();
  await results
    .getByRole("button", { name: "View Nico Ross on map", exact: true })
    .click();
  const person = page.getByTestId("map-person-preview");
  await expect(person).toContainText("Auburn Hoops");
  await expect(
    person.getByRole("button", { name: "View profile", exact: true }),
  ).toBeVisible();
  await person.getByRole("button", { name: "Add Friend", exact: true }).click();
  await expect(
    person.getByRole("button", { name: "Requested", exact: true }),
  ).toBeDisabled();
});

test("public discovery previews a coarse area before joining", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("textbox", { name: searchName }).fill("basketball");
  const result = page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Preview Food? A walk? public Beacon",
      exact: true,
    })
    .first();
  await result.click();
  const preview = page.getByTestId("map-public-preview");
  await expect(preview).toContainText(/approximate area/i);
  await expect(preview).toContainText("Chicago");
  await preview.getByRole("button", { name: "Join", exact: true }).click();
  const joined = page.getByTestId("map-tooltip-card");
  await expect(joined).toContainText("Food? A walk?");
  await expect(
    joined.getByRole("button", { name: "Going \u2713", exact: true }),
  ).toBeVisible();
});

test("a compact Beacon preview joins independently and opens its community profile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await expect(page.getByRole("button", { name: "Now", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("textbox", { name: searchName }).fill("basketball");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", { name: "Open Pickup basketball Beacon", exact: true })
    .first()
    .click();
  const preview = page.getByTestId("map-tooltip-card");
  await expect(preview).toContainText("Live");
  await preview.getByRole("button", { name: "Join", exact: true }).click();
  await expect(
    preview.getByRole("button", { name: "Going \u2713", exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: "View Squad Weekend Hoops", exact: true })
    .click();
  await expect(page).toHaveURL(/\/squad\/weekend-hoops/);
  const community = page.getByTestId("community-public-profile");
  await expect(community).toContainText("Weekend Hoops");
  await community
    .getByRole("button", { name: "Join Squad Weekend Hoops", exact: true })
    .click();
  await expect(community).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Now", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("map-tooltip-card")).toContainText(
    "Pickup basketball",
  );
  await expect(
    page
      .getByTestId("beacon-community-row")
      .getByRole("button", {
        name: "View Squad Weekend Hoops, joined",
        exact: true,
      }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`city discovery and return stay usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("textbox", { name: searchName }).fill("Naperville");
    const results = page.getByTestId("map-search-results");
    await results
      .getByRole("button", { name: "Search worldwide places", exact: true })
      .click();
    await results
      .getByRole("button", { name: "Explore Naperville", exact: true })
      .click();
    await expect(page.getByTestId("map-exploration-header")).toContainText(
      "Exploring Naperville",
    );
    await expect(page.getByTestId("map-discovery-help")).toContainText(
      "No Beacons here yet",
    );
    await expect(
      page.getByRole("button", { name: "Back Near Me", exact: true }),
    ).toBeInViewport();
    await page
      .getByRole("button", { name: "Back Near Me", exact: true })
      .click();
    await expect(page.getByTestId("map-exploration-header")).not.toContainText(
      "Exploring Naperville",
    );
  });
}
