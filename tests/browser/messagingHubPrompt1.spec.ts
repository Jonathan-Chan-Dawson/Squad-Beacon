import { expect, test, type Page } from "@playwright/test";
import { openConversation } from "./chatHelpers";

async function openHub(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search conversations", exact: true }),
  ).toBeVisible();
}

for (const width of [320, 375, 430])
  test(`compact hub keeps contextual state and all controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openHub(page);
    for (const filter of ["All", "Squads", "Friends", "Unread"])
      await expect(
        page.getByRole("button", { name: filter, exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Private Lists", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Starred", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Your conversations", { exact: true }),
    ).toHaveCount(0);
    const chatUrl = page.url();
    await page
      .getByRole("textbox", { name: "Search conversations", exact: true })
      .fill("training");
    await expect(
      page.getByRole("button", {
        name: "Message The training crew",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Communities", exact: true })
      .click();
    expect(page.url()).toBe(chatUrl);
    await expect(
      page.getByText("Your Communities", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Search communities", exact: true })
      .fill("lake");
    await expect(
      page.getByRole("button", { name: "Explore Communities", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Chats", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Search conversations", exact: true }),
    ).toHaveValue("training");
    await page
      .getByRole("button", { name: "Communities", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Search communities", exact: true }),
    ).toHaveValue("lake");
    await page.getByRole("button", { name: "Chats", exact: true }).click();
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await page.screenshot({ path: `test-results/prompt1-chats-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });

test("Private Lists creates, edits, filters, sends a DM and deletes without changing audiences", async ({
  page,
}) => {
  await openHub(page);
  await page
    .getByRole("button", { name: "Private Lists", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Filter chats by Favorites",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Filter chats by Friends", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create List", exact: true }).click();
  await page
    .getByRole("textbox", { name: "List name", exact: true })
    .fill("Study test");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage Study test", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List name", exact: true })
    .fill("Study Friends");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Jordan Ellis", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove Jordan Ellis", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Filter chats by Study Friends", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Clear Study Friends filter",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Message Maya Chen", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Message Jordan Ellis", exact: true })
    .click();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("Prompt 1 DM test");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(composer).toHaveValue("");
  await expect(page.getByText("Prompt 1 DM test", { exact: true })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Clear Study Friends filter",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Clear Study Friends filter",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Private Lists", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage Study Friends", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete list", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm delete list", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Filter chats by Study Friends",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("Squad composer stays stable, previews are compact and header navigation retains drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openHub(page);
  await openConversation(page, "The training crew");
  await expect(page).toHaveURL(/\/squad-chat\/boxing$/);
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const initial = await composer.boundingBox();
  await composer.fill(
    "A draft\nwith several\nlines of text\nand one more\nand another\nlast line",
  );
  await expect.poll(async () => (await composer.boundingBox())?.height ?? 0).toBeGreaterThan(initial!.height);
  const expanded = await composer.boundingBox();
  expect(expanded!.height).toBeLessThanOrEqual(122);
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", {
      name: "Open Squad profile for The training crew",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(composer).toHaveValue(/A draft/);
  await composer.fill("Prompt 1 Squad test");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(composer).toHaveValue("");
  await expect(
    page
      .getByText("Prompt 1 Squad test", { exact: true })
      .filter({ visible: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Add to chat", exact: true }).click();
  for (const action of ["Ping", "Create Beacon", "Plan"])
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: action, exact: true }),
    ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.screenshot({ path: "test-results/prompt1-squad-chat-320.png" });
});

test("Responses uses the existing actionable flow and community legacy entry lands inside Squads", async ({
  page,
}) => {
  await openHub(page);
  const responses = page.getByRole("button", {
    name: /^Responses & Invitations, \d+ pending$/,
  });
  await expect(responses).toBeVisible();
  await responses.click();
  await expect(page).toHaveURL(/\/responses$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search communities", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore Communities", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Preview / }).first(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/prompt1-communities-390.png" });
});

test("older message history stays anchored while typing and explicit send returns to latest", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openHub(page);
  await openConversation(page, "The training crew");
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  for (let i = 0; i < 10; i++) {
    await composer.fill(
      `History ${i}\nA second line\nAnother line\nMore conversation\nLast line`,
    );
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(composer).toHaveValue("");
  }
  const history = page.getByTestId("chat-history").filter({ visible: true });
  await history.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(
    page.getByRole("button", { name: "Jump to latest messages", exact: true }),
  ).toBeVisible();
  await composer.fill("Reading history without jumping");
  expect(await history.evaluate((element) => element.scrollTop)).toBeLessThan(
    20,
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page
      .getByText("Reading history without jumping", { exact: true })
      .filter({ visible: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/prompt1-message-history.png" });
});

test("compact Ping and Beacon previews open canonical destinations and hide unavailable metadata", async ({
  page,
}) => {
  await openHub(page);
  await openConversation(page, "The training crew");
  const ping = page.getByRole("button", {
    name: "Open ping A quick boxing session?",
    exact: true,
  });
  const bounds = await ping.boundingBox();
  expect(bounds!.height).toBeLessThanOrEqual(80);
  await ping.click();
  await expect(page).toHaveURL(/\/council\//);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("Meet at squadbeacon://activity/a1");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const beacon = page
    .getByRole("button", {
      name: "View Beacon A few rounds. Good company.",
      exact: true,
    })
    .filter({ visible: true });
  await expect(beacon).toBeVisible();
  await beacon.click();
  await expect(page).toHaveURL(/\/activity\/a1$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await composer.fill("squadbeacon://activity/unauthorized-test");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page
      .getByText("Beacon unavailable", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
});

test("legacy Communities and explicit Squad Ping URLs retain their destinations", async ({ page }) => {
  await page.goto("/communities");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByRole("textbox", { name: "Search communities", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/squads\?section=Communities$/);
  await page.goto("/squad-chat/boxing?ping=demo-squad-ping-boxing");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByRole("button", { name: "Open ping A quick boxing session?", exact: true })).toBeInViewport();
  await expect(page).toHaveURL(/\/squad-chat\/boxing\?ping=demo-squad-ping-boxing$/);
});
