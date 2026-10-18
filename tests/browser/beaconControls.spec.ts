import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

async function detail(page: Page, id: string) {
  await page.goto(`/activity/${id}`);
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("activity-detail-hero")).toBeVisible();
}

test("advanced beacon settings save and the host can manually mark arrival", async ({
  page,
}) => {
  await detail(page, "map-plan-coffee");
  // Arrival is enabled only for a live Beacon. Keep the real demo Plan stop,
  // moving its dates in memory instead of depending on the test's wall clock.
  await page.getByTestId("activity-detail-hero").evaluate(async (node) => {
    let fiber = (node as any)[
      Object.keys(node).find((key) => key.startsWith("__reactFiber"))!
    ];
    while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
      fiber = fiber.return;
    const store = fiber.memoizedProps.value;
    const activity = store.data.activities.find(
      (row: any) => row.id === "map-plan-coffee",
    );
    activity.starts_at = new Date(Date.now() - 15 * 60_000).toISOString();
    activity.ends_at = new Date(Date.now() + 60 * 60_000).toISOString();
    await store.act("read_notices");
  });
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

test("disabled modules preserve authorized shared history", async ({
  page,
}) => {
  await detail(page, "demo-tools");
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /^Checklist,/ }).click();
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
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await expect(
    page.getByText("Checklist history", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
});

test("Map admission uses Join, Going and explicit Leave", async ({ page }) => {
  await demo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page
    .getByTestId("beacon-feed-card-a1")
    .getByRole("button", { name: "More Beacon actions", exact: true })
    .click();
  await page.getByRole("button", { name: "View on Map", exact: true }).click();
  const preview = page.getByTestId("map-tooltip");
  const imIn = preview.getByRole("button", { name: "Join", exact: true });
  await expect(imIn).toBeVisible();
  await imIn.click();
  const imOut = preview.getByRole("button", { name: "Going ✓", exact: true });
  await expect(imOut).toBeVisible();
  await imOut.click();
  await page
    .getByRole("dialog", { name: "Your RSVP", exact: true })
    .getByRole("button", { name: "Leave Beacon", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Leave Beacon?", exact: true })
    .getByRole("button", { name: "Leave Beacon", exact: true })
    .click();
  await expect(
    preview.getByRole("button", { name: "Join", exact: true }),
  ).toBeVisible();
});
