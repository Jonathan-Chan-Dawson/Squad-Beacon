import { expect, test, type Page } from "@playwright/test";

async function chats(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Responses & Invitations, \d+ pending/ }),
  ).toBeVisible();
}

test("Chats has one compact response row and a full-screen filtered inbox", async ({
  page,
}) => {
  await chats(page);
  await expect(page.getByTestId(/^planning-prompt-/)).toHaveCount(0);
  await page.screenshot({ path: "test-results/planning-chats-390.png" });
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  await expect(page).toHaveURL(/\/responses/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Decisions", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", {
      name: "Open Which weekend plan sounds best?",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/responses/);
  await expect(
    page.getByRole("button", {
      name: "Open Which weekend plan sounds best?",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "Resolve vote", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add option", exact: true }).click();
  await page
    .getByRole("button", { name: "Use Beacon editor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/create\?.*threadId=demo-vote-weekend/);
});

test("Interested After saves availability independently and allows removal", async ({
  page,
}) => {
  await chats(page);
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  await page.getByRole("button", { name: "Pings", exact: true }).click();
  await page
    .getByRole("button", { name: /^Open / })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Interested After…", exact: true })
    .click();
  await page.getByRole("button", { name: "In one hour", exact: true }).click();
  await page
    .getByRole("button", { name: "Save Interested", exact: true })
    .click();
  await expect(page.getByText(/^Available after /)).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Auto-RSVP/ }),
  ).toHaveAttribute("aria-checked", "false");
  await page
    .getByRole("button", { name: "Interested After…", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Interested now", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Interested", exact: true })
    .click();
  await expect(
    page.getByText(/Your response: interested.*Change until/),
  ).toBeVisible();
});

test("small-phone inbox and New Message keep conversations accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await chats(page);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page.getByRole("button", { name: "New message", exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Search conversations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Message / }).first(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/planning-chats-320.png" });
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  await expect(page).toHaveURL(/\/responses/);
  await page.screenshot({ path: "test-results/planning-inbox-320.png" });
});
