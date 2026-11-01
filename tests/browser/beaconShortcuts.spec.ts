import { test, expect, type Page } from "@playwright/test";

async function enter(page: Page, route: string, appearance: "light" | "dark") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((value) => {
    localStorage.setItem("beacon.appearance", value);
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    );
  }, appearance);
  await page.goto(route);
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  await expect(demo).toBeVisible();
  await expect
    .poll(
      () =>
        demo.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90000 },
    )
    .toBe(true);
  await demo.click();
  await expect(demo).toHaveCount(0);
}

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 375, 390, 430, 1024]) {
    test(`personal Beacon shortcuts ${width}px ${appearance}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await enter(page, "/your-activity", appearance);
      const card = page.getByTestId("beacon-feed-card-demo-you-showcase-live");
      const shortcuts = card.getByTestId(
        "beacon-shortcuts-demo-you-showcase-live",
      );
      await expect(shortcuts).toBeVisible();
      for (const name of [/^Open .+ chat$/, /^Beacon tools/]) {
        const button = shortcuts.getByRole("button", { name });
        await expect(button).toBeVisible();
        const bounds = await button.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await card.screenshot({
        path: `docs/screenshots/card-context-social-2026-10-31/${appearance}-${width}-activity.png`,
      });
      await expect(
        card.getByRole("button", { name: /^React to / }),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: /^Comments on / }),
      ).toBeVisible();
      await expect(card.getByText("React", { exact: true })).toBeVisible();
      await expect(card.getByText("Comments", { exact: true })).toBeVisible();
      await expect(
        shortcuts.getByRole("button", { name: /^Beacon tools/ }),
      ).toBeVisible();
      if (width === 430) {
        await card
          .getByRole("button", { name: "More Beacon actions", exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "View on Map", exact: true })
          .click();
        await expect(page.getByTestId("map-tooltip-card")).toBeVisible();
        await page.goBack();
        await expect(card).toBeVisible();
      }
      if (width === 390) {
        await shortcuts.getByRole("button", { name: /^Beacon tools/ }).click();
        const tools = page.getByRole("dialog", {
          name: "Beacon tools",
          exact: true,
        });
        await expect(
          tools.getByText("Collaboration", { exact: true }),
        ).toBeVisible();
        await tools
          .getByRole("button", { name: "Memories", exact: true })
          .click();
        await expect(page).toHaveURL(/tool=experiences/);
        await page.goBack();
        await expect(card).toBeVisible();
        await shortcuts.getByRole("button", { name: /^Open .+ chat$/ }).click();
        await expect(page).toHaveURL(/activity\/.*tab=chat/);
      }
    });
  }
  for (const width of [320, 390, 430, 1024]) {
    test(`Map preview offers authorized shortcuts without moving its camera ${width}px ${appearance}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 844 });
      await enter(page, "/", appearance);
      const search = page.getByRole("textbox", {
        name: "Search places, Beacons, people and communities",
        exact: true,
      });
      await search.fill("Plan stop 1: Coffee together");
      await page
        .getByTestId("map-search-results")
        .getByRole("button", {
          name: "Open Plan stop 1: Coffee together Beacon",
          exact: true,
        })
        .click();
      const preview = page.getByTestId("map-tooltip-card");
      await expect(preview).toBeVisible();
      const shortcuts = preview.getByTestId("beacon-shortcuts-map-plan-coffee");
      const contextBounds = (await preview.getByTestId("map-beacon-context").boundingBox())!;
      const cardBounds = (await preview.boundingBox())!;
      expect(contextBounds.height).toBeGreaterThanOrEqual(44);
      expect(contextBounds.width).toBeGreaterThanOrEqual(cardBounds.width - 24);
      expect(contextBounds.x + contextBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width);
      const reactBounds = (await preview.getByRole("button", { name: /^React to / }).boundingBox())!;
      const commentsBounds = (await preview.getByRole("button", { name: /^Comments on / }).boundingBox())!;
      expect(commentsBounds.x - reactBounds.x - reactBounds.width).toBeGreaterThanOrEqual(8);
      await expect(
        preview.getByRole("heading", { name: "Coffee together", exact: true }),
      ).toBeVisible();
      await expect(
        preview.getByText("Plan stop 1", { exact: false }).first(),
      ).toBeVisible();
      await expect(
        preview
          .getByTestId("map-beacon-context")
          .getByRole("button", { name: /^Open Plan/ }),
      ).toBeVisible();
      await expect(
        preview.getByRole("button", { name: /^Beacon tools/ }),
      ).toContainText("Tools");
      await expect(
        preview.getByRole("button", { name: /^React to / }),
      ).toBeVisible();
      await expect(
        shortcuts.getByRole("button", { name: /^Open .+ chat$/ }),
      ).toBeVisible();
      await expect(
        preview.getByRole("button", { name: /^React to / }),
      ).toBeInViewport({ ratio: 1 });
      await expect(
        shortcuts.getByRole("button", { name: /^Open .+ chat$/ }),
      ).toBeInViewport({ ratio: 1 });
      await expect(
        shortcuts.getByRole("button", { name: /^View .+ on map$/ }),
      ).toHaveCount(0);
      await expect(
        preview.getByTestId("discovery-card-actions"),
      ).toBeInViewport({ ratio: 1 });
      const scrollBounds = await preview.evaluate((node) => {
        let parent = node.parentElement;
        while (
          parent &&
          !["auto", "scroll"].includes(getComputedStyle(parent).overflowY)
        )
          parent = parent.parentElement;
        return parent
          ? { height: parent.clientHeight, content: parent.scrollHeight }
          : null;
      });
      expect(scrollBounds).not.toBeNull();
      expect(scrollBounds!.content - scrollBounds!.height).toBeLessThanOrEqual(
        1,
      );
      const reactionBounds = await preview
        .getByRole("button", { name: /^React to / })
        .boundingBox();
      const chatBounds = await shortcuts
        .getByRole("button", { name: /^Open .+ chat$/ })
        .boundingBox();
      const primaryBounds = await preview
        .getByTestId("discovery-card-actions")
        .boundingBox();
      expect(reactionBounds!.x).toBeLessThan(chatBounds!.x);
      expect(Math.abs(primaryBounds!.y - chatBounds!.y)).toBeLessThanOrEqual(2);
      expect(primaryBounds!.height).toBeGreaterThanOrEqual(44);
      const camera = await page
        .locator(".leaflet-map-pane")
        .getAttribute("style");
      await preview.screenshot({
        path: `docs/screenshots/card-context-social-2026-10-31/${appearance}-${width}-map.png`,
      });
      await preview
        .getByRole("button", { name: /^Beacon tools|^More Beacon actions/ })
        .click();
      await expect(
        page.getByRole("dialog", {
          name: "Beacon tools & actions",
          exact: true,
        }),
      ).toBeVisible();
      const toolsMenu = page.getByRole("dialog", {
        name: "Beacon tools & actions",
        exact: true,
      });
      const menuBounds = await toolsMenu.boundingBox();
      expect(menuBounds!.height).toBeLessThanOrEqual(380);
      await toolsMenu.screenshot({
        path: `docs/screenshots/card-context-social-2026-10-31/${appearance}-${width}-tools.png`,
      });
      await page.keyboard.press("Escape");
      await expect(preview).toBeVisible();
      const toolsTrigger = preview.getByRole("button", {
        name: /^Beacon tools|^More Beacon actions/,
      });
      await expect(toolsTrigger).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(toolsMenu).toBeVisible();
      await page
        .getByRole("button", {
          name: "Dismiss Beacon tools & actions",
          exact: true,
        })
        .click({ position: { x: 2, y: 2 } });
      await expect(toolsMenu).toHaveCount(0);
      await expect(preview).toBeVisible();
      const save = preview.getByRole("button", {
        name: "Save Beacon",
        exact: true,
      });
      await save.click();
      await expect(
        preview.getByRole("button", { name: "Unsave Beacon", exact: true }),
      ).toBeVisible();
      await preview
        .getByRole("button", { name: "Unsave Beacon", exact: true })
        .click();
      await expect(save).toBeVisible();
      await preview.getByRole("button", { name: /^React to / }).click();
      const choice = page.getByRole("button", { name: /^React with / }).first();
      await choice.click();
      await expect(
        preview.getByRole("button", { name: /your reaction/ }),
      ).toBeVisible();
      const reactionChip = preview
        .getByRole("button", { name: /reactions on / })
        .first();
      await expect(reactionChip).toHaveAttribute("aria-pressed", "true");
      await preview.screenshot({
        path: `docs/screenshots/card-context-social-2026-10-31/${appearance}-${width}-map-reacted.png`,
      });
      await reactionChip.click();
      await expect(
        preview.getByRole("button", { name: /your reaction/ }),
      ).toHaveCount(0);
      await expect(page.locator(".leaflet-map-pane")).toHaveAttribute(
        "style",
        camera!,
      );
      await shortcuts.getByRole("button", { name: /^Open .+ chat$/ }).click();
      await expect(
        page.getByRole("tab", { name: "Chat", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByRole("textbox", { name: "Message", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Close Beacon panel", exact: true })
        .click();
      await expect(preview).toBeVisible();
      await preview
        .getByRole("button", { name: "Close map preview", exact: true })
        .click();
      await expect(preview).toHaveCount(0);
    });
  }
}

test("public Browse previews expose no member-only shortcuts", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 320, height: 844 });
  await enter(page, "/browse-beacons", "light");
  await page.getByTestId("browse-beacons-search").fill("photography");
  const card = page.getByTestId("discovery-beacon-card-map-public-photo-walk");
  await expect(card).toBeVisible();
  await expect(
    card.getByRole("button", {
      name: /^React to |^Open .+ chat$|^Comments on /,
    }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: /join|request/i }),
  ).toBeVisible();
});

test("a friend-host fallback says Message host and opens the existing conversation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await enter(page, "/browse-beacons", "light");
  await page
    .getByTestId("browse-beacons-search")
    .fill("A few rounds. Good company.");
  const card = page.getByTestId("discovery-beacon-card-a1");
  await expect(card).toBeVisible();
  await expect(
    card.getByRole("button", { name: /^Open .+ chat$/ }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: /^Message host of / }).click();
  await expect(page).toHaveURL(/\/messages\//);
});

test("Home shows direct actions without duplicating them in the menu", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page, "/activities", "light");
  const card = page
    .getByTestId("home-explore-beacons")
    .getByTestId("beacon-feed-card-map-plan-coffee");
  const shortcuts = card.getByTestId("beacon-shortcuts-map-plan-coffee");
  await expect(card.getByRole("button", { name: /^React to / })).toBeVisible();
  await expect(
    shortcuts.getByRole("button", { name: /^Open .+ chat$/ }),
  ).toBeVisible();
  await expect(
    shortcuts.getByRole("button", { name: /^View .+ on map$/ }),
  ).toHaveCount(0);
  await card.screenshot({
    path: "docs/screenshots/card-context-social-2026-10-31/light-390-home.png",
  });
  await card
    .getByRole("button", { name: "More Beacon actions", exact: true })
    .click();
  const menu = page.getByRole("dialog", {
    name: "Plan stop 1: Coffee together",
  });
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Open Chat", exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("button", { name: "View on Map", exact: true }),
  ).toBeVisible();
});

test("public Map preview keeps its Join action readable and member tools private", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 320, height: 844 });
  await enter(page, "/", "light");
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("concert");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Preview Lakefront Summer Lights concert public Beacon",
      exact: true,
    })
    .click();
  const card = page.getByTestId("map-public-callout");
  await expect(card).toBeVisible();
  await expect(card).toContainText(/approximate area/i);
  await expect(
    card.getByRole("button", {
      name: /^React to |^Open .+ chat$|^Comments on /,
    }),
  ).toHaveCount(0);
  const action = card
    .getByTestId("discovery-card-actions")
    .getByRole("button")
    .first();
  const bounds = await action.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await expect(action).toBeInViewport({ ratio: 1 });
  await card.screenshot({
    path: "docs/screenshots/card-context-social-2026-10-31/light-320-public-map.png",
  });
  await card
    .getByRole("button", { name: "Beacon info & actions", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Public Beacon information" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeVisible();
  await card
    .getByRole("button", { name: "Close map preview", exact: true })
    .click();
  await expect(card).toHaveCount(0);
});

test("shared card actions stay compact with reaction overflow, all tools and zero tools", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await enter(page, "/activities", "dark");
  const card = page
    .getByTestId("home-explore-beacons")
    .getByTestId("beacon-feed-card-map-plan-coffee");
  // Reuse the existing browser-suite technique: mutate only the in-memory demo
  // provider, then dispatch its ordinary action to publish a fresh snapshot.
  await card.evaluate(async (node) => {
    let fiber = (node as any)[
      Object.keys(node).find((key) => key.startsWith("__reactFiber"))!
    ];
    while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
      fiber = fiber.return;
    const store = fiber.memoizedProps.value;
    const activity = store.data.activities.find(
      (row: any) => row.id === "map-plan-coffee",
    );
    for (const module of [
      "checklist",
      "journal",
      "focus",
      "experiences",
      "scoreboard",
      "music",
    ])
      activity[`enable_${module}`] = true;
    activity.music_url = "https://open.spotify.com/track/demo";
    const people = [
      store.userId,
      ...store.data.profiles
        .filter((row: any) => row.id !== store.userId)
        .slice(0, 4)
        .map((row: any) => row.id),
    ];
    store.data.rsvps.push(
      ...people.slice(1).map((user_id: string) => ({
        activity_id: activity.id,
        user_id,
        status: "going",
        approved: true,
      })),
    );
    store.data.reactions = people.map((user_id: string, index: number) => ({
      activity_id: activity.id,
      user_id,
      emoji: String.fromCodePoint(0x1f600 + index),
    }));
    await store.act("read_notices");
  });
  const tools = card.getByRole("button", {
    name: "Beacon tools, 6 available",
    exact: true,
  });
  await expect(tools).toBeVisible();
  const primary = card.getByRole("button", {
    name: "Open Beacon",
    exact: true,
  });
  const primaryBounds = (await primary.boundingBox())!;
  expect(primaryBounds.height).toBeGreaterThanOrEqual(44);
  expect(primaryBounds.width).toBeGreaterThan(
    (await tools.boundingBox())!.width,
  );
  const visibleChips = await card
    .getByRole("button", { name: /reactions on / })
    .count();
  expect(visibleChips).toBeGreaterThanOrEqual(1);
  expect(visibleChips).toBeLessThanOrEqual(3);
  await card.getByRole("button", { name: /more reaction types/ }).click();
  const reactions = page.getByRole("dialog", {
    name: "Beacon reactions",
    exact: true,
  });
  await expect(reactions.getByRole("button", { name: /[0-9]$/ })).toHaveCount(
    5,
  );
  await reactions.screenshot({
    path: "docs/screenshots/card-context-social-2026-10-31/dark-320-reaction-overflow.png",
  });
  await page.keyboard.press("Escape");
  await tools.click();
  const menu = page.getByRole("dialog", { name: "Beacon tools", exact: true });
  for (const name of [
    "Checklist",
    "Sketchboard",
    "Memories",
    "Focus timer",
    "Music link",
    "Scoreboard",
  ])
    await expect(
      menu.getByRole("button", { name, exact: true }),
    ).toBeAttached();
  await menu.screenshot({
    path: "docs/screenshots/card-context-social-2026-10-31/dark-320-six-tools.png",
  });
  await page.keyboard.press("Escape");
  await card.getByRole("button", { name: /^Comments on / }).click();
  await expect(page).toHaveURL(/tab=comments/);
  await page.goBack();
  await card.evaluate(async (node) => {
    let fiber = (node as any)[
      Object.keys(node).find((key) => key.startsWith("__reactFiber"))!
    ];
    while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
      fiber = fiber.return;
    const store = fiber.memoizedProps.value;
    const activity = store.data.activities.find(
      (row: any) => row.id === "map-plan-coffee",
    );
    for (const module of [
      "checklist",
      "journal",
      "focus",
      "experiences",
      "scoreboard",
      "music",
    ])
      activity[`enable_${module}`] = false;
    await store.act("read_notices");
  });
  await expect(card.getByRole("button", { name: /^Beacon tools/ })).toHaveCount(
    0,
  );
  await expect(
    card.getByRole("button", { name: /^Open .+ chat$/ }),
  ).toBeVisible();
});
