import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

async function create(page: Page) {
  await page.getByRole("button", { name: "Create Beacon", exact: true }).click();
  await page.getByRole("button", { name: "Create a beacon", exact: true }).click();
}

async function openCurrentBeacon(page: Page, title: string) {
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await page.getByRole("button", { name: `View ${title} details`, exact: true }).click();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page.getByRole("button", { name: "Beacon details" }).click();
  await expect(page.getByTestId("map-panel")).toBeVisible();
  await page.getByRole("button", { name: "Open beacon details & tools" }).click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
}

test("advanced beacon settings save and the host can manually mark arrival", async ({ page }) => {
  await demo(page);
  await create(page);
  await page.getByLabel("What are you doing?").fill("Controls checkpoint walk");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByRole("button", { name: "Capacity & tools", exact: true }).click();
  await page.getByLabel("Capacity (optional, including you)").fill("3");
  await page.getByRole("button", { name: "Capacity policy: Strict" }).click();
  await page.getByRole("button", { name: "Chat: Paused" }).click();
  await page.getByRole("button", { name: "Checklist: Paused" }).click();
  await page.getByRole("button", { name: "Memory comments: Paused" }).click();
  await page.getByRole("button", { name: "Focus timer: Paused" }).click();
  await page.getByRole("button", { name: "Light up this beacon" }).click();

  await openCurrentBeacon(page, "Controls checkpoint walk");
  await expect(page.getByText("Arrival · manual", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Here now" }).click();
  await expect(page.getByRole("button", { name: "Here now · selected" })).toBeVisible();

  await page.getByRole("button", { name: "Capacity & tools", exact: true }).click();
  await expect(page.getByLabel("Capacity (optional, including you)")).toHaveValue("3");
  await page.getByLabel("Capacity (optional, including you)").fill("4");
  await page.getByRole("button", { name: "Save beacon settings" }).click();
  await page.getByRole("button", { name: "Capacity & tools", exact: true }).click();
  await expect(page.getByLabel("Capacity (optional, including you)")).toHaveValue("4");
  await expect(page.getByText("Memory comments are paused by the host or unavailable for this beacon.")).toBeVisible();
});

test("paused modules keep existing tool history visible and read-only", async ({ page }) => {
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await page.getByRole("button", { name: "View Walk planning with the crew details", exact: true }).click();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page.getByRole("button", { name: "Beacon details" }).click();
  await expect(page.getByTestId("map-panel")).toBeVisible();
  await page.getByRole("button", { name: "Open beacon details & tools" }).click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
  await expect(page.getByText("Bring a water bottle", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Capacity & tools", exact: true }).click();
  for (const module of ["Checklist", "Journal", "Chat", "Memory comments", "Focus timer"]) {
    await page.getByRole("button", { name: `${module}: Paused` }).click();
  }
  await page.getByRole("button", { name: "Save beacon settings" }).click();
  await expect(page.getByText("Bring a water bottle", { exact: true })).toBeVisible();
  await expect(page.getByText("The checklist is paused by the host. Existing items stay visible, read-only.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Add a checklist item")).toHaveCount(0);

  await page.getByLabel("Expand journal").click();
  await expect(page.getByText("The lakefront route is open and easy to follow.", { exact: true })).toBeVisible();
  await expect(page.getByText("The journal is paused by the host. Existing notes stay visible, read-only.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Add a journal entry")).toHaveCount(0);

  await page.getByLabel("Expand local focus timer").click();
  await expect(page.getByText("The focus timer is paused by the host. It will stay paused until re-enabled.", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page.getByRole("button", { name: "Beacon details" }).click();
  await expect(page.getByTestId("map-panel")).toBeVisible();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.getByText("This beacon's chat is paused by the host. Earlier messages stay visible.", { exact: true })).toBeVisible();
});

test("demo admission supports I'm In, I'm Out, and rejoining", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", {
    name: "Map: A few rounds. Good company.",
    exact: true,
  }).click();
  const imIn = page.getByRole("button", { name: "I'm In", exact: true });
  const imOut = page.getByRole("button", { name: "I'm Out", exact: true });
  await imIn.click();
  await expect(imIn).toBeDisabled();
  await expect(imOut).toBeVisible();
  await imOut.click();
  await expect(imIn).toBeEnabled();
  await imIn.click();
  await expect(imIn).toBeDisabled();
  await expect(imOut).toBeVisible();
});
