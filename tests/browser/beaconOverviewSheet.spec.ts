import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

async function openSheet(page: Page, id = "demo-tools") {
  await page.goto(`/?beacon=${encodeURIComponent(id)}`);
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByTestId("map-tooltip-card")
    .getByRole("button", { name: "See overview", exact: true })
    .click();
  const panel = page.getByTestId("map-panel");
  await expect(panel).toBeVisible();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return box!.y + box!.height;
    })
    .toBeLessThanOrEqual(page.viewportSize()!.height);
  return panel;
}

test("many modules have top sub-tabs and preserve module scroll and drafts", async ({
  page,
}) => {
  const panel = await openSheet(page);
  await expect(panel.getByRole("tab")).toHaveText([
    "Overview",
    "Tools",
    "Chat",
    "People",
  ]);
  await panel.getByRole("tab", { name: "Tools", exact: true }).click();
  const pinnedY = (await panel
    .getByTestId("beacon-activity-subtabs")
    .boundingBox())!.y;
  await expect(
    panel.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
  const item = panel.getByLabel("Add a checklist item");
  await expect(
    panel.getByLabel("New checklist section", { exact: true }),
  ).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Checklist options", exact: true })
    .click();
  await expect(
    panel.getByLabel("New checklist section", { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Checklist options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Collapse checklist", exact: true })
    .click();
  await expect(item).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Expand checklist", exact: true })
    .click();
  await item.fill("Sheet draft");
  const content = panel.getByTestId("beacon-sheet-content");
  await expect(
    panel.getByTestId("beacon-activity-subtabs").getByRole("tab"),
  ).toHaveText(["Checklist", "Focus Timer", "Sketchboard", "Memories"]);
  const activityScroll = await content.evaluate((element) => element.scrollTop);
  await panel.getByRole("tab", { name: "Sketchboard", exact: true }).click();
  await expect(panel.getByLabel("Your note")).toBeVisible();
  await panel.getByRole("tab", { name: "Checklist", exact: true }).click();
  await expect(item).toHaveValue("Sheet draft");
  await expect
    .poll(() => content.evaluate((element) => element.scrollTop))
    .toBeCloseTo(activityScroll, 0);
  await panel.getByRole("tab", { name: "Focus Timer", exact: true }).click();
  await panel.getByRole("button", { name: "Start timer", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await panel.getByTestId("beacon-activity-subtabs").boundingBox())!.y,
    )
    .toBeCloseTo(pinnedY, 0);
  await content.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/beacon-sheet-timer-390.png" });
  await panel.getByRole("tab", { name: "Checklist", exact: true }).click();
  await panel
    .getByRole("button", { name: "Collapse Beacon sheet", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Open Beacon overview", exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Open Beacon overview", exact: true })
    .click();
  await expect(item).toHaveValue("Sheet draft");
  await expect(
    panel.getByRole("tab", { name: "Tools", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reduce Beacon sheet", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/beacon-sheet-many-390.png" });
  await page
    .getByTestId("beacon-sheet-dismiss-area")
    .click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId("map-tooltip-card")).toBeVisible();
});

for (const width of [320, 390]) {
  test(`tool pills stay in one pinned row and restore selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const panel = await openSheet(page);
    await panel.getByRole("tab", { name: "Tools", exact: true }).click();
    const switcher = panel.getByTestId("beacon-activity-subtabs");
    const ys = await switcher
      .getByRole("tab")
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().y),
      );
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1);
    await switcher.getByRole("tab", { name: "Memories", exact: true }).click();
    await expect(switcher.getByRole("tab").first()).toHaveAccessibleName(
      "Memories",
    );
    const pill = await switcher
      .getByRole("tab", { name: "Memories", exact: true })
      .boundingBox();
    expect(pill!.x).toBeGreaterThanOrEqual(0);
    expect(pill!.x + pill!.width).toBeLessThanOrEqual(width);
    const rowY = (await switcher.boundingBox())!.y;
    await panel.getByTestId("beacon-sheet-content").evaluate((element) => {
      element.scrollTop = 180;
    });
    expect((await switcher.boundingBox())!.y).toBe(rowY);
    await expect(
      panel.getByRole("button", { name: "Close Beacon panel", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `test-results/beacon-tools-${width}.png` });
    await page
      .getByTestId("beacon-sheet-dismiss-area")
      .click({ position: { x: 5, y: 5 } });
    await page
      .getByTestId("map-tooltip-card")
      .getByRole("button", { name: "See overview", exact: true })
      .click();
    await panel.getByRole("tab", { name: "Tools", exact: true }).click();
    await expect(
      panel.getByRole("tab", { name: "Memories", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  });
}

test("horizontal content gestures switch tools in both directions", async ({
  page,
}) => {
  const panel = await openSheet(page);
  await panel.getByRole("tab", { name: "Tools", exact: true }).click();
  const content = panel.getByTestId("beacon-sheet-content");
  const box = (await content.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  const swipe = async (start: number, end: number) => {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start, y: box.y + 25 }],
    });
    for (let step = 1; step <= 12; step++)
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: start + ((end - start) * step) / 12, y: box.y + 25 },
        ],
      });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  await swipe(box.x + box.width - 5, box.x + 70);
  await expect(
    panel.getByRole("tab", { name: "Focus Timer", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect
    .poll(async () => (await content.boundingBox())!.x)
    .toBeCloseTo(box.x, 0);
  await swipe(box.x + 5, box.x + box.width - 70);
  await expect(
    panel.getByRole("tab", { name: "Checklist", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("compact Game and Teams sections reuse scoring and membership actions", async ({
  page,
}) => {
  const panel = await openSheet(page);
  await panel.getByRole("button", { name: "Beacon menu", exact: true }).click();
  await panel
    .getByRole("button", { name: "Host controls", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Expand Tools options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Teams / Scoreboard: On", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await panel.getByRole("tab", { name: "Tools", exact: true }).click();
  await panel.getByRole("tab", { name: "Game", exact: true }).click();
  await panel.getByRole("button", { name: "Manage game", exact: true }).click();
  for (const name of ["Blue", "Red"]) {
    await panel.getByLabel(/^New team name/).fill(name);
    await panel
      .getByRole("button", { name: "Create team", exact: true })
      .click();
    await expect(panel.getByText(name, { exact: true })).toBeVisible();
  }
  await panel
    .getByRole("button", { name: "Close game settings", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Add one point to Blue", exact: true })
    .click();
  await expect(panel.getByLabel("Blue score 1", { exact: true })).toBeVisible();
  await panel.getByTestId("beacon-sheet-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/beacon-sheet-game-390.png" });
  await panel.getByRole("tab", { name: "Teams", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Join team", exact: true }).first(),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Join team", exact: true })
    .first()
    .click();
  await expect(
    panel.getByRole("button", { name: "Leave team", exact: true }),
  ).toBeVisible();
  await panel.getByRole("tab", { name: "Game", exact: true }).click();
  await expect(panel.getByLabel("Blue score 1", { exact: true })).toBeVisible();
});

test("zero, one and two modules adapt without module launch grids", async ({
  page,
}) => {
  const panel = await openSheet(page);
  await panel.getByRole("button", { name: "Beacon menu", exact: true }).click();
  await panel
    .getByRole("button", { name: "Host controls", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Expand Tools options", exact: true })
    .click();
  for (const name of ["Checklist", "Beacon Sketchboard", "Timer"]) {
    await panel
      .getByRole("button", { name: `${name}: Off`, exact: true })
      .click();
  }
  await panel
    .getByRole("button", { name: "Expand Social options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Beacon Memories: Off", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(panel.getByRole("tab")).toHaveText([
    "Overview",
    "Chat",
    "People",
  ]);
  await expect(
    panel.getByRole("button", { name: "Open shared music link", exact: true }),
  ).toHaveCount(0);

  await panel.getByRole("button", { name: "Beacon menu", exact: true }).click();
  await panel
    .getByRole("button", { name: "Host controls", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Expand Media options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Music link: On", exact: true })
    .click();
  await panel
    .getByLabel("Music or playlist URL", { exact: true })
    .fill("https://open.spotify.com/playlist/example");
  await panel
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(panel.getByRole("tab")).toHaveText([
    "Overview",
    "Chat",
    "People",
  ]);
  await expect(
    panel.getByRole("button", { name: "Open shared music link", exact: true }),
  ).toBeVisible();
  await expect(panel).toContainText("Opens externally");

  await panel.getByRole("button", { name: "Beacon menu", exact: true }).click();
  await panel
    .getByRole("button", { name: "Host controls", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Expand Tools options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Checklist: On", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await panel.getByRole("tab", { name: "Tools", exact: true }).click();
  await expect(
    panel.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Add item", exact: true }),
  ).toBeVisible();
  await panel
    .getByLabel("Add a checklist item", { exact: true })
    .fill("Bring picnic blanket");
  await panel.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    panel.getByRole("checkbox", {
      name: "Check Bring picnic blanket",
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole("checkbox", { name: "Check Bring picnic blanket", exact: true })
    .click();
  await expect(
    panel.getByRole("checkbox", {
      name: "Uncheck Bring picnic blanket",
      exact: true,
    }),
  ).toHaveAttribute("aria-checked", "true");

  await panel.getByRole("button", { name: "Beacon menu", exact: true }).click();
  await panel
    .getByRole("button", { name: "Host controls", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Expand Tools options", exact: true })
    .click();
  await panel.getByRole("button", { name: "Timer: On", exact: true }).click();
  await panel
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    panel.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText("Timer", { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Start timer", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Pause timer", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Add item", exact: true }),
  ).toBeVisible();
});

test("320px tabs fit and People profiles return inside the same sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const panel = await openSheet(page);
  await panel.getByRole("tab", { name: "People", exact: true }).click();
  await panel
    .getByRole("button", { name: /Open .* profile/ })
    .first()
    .click();
  await expect(panel.getByTestId("map-person-preview")).toBeVisible();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    panel.getByRole("tab", { name: "People", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const tabs = await panel.getByRole("tablist").boundingBox();
  expect(tabs!.x).toBeGreaterThanOrEqual(0);
  expect(tabs!.x + tabs!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "test-results/beacon-sheet-people-320.png" });
});

test("upcoming preparation becomes a live Game and then a recap", async ({
  page,
}) => {
  await page.clock.install();
  const panel = await openSheet(page);
  await panel.getByRole("button", { name: "Beacon menu", exact: true }).click();
  await panel
    .getByRole("button", { name: "Host controls", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Expand Tools options", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Teams / Scoreboard: On", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(panel.getByText("Getting ready", { exact: true })).toBeVisible();
  await panel.getByRole("tab", { name: "Tools", exact: true }).click();
  await page.clock.fastForward(86400000 + 60000);
  await expect(
    panel.getByRole("tab", { name: "Game", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByText("Live Game", { exact: true })).toBeVisible();
  await page.clock.fastForward(3600000);
  await panel.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(panel.getByText("Beacon recap", { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Repeat Beacon", exact: true }),
  ).toBeVisible();
  await panel.getByRole("tab", { name: "Tools", exact: true }).click();
  await expect(
    panel.getByRole("tab", { name: "Memories", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    panel.getByText("Beacon Memories", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("tab", { name: "Overview", exact: true }).click();
  await panel.getByRole("button", { name: /Comments/, exact: false }).click();
  await page.keyboard.press("Escape");
  await expect(
    panel.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("linked Draw decision opens with Back inside the existing sheet", async ({
  page,
}) => {
  const panel = await openSheet(page, "demo-draw-beacon");
  await panel
    .getByRole("button", { name: "View Draw decision", exact: true })
    .click();
  await expect(
    panel.getByText("Beacon options", { exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/council\//);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    panel.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await panel
    .getByRole("button", { name: "View Draw decision", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Show Suggested Beacons", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  const context = page.getByRole("button", { name: /^Remove Draw:/ });
  await expect(context).toBeVisible();
  await context.click();
  await expect(context).toHaveCount(0);
});

test("RSVP and Beacon chat keep canonical state across tabs", async ({
  page,
}) => {
  const panel = await openSheet(page, "neighborhood-6");
  const join = panel.getByRole("button", { name: "I'm In", exact: true });
  if (await join.count()) await join.click();
  await expect(
    panel.getByRole("button", { name: "I'm Out", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Arriving", exact: true }).click();
  await panel.getByRole("tab", { name: "People", exact: true }).click();
  await expect(panel.getByText("On my way", { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Arriving · selected", exact: true }),
  ).toBeVisible();
  await panel.getByRole("tab", { name: "Chat", exact: true }).click();
  await panel.getByLabel("Message", { exact: true }).fill("Draft for later");
  await panel.getByRole("button", { name: "Expand chat", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Reduce chat", exact: true }),
  ).toBeVisible();
  await expect(panel.getByLabel("Message", { exact: true })).toHaveValue(
    "Draft for later",
  );
  await panel
    .getByRole("button", { name: "Choose emoji", exact: true })
    .click();
  await panel.getByRole("button", { name: "Insert 👋", exact: true }).click();
  await expect(panel.getByLabel("Message", { exact: true })).toHaveValue(
    "Draft for later👋",
  );
  await panel.getByRole("tab", { name: "People", exact: true }).click();
  await panel
    .getByRole("button", { name: /Open .* profile/ })
    .first()
    .click();
  await expect(panel.getByTestId("map-person-preview")).toBeVisible();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await panel.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(panel.getByLabel("Message", { exact: true })).toHaveValue(
    "Draft for later👋",
  );
  await panel
    .getByLabel("Message", { exact: true })
    .fill("See you on the court👋");
  await panel
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(
    panel.getByText("See you on the court👋", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/beacon-chat-expanded-390.png" });
  await panel.getByRole("button", { name: "Add to chat", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Back to chat", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Back to chat", exact: true })
    .click();
  await panel.getByRole("tab", { name: "Overview", exact: true }).click();
  await panel.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(
    panel.getByText("See you on the court👋", { exact: true }),
  ).toBeVisible();
});
