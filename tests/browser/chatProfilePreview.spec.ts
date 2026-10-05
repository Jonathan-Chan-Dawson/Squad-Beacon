import { expect, test, type Page } from "@playwright/test";
import { openConversation } from "./chatHelpers";

async function chats(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
}

test("Friend chat header opens a compact profile and an inline Beacon preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/Text strings must be rendered/.test(message.text()))
      errors.push(message.text());
  });
  await chats(page);
  await openConversation(page, "Jordan Ellis");
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "View Jordan Ellis's profile", exact: true })
    .click();
  const preview = page.getByRole("dialog");
  await expect(preview).toHaveCount(1);
  await expect(
    preview.getByText("Jordan Ellis", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/friend-chat-preview-390.png" });
  const star = preview.getByRole("button", { name: /^(Unstar|Star)$/ });
  const wasStarred = (await star.getAttribute("aria-label")) === "Unstar";
  await star.click();
  await expect(
    preview.getByRole("button", {
      name: wasStarred ? "Star" : "Unstar",
      exact: true,
    }),
  ).toBeEnabled();
  await preview
    .getByRole("button", {
      name: "Current Beacon: A few rounds. Good company.",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    preview.getByText("Chicago Boxing Club", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Open full Beacon", exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: "Back to profile", exact: true })
    .click();
  await preview
    .getByRole("button", { name: "View Full Profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/person\/jordan\/?$/);
  expect(errors).toEqual([]);
});

test("Squad chat header shows current and next Beacons, then the full Squad profile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/Text strings must be rendered/.test(message.text()))
      errors.push(message.text());
  });
  await chats(page);
  await openConversation(page, "The training crew");
  await page
    .getByRole("button", {
      name: "Open Squad profile for The training crew",
      exact: true,
    })
    .click();
  const preview = page.getByRole("dialog");
  await expect(preview).toHaveCount(1);
  await expect(
    preview.getByRole("button", { name: "Open Squad chat", exact: true }),
  ).toHaveCount(0);
  await expect(
    preview.getByRole("button", {
      name: "Preview Organization Lakefront Collective",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", { name: /Current Beacon/ }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: /Next Beacon|Upcoming Beacon/ })
    .filter({ visible: true })
    .click();
  await expect(
    preview.getByText("Walk planning with the crew", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await preview
    .getByRole("button", { name: "Back to Squad", exact: true })
    .click();
  await page.screenshot({ path: "test-results/squad-chat-preview-320.png" });
  await preview
    .getByRole("button", { name: /View full Squad Profile/i })
    .click();
  await expect(page).toHaveURL(/\/squad\/boxing\/?$/);
  for (const name of ["Overview", "Members", "Activity", "Settings"]) {
    await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("tab", { name: "Members", exact: true }).click();
  await expect(
    page.getByText("Jordan Ellis", { exact: true }).last(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/squad-members-320.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Squad preview links open the connected Organization and a Squad-scoped Ping", async ({
  page,
}) => {
  await chats(page);
  const header = () =>
    page.getByRole("button", {
      name: "Open Squad profile for The training crew",
      exact: true,
    });
  await openConversation(page, "The training crew");
  await header().click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Preview Organization Lakefront Collective",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/squad-chat\/boxing/);
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "View full organization profile",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/organization\/org-lakefront-collective\/?$/);
  await page.goBack();
  await header().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ping", exact: true })
    .click();
  await expect(
    page.getByText("Shared with The training crew", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "friends", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Question or decision", { exact: true })
    .fill("Crew coffee after training?");
  await page
    .getByRole("button", { name: "Create ping or decision", exact: true })
    .click();
  await expect(page).toHaveURL(/\/council\//);
  await expect(
    page.getByText("Crew coffee after training?", { exact: true }).last(),
  ).toBeVisible();
});
