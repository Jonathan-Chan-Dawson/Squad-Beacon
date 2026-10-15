import { expect, test, type Page } from "@playwright/test";

async function openSquads(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search conversations", exact: true }),
  ).toBeVisible();
}

test("Squads keeps chat filters reachable and community pages aligned after resizing", async ({
  page,
}) => {
  await openSquads(page);
  await expect(
    page.getByRole("textbox", { name: "Search conversations" }),
  ).toBeVisible();
  for (const filter of ["All", "Squads", "Friends", "Unread"]) {
    await expect(
      page.getByRole("button", { name: filter, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await expect(
    page.getByText("Your Communities", { exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(
    page.getByText("Your Communities", { exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Chats", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unread", exact: true }),
  ).toBeVisible();
});

test("Start Chat inserts an opener before sending and preserves the canonical message", async ({
  page,
}) => {
  await openSquads(page);
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search conversations", exact: true })
    .fill("Maya");
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
