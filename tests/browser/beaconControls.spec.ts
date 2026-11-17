import { makeDemo } from "../../src/shared/demo";
import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

async function detail(page: Page, id: string) {
  await page.goto(`/activity/${id}`);
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("activity-detail-hero")).toBeVisible();
}

test("advanced beacon settings save and the host can manually mark arrival", async ({
  page,
}) => {
  await detail(page, "map-plan-coffee");
  // Arrival is enabled only for a live Beacon. Keep the real demo Plan stop,
  // moving its dates in memory instead of depending on the test's wall clock.
  await page.getByTestId("activity-detail-hero").evaluate(async (node) => {
    let fiber = (node as any)[
      Object.keys(node).find((key) => key.startsWith("__reactFiber"))!
    ];
    while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
      fiber = fiber.return;
    const store = fiber.memoizedProps.value;
    const activity = store.data.activities.find(
      (row: any) => row.id === "map-plan-coffee",
    );
    activity.starts_at = new Date(Date.now() - 15 * 60_000).toISOString();
    activity.ends_at = new Date(Date.now() + 60 * 60_000).toISOString();
    await store.act("read_notices");
  });
  await expect(page.getByText("Your arrival", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "I’m here" }).click();
  await expect(
    page.getByRole("button", { name: "I’m here", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await page.getByLabel("Capacity (optional, including you)").fill("3");
  await page
    .getByRole("button", { name: "Card background: Orbit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Capacity policy: Strict", exact: true })
    .click();
  await page.getByRole("button", { name: "Save beacon settings" }).click();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await expect(
    page.getByLabel("Capacity (optional, including you)"),
  ).toHaveValue("3");
  await expect(
    page.getByRole("button", {
      name: "Card background: Constellation",
      exact: true,
    }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Capacity (optional, including you)").fill("4");
  await page.getByRole("button", { name: "Save beacon settings" }).click();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await expect(
    page.getByLabel("Capacity (optional, including you)"),
  ).toHaveValue("4");
});

test("disabled modules preserve authorized shared history", async ({
  page,
}) => {
  await detail(page, "demo-tools");
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page.getByRole("tab", { name: "Checklist", exact: true }).click();
  await expect(
    page.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All tools", exact: true }).click();
  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Tools options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Checklist: Off", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save beacon settings", exact: true })
    .click();
  await page.getByRole("tab", { name: "Checklist", exact: true }).click();
  await expect(
    page.getByText("Checklist history", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bring a water bottle", { exact: true }),
  ).toBeVisible();
});

test("Map admission uses Join, Going and explicit Leave", async ({ page }) => {
  await page.goto("/browse-beacons");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByTestId("browse-beacons-search")
    .fill(makeDemo().activities.find((a) => a.id === "a1")!.title);
  await page
    .getByRole("button", { name: "More Beacon actions", exact: true })
    .click();
  await page.getByRole("button", { name: "View on Map", exact: true }).click();
  const preview = page.getByTestId("map-tooltip");
  const imIn = preview.getByRole("button", { name: "Join", exact: true });
  await expect(imIn).toBeVisible();
  await imIn.click();
  const imOut = preview.getByRole("button", { name: "Going ✓", exact: true });
  await expect(imOut).toBeVisible();
  await imOut.click();
  await page
    .getByRole("dialog", { name: "Your RSVP", exact: true })
    .getByRole("button", { name: "Leave Beacon", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Leave Beacon?", exact: true })
    .getByRole("button", { name: "Leave Beacon", exact: true })
    .click();
  await expect(
    preview.getByRole("button", { name: "Join", exact: true }),
  ).toBeVisible();
});
for (const [width, theme] of [
  [320, "dark"],
  [390, "light"],
  [1100, "dark"],
] as const) {
  test(`organized overview at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      theme,
    );
    await detail(page, "demo-tools");
    await expect(
      page.getByRole("tab", { name: "Memories", exact: true }),
    ).toHaveCount(0);
    const hostCard = page
      .getByRole("button", { name: "View host profile", exact: true })
      .locator("..")
      .locator("..");
    await expect(
      hostCard.getByTestId("activity-detail-progress"),
    ).toBeVisible();
    await expect(
      hostCard.getByRole("button", { name: "Repeat this Beacon", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `.expo/natural-beacon-overview-${width}.png`,
    });
    await expect(page.getByTestId("beacon-comments-section")).toHaveCount(0);
    await page.getByRole("button", { name: /^Comments ·/ }).click();
    await expect(
      page.getByLabel("Add a comment", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Add a comment", { exact: true })
      .fill("See you there!");
    await page.getByRole("button", { name: "Comments", exact: true }).click();
    await page.getByRole("button", { name: /^Comments ·/ }).click();
    await expect(page.getByLabel("Add a comment", { exact: true })).toHaveValue(
      "See you there!",
    );
    await page.getByRole("button", { name: "Comments", exact: true }).click();
    await page
      .getByRole("button", { name: "Manage Beacon", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Repeat settings", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Close repeat settings", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close repeat settings", exact: true })
      .click();
    await page.getByRole("tab", { name: "Tools", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Checklist", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `.expo/natural-beacon-tools-${width}.png` });
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page.getByTestId("activity-detail-hero").evaluate(async (node) => {
      let fiber = (node as any)[
        Object.keys(node).find((key) => key.startsWith("__reactFiber"))!
      ];
      while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
        fiber = fiber.return;
      const store = fiber.memoizedProps.value;
      for (let i = 0; i < 5; i++)
        await store.act("create_beacon_memory", {
          activity_id: "demo-tools",
          id: `overview-memory-${i}`,
          object_path: `demo://demo-tools/${store.userId}/overview-memory-${i}`,
          media_type: "image",
          caption: `Overview test memory ${i}`,
        });
    });
    await page
      .getByRole("button", { name: "See all memories", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(page.getByText(/^Overview test memory/)).toHaveCount(3);
    await page
      .getByRole("button", { name: "See all memories", exact: true })
      .click();
    await expect(page.getByText(/^Overview test memory/)).toHaveCount(5);
    await page.screenshot({ path: `.expo/organized-overview-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
for (const [width, theme] of [
  [320, "dark"],
  [390, "light"],
] as const) {
  test(`arrival mini map respects meeting visibility at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      theme,
    );
    await detail(page, "map-plan-coffee");
    await page.screenshot({ path: `.expo/beacon-phone-top-${width}.png` });
    const mini = page.getByRole("button", { name: /^Show .+ on Map$/ });
    await expect(mini).toHaveCount(1);
    await mini.scrollIntoViewIfNeeded();
    const arrival = page.getByTestId("beacon-arrival");
    await arrival
      .getByRole("button", { name: "On my way", exact: true })
      .click();
    await expect(
      arrival.getByRole("button", { name: "On my way", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await arrival
      .getByRole("button", { name: "Reset arrival", exact: true })
      .click();
    await expect(
      arrival.getByText("Not on my way", { exact: true }),
    ).toBeVisible();
    const social = page.getByTestId("beacon-social-actions");
    const enterChat = social.getByRole("button", {
      name: "Enter chat",
      exact: true,
    });
    await social.scrollIntoViewIfNeeded();
    const commentBounds = await social
      .getByRole("button", { name: /^Comments ·/ })
      .boundingBox();
    const chatBounds = await enterChat.boundingBox();
    expect(chatBounds!.x).toBeGreaterThan(commentBounds!.x);
    expect(Math.abs(chatBounds!.y - commentBounds!.y)).toBeLessThan(3);
    await enterChat.click();
    await expect(
      page.getByRole("tab", { name: "Chat", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await social.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.expo/arrival-mini-${width}.png` });
    await page.getByTestId("activity-detail-hero").evaluate(async (node) => {
      let fiber = (node as any)[
        Object.keys(node).find((key) => key.startsWith("__reactFiber"))!
      ];
      while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
        fiber = fiber.return;
      const store = fiber.memoizedProps.value;
      const place = store.data.places.find(
        (row: any) => row.activity_id === "map-plan-coffee",
      );
      place.online_url = "https://example.com/meeting";
      await store.act("read_notices");
    });
    await expect(mini).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const about = page
      .getByText("About this Beacon", { exact: true })
      .locator("..")
      .locator("..");
    await about.getByRole("button", { name: /^Open Plan / }).click();
    await expect(page).toHaveURL(/\/plan\//);
  });
}

test("memory media is reviewed before posting and gallery returns to Beacon", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await detail(page, "demo-tools");
  const image = await page.screenshot();
  await expect(page.getByRole("button", { name: "Post memory", exact: true })).toHaveCount(0);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo or video", exact: true }).click();
  await (await chooser).setFiles({ name: "memory.png", mimeType: "image/png", buffer: image });
  await expect(page.getByLabel("Selected memory preview", { exact: true })).toBeVisible();
  await page.getByLabel("Caption (optional)", { exact: true }).fill("Our Beacon memory");
  await expect(page.getByLabel("Beacon memory photo", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Post memory", exact: true }).click();
  await expect(page.getByText("Our Beacon memory", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Beacon memory photo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose photo or video", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "See all memories", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back to Beacon", exact: true })).toBeVisible();
  await expect(page.getByText("Our Beacon memory", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".expo/memory-gallery-phone.png" });
  await page.getByRole("button", { name: "Back to Beacon", exact: true }).click();
  await expect(page.getByRole("button", { name: "See all memories", exact: true })).toBeVisible();
});
