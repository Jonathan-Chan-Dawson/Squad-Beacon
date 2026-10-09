import { expect, test, type Page } from "@playwright/test";
import { openBeaconFromMap } from "./mapHelpers";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

async function create(page: Page) {
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create a beacon", exact: true })
    .click();
}

async function openCurrentBeacon(page: Page, title: string) {
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("tab", { name: /^Now, \d+ Beacons$/ }).click();
  await page
    .getByRole("button", { name: `View ${title} details`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/?]+$/);
  await expect(
    page
      .getByTestId("activity-detail-hero")
      .getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

test("advanced beacon settings save and the host can manually mark arrival", async ({
  page,
}) => {
  await demo(page);
  await create(page);
  await page.getByLabel("What are you doing?").fill("Controls checkpoint walk");
  await page.getByRole("button", { name: "More options", exact: true }).click();
  await page.getByRole("button", { name: "Light up this beacon" }).click();

  await openCurrentBeacon(page, "Controls checkpoint walk");
  await expect(
    page.getByText("Arrival · manual", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Here now" }).click();
  await expect(
    page.getByRole("button", { name: "Here now · selected" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await page.getByLabel("Capacity (optional, including you)").fill("3");
  await page
    .getByRole("button", { name: "Capacity policy: Strict", exact: true })
    .click();
  await page.getByRole("button", { name: "Save beacon settings" }).click();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await expect(
    page.getByLabel("Capacity (optional, including you)"),
  ).toHaveValue("3");
  await page.getByLabel("Capacity (optional, including you)").fill("4");
  await page.getByRole("button", { name: "Save beacon settings" }).click();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await expect(
    page.getByLabel("Capacity (optional, including you)"),
  ).toHaveValue("4");
});

test("disabled modules disappear from Beacon details while shared history stays in Library", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await page
    .getByRole("button", {
      name: "View Walk planning with the crew details",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page
    .getByTestId("map-tooltip")
    .getByTestId("map-tooltip-card")
    .first()
    .getByRole("button", {
      name: "Open Walk planning with the crew Beacon details",
    })
    .first()
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await expect(
    page.getByLabel("Collapse checklist", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Tools options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Checklist: Off", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Beacon Note: Off", exact: true })
    .click();
  await page.getByRole("button", { name: "Timer: Off", exact: true }).click();
  await page
    .getByRole("button", { name: "Expand Social options", exact: true })
    .click();
  await page.getByRole("button", { name: "Chat: Off", exact: true }).click();
  await page.getByRole("button", { name: "Save beacon settings" }).click();
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Expand checklist", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Expand Beacon Note", { exact: true }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Lists", exact: true }).click();
  await page
    .getByRole("button", { name: "View checklist", exact: true })
    .click();
  await expect(
    page.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Journals", exact: true }).click();
  await page
    .getByRole("button", { name: /shared Beacon journal history/i })
    .click();
  await expect(
    page.getByText("The lakefront route is open and easy to follow.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("demo admission supports I'm In, I'm Out, and rejoining", async ({
  page,
}) => {
  await demo(page);
  await openBeaconFromMap(page, "A few rounds. Good company.");
  const preview = page.getByTestId("map-tooltip");
  const imIn = preview.getByRole("button", { name: "I'm In", exact: true });
  await expect(imIn).toBeVisible();
  await imIn.click();
  const imOut = preview.getByRole("button", { name: "I'm Out", exact: true });
  await expect(imOut).toBeVisible();
  await imOut.click();
  await expect(
    preview.getByRole("button", { name: "I'm In", exact: true }),
  ).toBeVisible();
});
