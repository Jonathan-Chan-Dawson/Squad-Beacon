import { expect, test, type Page } from "@playwright/test";
import { openConversation } from "./chatHelpers";

async function chats(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
}

test("Friend chat header opens the full profile, compact actions and privacy controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await chats(page);
  await page
    .getByRole("button", { name: "Expand Start a chat", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Message Jordan Ellis", exact: true })
    .click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Keep my friend draft");
  await page
    .getByRole("button", { name: "View Jordan Ellis's profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/person\/jordan\/?$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Report account", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Block account", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "More", exact: true }),
  ).toHaveCount(0);
  const message = await page
    .getByRole("button", { name: "Message", exact: true })
    .boundingBox();
  expect(message!.height).toBeGreaterThanOrEqual(44);
  expect(message!.height).toBeLessThanOrEqual(48);
  expect(message!.width).toBeLessThan(180);
  const star = page.getByRole("button", { name: /^(Unstar|Star)$/ });
  const starred = (await star.getAttribute("aria-label")) === "Unstar";
  await star.click();
  await expect(
    page.getByRole("button", {
      name: starred ? "Star" : "Unstar",
      exact: true,
    }),
  ).toBeEnabled();
  await page.screenshot({ path: "test-results/person-profile-390.png" });
  await page.getByRole("button", { name: "See all connections", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "The training crew", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Neighborhood Studio", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove friendship", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm remove friendship", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  // Closing confirmation returns to friendship management; close it without removing anyone.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Safety & Privacy", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Report account", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Block account", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.goBack();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Keep my friend draft",
  );
  expect(errors).toEqual([]);
});

test("Squad header opens compact info with member navigation and Back to the draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await chats(page);
  await openConversation(page, "The training crew");
  await page.getByLabel("Message", { exact: true }).fill("Keep my Squad draft");
  await page
    .getByRole("button", { name: "View Jordan Ellis's profile", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/person\/jordan/);
  await page.goBack();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Keep my Squad draft",
  );
  await page
    .getByRole("button", {
      name: "Open Squad profile for The training crew",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/squad\/boxing.*fromChat=yes/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const name of ["Overview", "Members", "Activity", "Settings"]) {
    await expect(page.getByRole("tab", { name, exact: true })).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: /^(Chat|Squad chat|Open Squad chat)$/ }),
  ).toHaveCount(0);
  const ping = await page
    .getByRole("button", { name: "Ping", exact: true })
    .boundingBox();
  expect(ping!.height).toBeGreaterThanOrEqual(44);
  expect(ping!.width).toBeLessThan(150);
  await page.screenshot({ path: "test-results/squad-info-320.png" });
  await page
    .getByRole("button", { name: "See all members", exact: true })
    .click();
  await expect(page).toHaveURL(/tab=Members/);
  await expect(
    page.getByText("Jordan Ellis", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Ping", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Keep my Squad draft",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Squad info retains the related community and scoped Ping creation", async ({
  page,
}) => {
  await chats(page);
  await openConversation(page, "The training crew");
  await page
    .getByRole("button", {
      name: "Open Squad profile for The training crew",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Open super-organization Lakefront Collective",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/organization\/org-lakefront-collective/);
  await page.goBack();
  await page.getByRole("button", { name: "Ping", exact: true }).click();
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
