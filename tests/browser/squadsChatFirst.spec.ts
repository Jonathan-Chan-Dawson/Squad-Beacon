import { expect, test, type Page } from "@playwright/test";
import { openConversation } from "./chatHelpers";

async function squads(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
}

test("Squads stays chat-first and search is temporary at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await squads(page);
  await expect(
    page.getByRole("button", { name: "Chats", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Communities", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByText("Demo · Sample people and plans", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^All responses & invitations/ }),
  ).toHaveCount(0);
  const conversation = page.getByRole("button", {
    name: "Message The training crew",
    exact: true,
  });
  await expect(conversation).toBeInViewport();
  const bounds = await conversation.boundingBox();
  expect(bounds!.y).toBeLessThan(450);
  await page.screenshot({ path: "test-results/squads-chat-first-320.png" });
  await page
    .getByRole("button", { name: "Search conversations", exact: true })
    .click();
  const search = page.getByRole("textbox", {
    name: "Search people, Beacons, Squads and communities",
    exact: true,
  });
  await search.fill("Jordan");
  await expect(
    page.getByRole("button", { name: "Message Jordan Ellis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Starred", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await expect(search).toHaveCount(0);
  await expect(conversation).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Starred", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /^Open profile Jordan Ellis/ })
    .first()
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "View Full Profile", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/squads/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Create Space works independently, then connects a Squad without creating an Organization", async ({
  page,
}) => {
  await squads(page);
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  let sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("button", { name: "Create organization", exact: true }),
  ).toHaveCount(0);
  await sheet
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  sheet = page.getByRole("dialog");
  await sheet
    .getByRole("textbox", { name: "Space name", exact: true })
    .fill("Weekend circle test");
  await sheet
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "View full Space profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/space\//);
  await expect(
    page.getByText("Weekend circle test", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect Squad", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Connect The training crew", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Message The training crew",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Invite people", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Invite Jordan Ellis", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Invite Jordan Ellis", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.screenshot({ path: "test-results/space-overview-390.png" });
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Communities", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Preview Space Weekend circle test",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Preview Lakefront Collective/ }),
  ).toBeVisible();
});

test("Squad composer keeps activity actions in its plus menu", async ({
  page,
}) => {
  await squads(page);
  await openConversation(page, "The training crew");
  await expect(
    page.getByRole("button", { name: "Ping", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add to Squad chat", exact: true })
    .click();
  const menu = page.getByRole("dialog");
  for (const action of [
    "Ping",
    "Create Beacon",
    "Create Beacon Plan",
    "Invite a person",
  ]) {
    await expect(
      menu.getByRole("button", { name: action, exact: true }),
    ).toBeVisible();
  }
  await expect(menu.getByRole("button", { name: /^(Photo|GIF)$/ })).toHaveCount(
    0,
  );

  const returnToChat = async () => {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.goBack();
    await expect(page).toHaveURL(/\/squad-chat\/boxing/);
    await expect(
      page.getByRole("button", { name: "Add to Squad chat", exact: true }),
    ).toBeVisible();
  };
  const openComposerAction = async (action: string) => {
    await page
      .getByRole("button", { name: "Add to Squad chat", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: action, exact: true })
      .click();
  };

  await menu.getByRole("button", { name: "Ping", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Question or decision", exact: true }),
  ).toBeVisible();
  await returnToChat();

  await openComposerAction("Ping");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Question or decision", exact: true }),
  ).toBeVisible();
  await returnToChat();

  await openComposerAction("Create Beacon Plan");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Plan name", exact: true }),
  ).toBeVisible();
  await returnToChat();

  await openComposerAction("Create Beacon Plan");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Plan name", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Shared with The training crew", {
      exact: true,
    }),
  ).toBeVisible();
});

test("a response prompt jumps to its exact Squad Ping and shares its response state", async ({
  page,
}) => {
  await squads(page);
  const prompt = page.getByTestId("planning-prompt-demo-squad-ping-boxing");
  if (!(await prompt.count())) {
    await page
      .getByRole("button", {
        name: "See all responses and invitations",
        exact: true,
      })
      .click();
  }
  await page
    .getByRole("button", { name: /^A quick boxing session\?,/ })
    .click();
  await expect(page).toHaveURL(
    /\/squad-chat\/boxing\?ping=demo-squad-ping-boxing/,
  );
  const card = page.getByLabel("Squad Ping: A quick boxing session?", {
    exact: true,
  });
  await expect(card).toBeInViewport();
  await card.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(card).toContainText(/You said Maybe/i);
  await page.goBack();
  await expect(
    page.getByTestId("planning-prompt-demo-squad-ping-boxing"),
  ).toHaveCount(0);
});
