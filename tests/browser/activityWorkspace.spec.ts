import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});

for (const appearance of ["light", "dark"] as const) {
  test(`workspace tabs preserve filters and Calendar state · ${appearance}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("beacon.appearance", value),
      appearance,
    );
    await page.goto("/calendar?date=2026-11-10");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await expect(
      page.getByRole("tab", { name: "Calendar", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByText("Tuesday, November 10", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/your-activity/${appearance}-calendar-month.png`,
      fullPage: true,
    });
    const historyLength = await page.evaluate(() => history.length);
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await expect(
      page.getByText("Tuesday, November 17", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Plans", exact: true }).click();
    await page.getByRole("button", { name: "Personal", exact: true }).click();
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Search your activities" })
      .fill("walk");
    await page.getByRole("tab", { name: "Calendar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Next week", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Tuesday, November 17", { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const tab of ["Beacons", "Plans", "Calendar"]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `docs/screenshots/your-activity/${appearance}-${width}-${tab.toLowerCase()}.png`,
          fullPage: true,
        });
      }
    }
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Search your activities" }),
    ).toHaveValue("walk");
    await page.getByRole("tab", { name: "Plans", exact: true }).click();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `docs/screenshots/your-activity/${appearance}-plans-all.png`,
      fullPage: true,
    });
  });
}

test("saved Plan creation is consumed once and dirty inline edits require a choice", async ({
  page,
}) => {
  await page.goto(
    "/plans?create=yes&startDate=2026-11-15&timezone=America%2FChicago",
  );
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Workspace acceptance Plan");
  await page.getByRole("button", { name: "Save Plan", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Plan name", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/your-activity/plan-workspace.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "+ Idea", exact: true }).click();
  await page
    .getByLabel("What could we do?", { exact: true })
    .fill("Keep this thought");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(
    page.getByLabel("What could we do?", { exact: true }),
  ).toHaveValue("Keep this thought");
  await page.getByRole("button", { name: "Add idea", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1. Keep this thought", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/your-activity/plan-workspace-with-idea.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "1. Keep this thought", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop options", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Stop options", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/your-activity/plan-stop-menu.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Stop options", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Stop options", exact: true }).click();
  await page.getByRole("button", { name: "Remove idea", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Remove this stop?", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep stop", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1. Keep this thought", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Plan name", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Workspace acceptance Plan", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "1. Keep this thought", exact: true }),
  ).toBeVisible();
});

test("an uncertain committed creation replays its original request and opens one authoritative Plan", async ({
  page,
}) => {
  const { mockOnboardingAccount } = await import("./onboardingAccount");
  const { applyDemoLivingPlan } =
    await import("../../src/features/plans/demoLivingPlans");
  const account = await mockOnboardingAccount(page, { eligible: false });
  account.snapshot.capabilities = {
    ...account.snapshot.capabilities,
    living_plans: true,
  };
  const requests: { request_id: string; payload: Record<string, unknown> }[] =
    [];
  let planId = "";
  await page.route("**/rest/v1/rpc/beacon_action", async (route) => {
    const request = route.request().postDataJSON();
    if (request.action !== "create_living_plan") {
      await route.fallback();
      return;
    }
    requests.push(request);
    if (requests.length === 1) {
      const next = applyDemoLivingPlan(
        account.snapshot,
        account.snapshot.viewer_id!,
        request.action,
        request.payload,
      )!;
      planId = next.plans.at(-1)!.id;
      Object.assign(account.snapshot, next);
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Reply lost after commit" }),
      });
    } else
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ id: planId }),
      });
  });
  await page.goto("/plans?create=yes");
  await page.getByLabel("Plan name", { exact: true }).fill("Recovered once");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Save Plan", exact: true }).click();
  await expect(
    page.getByText("Reconnect to save changes. Nothing was queued.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Plan name", { exact: true })).toBeEditable();
  expect(requests).toHaveLength(0);
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Save Plan", exact: true }).click();
  await expect(
    page.getByText("Reply lost after commit", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check saved Plan", exact: true })
    .click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0].request_id).toBe(requests[1].request_id);
  expect(requests[0].payload).toEqual(requests[1].payload);
  expect(
    account.snapshot.plans.filter((plan) => plan.title === "Recovered once"),
  ).toHaveLength(1);
  await expect(page).toHaveURL(new RegExp(`/plan/${planId}`));
});

for (const kind of ["vote", "draw", "time"] as const) {
  test(`a Plan ${kind} uses its existing editor and returns to the originating stop`, async ({
    page,
  }) => {
    await page.goto("/plans?create=yes");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page
      .getByLabel("Plan name", { exact: true })
      .fill(`Decision ${kind} Plan`);
    await page.getByRole("button", { name: "Save Plan", exact: true }).click();
    await page.getByRole("button", { name: "+ Decide", exact: true }).click();
    await page
      .getByRole("button", {
        name:
          kind === "vote"
            ? "Pick One / Approval Vote"
            : kind === "draw"
              ? "Surprise Us \u00b7 Draw"
              : "Find a Time",
        exact: true,
      })
      .click();
    const title = `Choice ${kind}`;
    await page
      .getByLabel(
        kind === "time" ? "Activity title" : "What are we deciding?",
        { exact: true },
      )
      .fill(title);
    if (kind !== "time") {
      await page
        .getByLabel("Activity option", { exact: true })
        .nth(0)
        .fill("Coffee");
      await page
        .getByLabel("Activity option", { exact: true })
        .nth(1)
        .fill("Walk");
    }
    await page
      .getByRole("button", {
        name:
          kind === "time"
            ? "Create Find a Time"
            : kind === "vote"
              ? "Create Vote Council"
              : "Create Draw Council",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: `1. ${title}`, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/plan\//);
  });
}

test("a linked Beacon publishes through its full editor and returns to the Plan", async ({
  page,
}) => {
  await page.goto("/plans?create=yes");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Linked Beacon Plan");
  await page.getByRole("button", { name: "Save Plan", exact: true }).click();
  await page.getByRole("button", { name: "+ Beacon", exact: true }).click();
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Plan online hangout");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/hangout");
  await page
    .getByRole("button", { name: /^(Create Beacon|Add Beacon Step)$/ })
    .click();
  await expect(
    page.getByRole("button", { name: "1. Plan online hangout", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/plan\//);
});

test("a Squad Plan is saved under its audience and immediately visible from All", async ({
  page,
}) => {
  await page.goto("/plans?create=yes");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Squad workspace Plan");
  await page
    .getByRole("button", { name: "The training crew", exact: true })
    .click();
  await page.getByRole("button", { name: "Save Plan", exact: true }).click();
  await expect(
    page.getByText("The training crew", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: "Squad workspace Plan", exact: true })
      .last(),
  ).toBeVisible();
});

test("Calendar scheduling uses compact choices and preserves selected date and timezone", async ({
  page,
}) => {
  await page.goto("/calendar?date=2026-11-15");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "+ Schedule", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/your-activity/calendar-schedule-menu.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(page.getByLabel("Plan name", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/startDate=2026-11-15/);
  await expect(page).toHaveURL(/timezone=America/);
});

test("Calendar itineraries open individual Beacons and restore their expanded state", async ({
  page,
}) => {
  await page.goto("/calendar");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const itinerary = page
    .getByRole("button", { name: /Coffee, art,? and a lakefront walk/ })
    .first();
  await expect(itinerary).toBeVisible();
  await itinerary.click();
  await expect(page.getByTestId("calendar-itinerary")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/your-activity/calendar-itinerary.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /^Open Beacon:/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
  await page.goBack();
  await expect(page.getByTestId("calendar-itinerary")).toBeVisible();
  await page.getByRole("button", { name: "Open Plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\//);
});
