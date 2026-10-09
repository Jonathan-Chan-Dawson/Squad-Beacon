import { expect, test, type Page } from "@playwright/test";

async function openSquads(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
}

test("Squads keeps chat filters reachable and community pages aligned after resizing", async ({
  page,
}) => {
  await openSquads(page);
  await page
    .getByRole("button", { name: "Search conversations", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Search chats, people and communities" }),
  ).toBeVisible();
  for (const filter of ["All", "Squads", "Friends", "Unread", "Starred"]) {
    await expect(
      page.getByRole("button", { name: filter, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await expect(
    page.getByText("My communities", { exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(
    page.getByText("My communities", { exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Chats", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Starred", exact: true }),
  ).toBeVisible();
});

test("Start a chat separates profile and message targets, and openers insert before send", async ({
  page,
}) => {
  await openSquads(page);
  await page
    .getByRole("button", { name: "Expand Start a chat", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open profile Maya Chen", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/\/messages\//);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Message Maya Chen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/messages\/maya$/);
  await expect(
    page.getByText("Start with a hello", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Insert: Want to make a plan?", exact: true })
    .click();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await expect(composer).toHaveValue("Want to make a plan?");
  await expect(
    page.getByText("Start with a hello", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(composer).toHaveValue("");
  await expect(
    page.getByText("Want to make a plan?", { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText("Start with a hello", { exact: true }),
  ).toHaveCount(0);
  await page.goBack();
  await page
    .getByRole("button", { name: "Message Maya Chen", exact: true })
    .click();
  await expect(
    page.getByText("Want to make a plan?", { exact: true }),
  ).toHaveCount(1);
});
