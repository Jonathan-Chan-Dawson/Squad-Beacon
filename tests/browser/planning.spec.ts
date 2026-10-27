import { expect, test, type Page } from "@playwright/test";

async function openPlanning(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
}

test("ordinary Council links focus the inbox while explicit management links remain dedicated", async ({
  page,
}) => {
  await page.goto("/council/demo-vote-weekend");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page).toHaveURL(/responses\?threadId=demo-vote-weekend/);
  await expect(
    page
      .getByTestId("decision-row-demo-vote-weekend")
      .getByRole("button", { name: /^Open / }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.goto("/council/demo-vote-weekend?mode=manage");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page).toHaveURL(/council\/demo-vote-weekend\?mode=manage/);
  await expect(
    page.getByRole("button", { name: "Add option", exact: true }),
  ).toBeVisible();
});

test("new same-type drafts use independent sessions", async ({ page }) => {
  await openPlanning(page);
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("button", { name: "Ping", exact: true }).click();
  const first = new URL(page.url()).searchParams.get("sessionId");
  await page
    .getByLabel("What are you thinking?", { exact: true })
    .fill("Keep draft one");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("button", { name: "Ping", exact: true }).click();
  await expect(
    page.getByLabel("What are you thinking?", { exact: true }),
  ).toHaveValue("");
  expect(new URL(page.url()).searchParams.get("sessionId")).not.toBe(first);
});

test("collapsed Ping responses remain changeable and regroup only after filtering", async ({
  page,
}) => {
  await openPlanning(page);
  const row = page.getByTestId("decision-row-demo-ping-jordan");
  await row.getByRole("button", { name: "Interested", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Interested", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(row.getByText(/Change until/)).toBeVisible();
  await row.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Maybe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(row.getByRole("button", { name: /^Open / })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByRole("button", { name: "Pings", exact: true }).click();
  await expect(
    page.getByText("Answered & Active", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Answered & Active", exact: true })
    .click();
  await expect(
    row.getByRole("button", { name: "Maybe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Vote controls submit in place and a resolved Draw shows only its canonical result", async ({
  page,
}) => {
  await openPlanning(page);
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  const vote = page.getByTestId("decision-row-demo-vote-weekend");
  const options = vote.getByRole("radio");
  await options.first().click();
  await expect(options.first()).toHaveAttribute("aria-checked", "true");
  await expect(vote.getByText(/Your vote saved/)).toBeVisible();
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page
      .getByTestId("decision-row-demo-draw-result")
      .getByText("This became a Beacon", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Beacon", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("decision-row-demo-draw-result").locator("[aria-pressed]"),
  ).toHaveCount(0);
});

test("Ping creation uses the focused composer and preserves conversion management", async ({
  page,
}) => {
  await openPlanning(page);
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("button", { name: "Ping", exact: true }).click();
  await page
    .getByLabel("What are you thinking?", { exact: true })
    .fill("Trail after work?");
  await page.getByRole("button", { name: "Anyone Free?", exact: true }).click();
  await expect(
    page.getByLabel("What are you thinking?", { exact: true }),
  ).toHaveValue("Trail after work?");
  await page.getByRole("button", { name: "Create Ping", exact: true }).click();
  await expect(page).toHaveURL(/activity-created/);
  await page.getByRole("button", { name: "Not Now", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Review & Create Beacon",
      exact: true,
    })
    .click();
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByRole("textbox", { name: /Meeting link|Online URL|Online link/i })
    .fill("https://example.com/trail");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
});

test("Council option handoffs keep unsaved edits and publish only after returning", async ({
  page,
}) => {
  await openPlanning(page);
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("button", { name: "Vote", exact: true }).click();
  await page
    .getByLabel("What are we deciding?", { exact: true })
    .fill("Pick a crew plan");
  await page
    .getByLabel("Activity option", { exact: true })
    .nth(0)
    .fill("Basketball");
  await page
    .getByLabel("Activity option", { exact: true })
    .nth(1)
    .fill("Bowling");
  await page
    .getByRole("button", { name: "Edit details: Basketball", exact: true })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Basketball at the park");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByLabel("What are we deciding?", { exact: true }),
  ).toHaveValue("Pick a crew plan");
  await page
    .getByRole("button", { name: "Edit details: Basketball", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Basketball at the park",
  );
  await page
    .getByRole("button", { name: "Save Council Option", exact: true })
    .click();
  await expect(
    page.getByLabel("Activity option", { exact: true }).nth(0),
  ).toHaveValue("Basketball at the park");
  await page
    .getByRole("button", { name: "Create Vote Council", exact: true })
    .click();
  await expect(page).toHaveURL(/activity-created/);
});

for (const width of [320, 390, 430]) {
  test(`inbox fits ${width}px with touch targets and reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openPlanning(page);
    const row = page.getByTestId("decision-row-demo-ping-jordan");
    await row.scrollIntoViewIfNeeded();
    const button = row.getByRole("button", { name: "Interested", exact: true });
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`inbox-${width}.png`),
    });
  });
}
