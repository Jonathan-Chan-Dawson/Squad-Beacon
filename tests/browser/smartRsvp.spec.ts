import { expect, test, type Page } from "@playwright/test";
async function home(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByTestId("friends-right-now")).toBeAttached();
}
// Test-only in-memory fixture: preserve real demo activity/people records and
// seed an invitation that the fixed demo actor cannot receive through its UI.
// No application test endpoint, network mutation, or production data is used.
async function inviteDemoActor(page: Page) {
  await page.getByTestId("friends-right-now").evaluate(async (node) => {
    const key = Object.keys(node).find((name) =>
      name.startsWith("__reactFiber"),
    )!;
    let fiber = (node as any)[key];
    while (
      fiber &&
      !(
        fiber.memoizedProps?.value?.data?.is_demo &&
        fiber.memoizedProps?.value?.act
      )
    )
      fiber = fiber.return;
    if (!fiber) throw new Error("Demo fixture provider was not found");
    const store = fiber.memoizedProps.value;
    const activity = store.data.activities.find(
      (entry: any) => entry.id === "a1",
    );
    activity.approval_required = false;
    activity.capacity_policy = "strict";
    activity.capacity_limit = 8;
    delete activity.accepted_seat_count;
    store.data.rsvps = store.data.rsvps.filter(
      (row: any) =>
        !(row.activity_id === activity.id && row.user_id === store.userId),
    );
    store.data.rsvps.push({
      activity_id: activity.id,
      user_id: store.userId,
      status: "invited",
      approved: true,
    });
    store.data.beacon_invitation_grants.push({
      activity_id: activity.id,
      user_id: store.userId,
      invited_by: activity.owner_id,
      created_at: new Date().toISOString(),
    });
    await store.act("read_notices");
  });
}
for (const width of [320, 375, 430, 1024]) {
  test(`social card invitation, decline and departure at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await home(page);
    const regular = page
      .getByTestId("home-explore-beacons")
      .getByTestId(/^beacon-feed-card-/)
      .first();
    await regular.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.expo/smart-rsvp/discovery-${width}.png` });
    await expect(
      regular.getByRole("button", { name: "I’m Out", exact: true }),
    ).toHaveCount(0);
    await inviteDemoActor(page);
    const card = page.getByTestId("beacon-feed-card-a1");
    await expect(
      card.getByRole("button", { name: "I’m In", exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "I’m Out", exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Maybe", exact: true }),
    ).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const live = await card.getByText("Live", { exact: true }).boundingBox();
    const title = await card.getByRole("heading").boundingBox();
    const artwork = await card
      .getByTestId("beacon-category-artwork")
      .boundingBox();
    expect(live!.y + live!.height).toBeLessThanOrEqual(title!.y);
    expect(live!.x).toBeGreaterThan(artwork!.x + artwork!.width);
    const timing = await card.getByTestId("discovery-timing").boundingBox();
    expect(timing!.y + timing!.height).toBeLessThanOrEqual(title!.y);
    expect(title!.y - timing!.y - timing!.height).toBeLessThanOrEqual(16);
    const moreBounds = await card
      .getByRole("button", { name: "More Beacon actions", exact: true })
      .boundingBox();
    expect(moreBounds!.height).toBeGreaterThanOrEqual(44);
    expect(moreBounds!.y + moreBounds!.height).toBeLessThanOrEqual(title!.y);
    await card.screenshot({ path: `.expo/smart-rsvp/invited-${width}.png` });
    await card.getByRole("button", { name: "I’m Out", exact: true }).click();
    await expect(
      card.getByRole("button", { name: "Can’t Go ✓", exact: true }),
    ).toBeVisible();
    await card.screenshot({ path: `.expo/smart-rsvp/declined-${width}.png` });
    await expect(
      card.getByRole("button", { name: "I’m Out", exact: true }),
    ).toHaveCount(0);
    await card.getByRole("button", { name: "Can’t Go ✓", exact: true }).click();
    const choices = page.getByRole("dialog", {
      name: "Your RSVP",
      exact: true,
    });
    await choices.getByRole("button", { name: "Maybe", exact: true }).click();
    await expect(
      card.getByRole("button", { name: "Maybe ✓", exact: true }),
    ).toBeVisible();
    await card.screenshot({ path: `.expo/smart-rsvp/maybe-${width}.png` });
    await card.getByRole("button", { name: "Maybe ✓", exact: true }).click();
    await choices.getByRole("button", { name: "Join", exact: true }).click();
    await expect(
      card.getByRole("button", { name: "Going ✓", exact: true }),
    ).toBeVisible();
    await card.screenshot({ path: `.expo/smart-rsvp/going-${width}.png` });
    await expect(card.getByTestId("beacon-comment-face-a1")).toHaveCSS(
      "border-top-width",
      "1px",
    );
    await expect(card.getByTestId("beacon-open-a1-face")).toHaveCSS(
      "border-top-width",
      "1px",
    );
    await card.getByRole("button", { name: "Going ✓", exact: true }).click();
    await choices
      .getByRole("button", { name: "Leave Beacon", exact: true })
      .click();
    const leave = page.getByRole("dialog", {
      name: "Leave Beacon?",
      exact: true,
    });
    await expect(leave).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(leave).toContainText("Your confirmed spot will be released.");
    await page.screenshot({
      path: `.expo/smart-rsvp/leave-confirmation-${width}.png`,
    });
    await leave
      .getByRole("button", { name: "Keep my response", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Going ✓", exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Going ✓", exact: true }).click();
    await choices
      .getByRole("button", { name: "Leave Beacon", exact: true })
      .click();
    await leave
      .getByRole("button", { name: "Leave Beacon", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Can’t Go ✓", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
test("ordinary discovery uses Join, Going and explicit Leave consistently in Overview", async ({
  page,
}) => {
  await home(page);
  const card = page.getByTestId("beacon-feed-card-a1");
  await card.getByRole("button", { name: "Join", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Going ✓", exact: true }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Open Beacon overview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Going ✓", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Going ✓", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Your RSVP", exact: true })
    .getByRole("button", { name: "Leave Beacon", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Leave Beacon?", exact: true })
    .getByRole("button", { name: "Leave Beacon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Join", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    card.getByRole("button", { name: "Join", exact: true }),
  ).toBeVisible();
});
test("declined invitations leave unanswered responses and remain editable", async ({
  page,
}) => {
  await home(page);
  await inviteDemoActor(page);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page
    .getByRole("button", { name: "Responses & Invitations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Beacon invitation", exact: true })
    .click();
  await page.getByRole("button", { name: "I’m Out", exact: true }).click();
  await expect(
    page.getByText("Your Beacon responses", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Can’t Go ✓", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Beacon invitation", exact: true }),
  ).toHaveCount(0);
});

test("approval, full and unknown response cards remain distinct at large text sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await home(page);
  const card = page.getByTestId("beacon-feed-card-a1");
  async function configure(
    response: "none" | "going" | "unknown",
    full = false,
  ) {
    await page.getByTestId("friends-right-now").evaluate(
      async (node, options) => {
        let fiber = (node as any)[
          Object.keys(node).find((key) => key.startsWith("__reactFiber"))!
        ];
        while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
          fiber = fiber.return;
        const store = fiber.memoizedProps.value;
        const activity = store.data.activities.find(
          (row: any) => row.id === "a1",
        );
        activity.title =
          "A relaxed neighborhood gathering with a very long activity title";
        activity.approval_required = !options.full;
        activity.capacity_policy = "strict";
        activity.capacity_limit = options.full ? 1 : 8;
        delete activity.accepted_seat_count;
        store.data.rsvps = store.data.rsvps.filter(
          (row: any) =>
            !(row.activity_id === "a1" && row.user_id === store.userId),
        );
        store.data.beacon_invitation_grants =
          store.data.beacon_invitation_grants.filter(
            (row: any) =>
              !(row.activity_id === "a1" && row.user_id === store.userId),
          );
        if (options.response !== "none")
          store.data.rsvps.push({
            activity_id: "a1",
            user_id: store.userId,
            status: options.response,
            approved: options.response === "going",
          });
        await store.act("read_notices");
      },
      { response, full },
    );
  }
  await configure("none");
  await card
    .getByRole("button", { name: "Request to Join", exact: true })
    .click();
  await card.getByRole("button", { name: "Requested ✓", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Your RSVP", exact: true })
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Request to Join", exact: true }),
  ).toBeVisible();
  await configure("none", true);
  await expect(
    card.getByRole("button", { name: "Full", exact: true }),
  ).toBeDisabled();
  await configure("going", true);
  await expect(
    card.getByRole("button", { name: "Going ✓", exact: true }),
  ).toBeEnabled();
  await configure("unknown");
  await expect(
    card.getByRole("button", { name: "Refresh response", exact: true }),
  ).toBeDisabled();
  await page.addStyleTag({
    content:
      '[data-testid="beacon-feed-card-a1"] [dir="auto"] { font-size: 19px !important; line-height: 26px !important; }',
  });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByTestId("beacon-live-pulse")).toHaveCSS("opacity", "0");
  await card.screenshot({
    path: ".expo/smart-rsvp/large-text-reduced-motion-320.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const button of await card.getByRole("button").all()) {
    const bounds = await button.boundingBox();
    if (bounds) expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
});

test("the live ring animates beside the label above the title", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await home(page);
  const card = page.getByTestId("beacon-feed-card-a1");
  await card.scrollIntoViewIfNeeded();
  const pulse = card.getByTestId("beacon-live-pulse");
  const initial = await pulse.evaluate(
    (node) => getComputedStyle(node).transform,
  );
  await expect
    .poll(() => pulse.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(initial);
  await card.screenshot({ path: ".expo/smart-rsvp/live-pulse-375.png" });
});
