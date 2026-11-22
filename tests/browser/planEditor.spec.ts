import { expect, test, type Page } from "@playwright/test";
import { startDemoFromEntry } from "./demoEntry";
import { mockOnboardingAccount } from "./onboardingAccount";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const items = (page: Page) => page.getByTestId("plan-items");
const item = (page: Page, title: string) =>
  items(page).getByRole("button", { name: title, exact: true });

async function start(page: Page) {
  await page.goto("/create");
  await startDemoFromEntry(page);
  await button(page, "Create Plan").click();
  await expect(page).toHaveURL(/plan-editor/);
  await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();
}

async function addIdea(page: Page, title: string) {
  const input = page.getByRole("textbox", {
    name: "Activity idea",
    exact: true,
  });
  if (!(await input.isVisible())) await button(page, "Add Idea").click();
  await input.fill(title);
  await input.press("Enter");
  await expect(item(page, title)).toBeVisible();
}

test("links a visible decision once and reorders it on the Plan screen", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("Plan name", { exact: true }).fill("Link and arrange");
  await addIdea(page, "Meet at a cafe");
  await button(page, "Add existing").click();
  const selection = page.getByTestId("plan-existing-selection");
  await selection.getByLabel("Search Beacons and decisions").fill("weekend");
  const title = "Which weekend plan sounds best?";
  const choice = selection.getByRole("button", { name: title, exact: true });
  await choice.click();
  await item(page, title).click();
  await button(page, "Move up").click();
  await expect(items(page).getByRole("button").first()).toHaveAccessibleName(
    title,
  );
  await button(page, "Add existing").click();
  await selection.getByLabel("Search Beacons and decisions").fill(title);
  await expect(
    selection.getByRole("button", { name: title, exact: true }),
  ).toHaveCount(0);
  await button(page, "Close").click();
  await expect(page.getByTestId("dialog-backdrop")).toHaveCount(0);
  const source = await page
    .getByLabel(`Reorder ${title}`, { exact: true })
    .boundingBox();
  const destination = await page
    .getByLabel("Reorder Meet at a cafe", { exact: true })
    .boundingBox();
  await page.mouse.move(
    source!.x + source!.width / 2,
    source!.y + source!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    destination!.x + destination!.width / 2,
    destination!.y + destination!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(items(page).getByRole("button").first()).toHaveAccessibleName(
    "Meet at a cafe",
  );
  await button(page, "Create Plan").click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(items(page).getByRole("button").first()).toHaveAccessibleName(
    "Meet at a cafe",
  );
});

test("reopens the most recent unfinished Plan from a fresh entry", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  account.snapshot.capabilities = {
    ...account.snapshot.capabilities,
    living_plans: true,
    plan_editor: true,
  };
  await page.goto("/plan-editor");
  await page.getByLabel("Plan name", { exact: true }).fill("Resume this Plan");
  await addIdea(page, "Coffee by the lake");
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.goto("/plan-editor");
  await button(page, "Resume draft").click();
  await expect(page.getByLabel("Plan name", { exact: true })).toHaveValue(
    "Resume this Plan",
  );
  await expect(item(page, "Coffee by the lake")).toBeVisible();
});

for (const [appearance, width] of [
  ["dark", 320],
  ["light", 1024],
] as const) {
  test(`adds, edits, duplicates, removes and restores compact Ideas · ${appearance}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      appearance,
    );
    await page.setViewportSize({ width, height: 844 });
    await start(page);
    await expect(items(page).getByRole("button")).toHaveCount(0);
    await page
      .getByLabel("Plan name", { exact: true })
      .fill("A tiny adventure");
    await addIdea(page, "Try a cafe");
    await addIdea(page, "Go climbing");
    await item(page, "Try a cafe").click();
    await button(page, "Edit").click();
    await page
      .getByLabel("Idea details", { exact: true })
      .fill("Somewhere quiet");
    await button(page, "Finish editing").click();
    await button(page, "Duplicate").click();
    await expect(item(page, "Try a cafe")).toHaveCount(2);
    await button(page, "Remove").click();
    await expect(item(page, "Try a cafe")).toHaveCount(1);
    await button(page, "Undo").click();
    await expect(item(page, "Try a cafe")).toHaveCount(2);
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
    await expect(button(page, "Create Plan")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `.expo/plan-redesign-${appearance}.png` });
    await button(page, "Create Plan").click();
    await expect(page).toHaveURL(/\/plan\//);
    await expect(item(page, "Try a cafe")).toHaveCount(2);
    await expect(item(page, "Go climbing")).toBeVisible();
    await button(page, "Done").click();
    await expect(page).not.toHaveURL(/\/plan\//);
  });
}

test("does not list an unfinished Beacon and only publishes from scheduling review", async ({
  page,
}) => {
  await start(page);
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Draft before publishing");
  await button(page, "Add Beacon").click();
  await button(page, "Back").click();
  await expect(items(page).getByRole("button")).toHaveCount(0);
  await addIdea(page, "A staged coffee");
  await item(page, "A staged coffee").click();
  await button(page, "Edit").click();
  await page
    .getByLabel("Idea details", { exact: true })
    .fill("Somewhere quiet");
  await button(page, "Turn into Beacon").click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "A staged coffee",
  );
  await button(page, "Back").click();
  await expect(items(page).getByText("Idea · Not scheduled")).toBeVisible();
  await item(page, "A staged coffee").click();
  if (!(await button(page, "Turn into Beacon").isVisible()))
    await item(page, "A staged coffee").click();
  await button(page, "Turn into Beacon").click();
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/coffee");
  await button(page, "Add to Plan").click();
  await expect(
    items(page).getByText("Beacon draft · Unpublished", { exact: true }),
  ).toHaveCount(1);
  await button(page, "Create Plan").click();
  await expect(
    items(page).getByText("Beacon draft · Unpublished", { exact: true }),
  ).toHaveCount(1);
  await button(page, "Schedule Beacons").click();
  await button(page, "Confirm schedule").click();
  await expect(items(page).getByText(/^Beacon · /)).toBeVisible();
  await button(page, "Plan details").click();
  await button(page, "Repeat Plan").click();
  await expect(page.getByTestId("inline-routine-editor")).toBeVisible();
  await button(page, "Monthly").click();
  await expect(
    page.getByText("Upcoming Repeats", { exact: true }),
  ).toBeVisible();
  await button(page, "Save Repeat").click();
  await expect(page.getByText(/Active · Next/)).toBeVisible();
});

test("Ask Group confirms saving a new Plan, then returns after sending", async ({
  page,
}) => {
  await start(page);
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Decide our afternoon");
  await addIdea(page, "Go for a walk");
  await button(page, "Ask Group").click();
  await button(page, "Ping").click();
  await expect(
    page.getByRole("dialog", { name: "Save Plan and continue?" }),
  ).toBeVisible();
  await button(page, "Cancel").click();
  await expect(page).toHaveURL(/plan-editor/);
  await button(page, "Ask Group").click();
  await button(page, "Ping").click();
  await button(page, "Save and continue").click();
  await expect(page).toHaveURL(/planning\/create/);
  await page
    .getByLabel("What’s the idea?", { exact: true })
    .fill("Who wants to bowl?");
  await button(page, "Send Ping").click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(item(page, "Go for a walk")).toBeVisible();
  await expect(item(page, "Who wants to bowl?")).toBeVisible();
});
