import { test, expect } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { makeDemo } from "../../src/shared/demo";
import type { Activity } from "../../src/shared/types";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("an empty Map stays unobstructed across refresh and tab return", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { eligible: false });
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Map", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("map-discovery-help")).toHaveCount(0);
  await expect(page.getByTestId("map-result-status")).toHaveCount(0);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(page.getByTestId("map-discovery-help")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Map", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nothing happening here yet.", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("quiet-map.png") });
});

test("the bell opens the full Inbox directly and retains ordinary unread Updates", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  account.snapshot.notices.push({
    id: "refinement-notice",
    recipient_id: account.snapshot.viewer_id!,
    body: "Your Beacon changed",
    activity_id: null,
    created_at: new Date().toISOString(),
    read_at: null,
  });
  await page.goto("/activities");
  await page
    .getByRole("button", { name: "Notifications, 1 unread", exact: true })
    .click();
  await expect(page).toHaveURL(/\/responses$/);
  await expect(
    page.getByRole("dialog", { name: "Notifications", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Needs Action", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Updates · 1", exact: true }).click();
  await expect(page.getByText(/Your Beacon changed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Mark all read", exact: true })
    .click();
  await expect
    .poll(() =>
      account.actions.some((action) => action.action === "read_notices"),
    )
    .toBe(true);
  await page.screenshot({ path: test.info().outputPath("inbox-updates.png") });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/activities$/);
});

test("Sonar requires people review before Start and selection never starts sharing", async ({
  page,
}) => {
  const geo: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: () => {
          throw new Error("Unexpected location request");
        },
        watchPosition: () => {
          throw new Error("Unexpected location watch");
        },
        clearWatch: () => {},
      },
    });
  });
  page.on("pageerror", (error) => geo.push(error.message));
  await page.goto("/location");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const people = page.getByRole("dialog", {
    name: "Share location with",
    exact: true,
  });
  await expect(people).toBeVisible();
  await people.getByRole("checkbox").first().click();
  await expect(
    people.getByRole("button", { name: /^Start Sonar/ }),
  ).toHaveCount(0);
  await people
    .getByRole("button", { name: "Review Sharing · 1 people", exact: true })
    .click();
  const review = page.getByRole("dialog", {
    name: "Ready to share?",
    exact: true,
  });
  await expect(
    review.getByText("Sharing with 1 friend", { exact: true }),
  ).toBeVisible();
  await review.getByRole("button", { name: "30 minutes", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("sonar-review.png") });
  await review
    .getByRole("button", { name: "Back to people", exact: true })
    .click();
  await expect(
    people.getByRole("button", { name: "Selected · 1", exact: true }),
  ).toBeVisible();
  await people.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(geo).toEqual([]);
});

test("Profile section links reveal Making time for and consume the intent", async ({
  page,
}) => {
  await page.goto("/profile?section=aspirations");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(
    page.getByText("Making time for", { exact: true }),
  ).toBeInViewport();
  await expect(page).not.toHaveURL(/section=/);
});

test("Quick Activity has compact categories, custom duration and recoverable cancellation", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { eligible: false });
  await page.goto("/profile");
  await page.getByTestId("add-activity-note").click();
  const editor = page.getByRole("dialog", {
    name: "What are you doing?",
    exact: true,
  });
  await editor
    .getByRole("textbox", { name: "What are you up to?", exact: true })
    .fill("A short walk");
  await expect(
    editor.getByRole("button", { name: "Share Activity", exact: true }),
  ).toBeInViewport();
  await editor.getByRole("button", { name: "Fitness", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Fitness", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor
    .getByRole("radio", { name: "Custom duration", exact: true })
    .click();
  await editor.getByLabel("Hours", { exact: true }).fill("1");
  await editor.getByLabel("Minutes", { exact: true }).fill("30");
  await page.screenshot({
    path: test.info().outputPath("activity-custom.png"),
  });
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByTestId("add-activity-note").click();
  await expect(
    editor.getByRole("textbox", { name: "What are you up to?", exact: true }),
  ).toHaveValue("A short walk");
  await expect(editor.getByLabel("Hours", { exact: true })).toHaveValue("1");
  await expect(editor.getByLabel("Minutes", { exact: true })).toHaveValue("30");
});

test("Beacon timing stages changes, keeps title errors outside and rejects DST gaps", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { eligible: false });
  await page.goto("/create?editor=yes&timezone=America%2FChicago");
  const starts = page.getByRole("button", { name: /^Starts,/ });
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  const previous = await starts.getAttribute("aria-label");
  await starts.click();
  const timing = page.getByRole("dialog", {
    name: "When shall we?",
    exact: true,
  });
  await expect(timing.getByText(/Give.*title|title.*required/i)).toHaveCount(0);
  await timing.getByLabel("Starts", { exact: true }).fill("2026-11-15T18:30");
  await timing
    .getByRole("radio", { name: "Custom duration", exact: true })
    .click();
  await timing.getByLabel("Hours", { exact: true }).fill("1");
  await timing.getByLabel("Minutes", { exact: true }).fill("30");
  await timing.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(starts).toHaveAttribute("aria-label", previous!);
  await starts.click();
  await timing.getByLabel("Starts", { exact: true }).fill("2026-11-15T18:30");
  await timing.getByRole("radio", { name: "2 hours", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("beacon-timing.png") });
  await timing.getByRole("button", { name: "Done", exact: true }).click();
  await starts.click();
  await expect(timing.getByLabel("Starts", { exact: true })).toHaveValue(
    "2026-11-15T18:30",
  );
  await timing.getByLabel("Starts", { exact: true }).fill("2027-03-14T02:30");
  await expect(
    timing.getByRole("button", { name: "Done", exact: true }),
  ).toBeDisabled();
});

test("Public can be chosen before creation and a lost listing reply never creates twice", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  let permitListing = false;
  const requests: {
    action: string;
    payload: Record<string, unknown>;
    request_id: string;
  }[] = [];
  await page.route(
    "**/rest/v1/rpc/{beacon_action,set_beacon_discovery}",
    async (route) => {
      const body = route.request().postDataJSON();
      const request = route.request().url().endsWith("set_beacon_discovery")
        ? { action: "publish_beacon_discovery", payload: body, request_id: "" }
        : body;
      if (
        !["create_activity", "publish_beacon_discovery"].includes(
          request.action,
        )
      ) {
        await route.fallback();
        return;
      }
      requests.push(request);
      if (request.action === "create_activity") {
        account.snapshot.activities.push({
          ...makeDemo().activities[0],
          ...request.payload,
          id: "public-created",
          owner_id: account.snapshot.viewer_id!,
          status: "scheduled",
          viewer_can_access: true,
          viewer_can_read: true,
        } as Activity);
        await route.fulfill({
          json: { id: "public-created", event: "create_activity" },
        });
      } else if (!permitListing) {
        await route.fulfill({
          status: 503,
          json: { message: "Listing reply lost" },
        });
      } else
        await route.fulfill({ json: { event: "publish_beacon_discovery" } });
    },
  );
  await page.goto("/create?editor=yes");
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Public online meetup");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meet");
  await page
    .getByRole("switch", { name: "Public listing", exact: true })
    .click();
  await page
    .getByLabel("City or general area", { exact: true })
    .fill("Chicago");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(page.getByText(/Beacon created; public listing/)).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("public-listing-recovery.png"),
  });
  await expect(
    page.getByRole("button", { name: "Retry public listing", exact: true }),
  ).toBeEnabled();
  permitListing = true;
  await page
    .getByRole("button", { name: "Retry public listing", exact: true })
    .click();
  await expect(page).toHaveURL(/activity-created.*public-created/);
  expect(
    requests.filter((item) => item.action === "create_activity"),
  ).toHaveLength(1);
  const listings = requests.filter(
    (item) => item.action === "publish_beacon_discovery",
  );
  expect(listings.length).toBeGreaterThanOrEqual(2);
  expect(listings[0].request_id).toBe(listings[1].request_id);
  expect(listings[0].payload).toEqual(listings[1].payload);
});

test("managing a Beacon reuses the staged picker and saves through the existing edit action", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  account.snapshot.activities.push({
    ...makeDemo().activities.find((item) => item.id === "demo-tools")!,
    id: "managed-beacon",
    owner_id: account.snapshot.viewer_id!,
    audience: "private",
    audience_id: null,
    viewer_can_access: true,
    viewer_can_read: true,
  });
  const edits: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/beacon_action", async (route) => {
    const request = route.request().postDataJSON();
    if (request.action !== "edit_activity") {
      await route.fallback();
      return;
    }
    edits.push(request.payload);
    Object.assign(account.snapshot.activities[0], request.payload);
    await route.fulfill({ json: {} });
  });
  await page.goto("/activity/managed-beacon");
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page.getByRole("button", { name: /Edit.*time/i }).click();
  const manage = page.getByRole("dialog", {
    name: "Update the Beacon",
    exact: true,
  });
  await manage
    .getByRole("button", { name: "Change date & time", exact: true })
    .click();
  const timing = page.getByRole("dialog", {
    name: "When shall we?",
    exact: true,
  });
  await timing.getByRole("radio", { name: "2 hours", exact: true }).click();
  await timing.getByRole("button", { name: "Done", exact: true }).click();
  expect(edits).toHaveLength(0);
  await manage
    .getByRole("button", { name: "Save and notify attendees", exact: true })
    .click();
  await expect.poll(() => edits.length).toBe(1);
  expect(
    Date.parse(String(edits[0].ends_at)) -
      Date.parse(String(edits[0].starts_at)),
  ).toBe(7200000);
});

test("Plan Focus handles a Plan with no physical stops and exits to the ordinary Map", async ({
  page,
}) => {
  await page.goto("/plan/demo-routine:demo-you:friday:plan");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const focus = page.getByTestId("map-plan-focus");
  await expect(focus).toBeVisible();
  await expect(focus).toContainText(
    /visible physical stops|No visible physical stops/,
  );
  await expect(page.locator('[data-testid="map-constellation"]')).toHaveCount(
    0,
  );
  await expect(focus).toContainText("No visible physical stops");
  await expect(
    focus.getByRole("button", { name: "Fit Plan", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath("plan-focus.png") });
  await focus
    .getByRole("button", { name: "Exit Plan Focus", exact: true })
    .click();
  await expect(focus).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Plan stop \d+:/ }),
  ).toHaveCount(0);
});

for (const width of [320, 375, 390, 430])
  for (const appearance of ["light", "dark"]) {
    test(`refinement visual review at ${width}px ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        appearance,
      );
      await mockOnboardingAccount(page, { eligible: false });
      await page.goto("/profile");
      await page.getByTestId("add-activity-note").click();
      const note = page.getByRole("dialog", {
        name: "What are you doing?",
        exact: true,
      });
      await expect(
        note.getByRole("button", { name: "Share Activity", exact: true }),
      ).toBeInViewport();
      await expect(
        note.getByRole("button", { name: "Fitness", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`composer-${width}-${appearance}.png`),
      });
      await note.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.goto("/create?editor=yes");
      await page.getByRole("button", { name: /^Starts,/ }).click();
      const timing = page.getByRole("dialog", {
        name: "When shall we?",
        exact: true,
      });
      await expect(
        timing.getByRole("button", { name: "Done", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: test.info().outputPath(`timing-${width}-${appearance}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(timing).toHaveCount(0);
    });
  }

test("lightweight activity choices map to supported categories without replacing an existing title", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { eligible: false });
  await page.goto("/profile");
  await page.getByTestId("add-activity-note").click();
  const note = page.getByRole("dialog", {
    name: "What are you doing?",
    exact: true,
  });
  await expect(
    note.getByRole("button", {
      name: "Walking, Fitness category",
      exact: true,
    }),
  ).toHaveCount(0);
  await note
    .getByRole("button", { name: "See more activity choices", exact: true })
    .click();
  await note
    .getByRole("button", { name: "Walking, Fitness category", exact: true })
    .click();
  await expect(
    note.getByLabel("What are you up to?", { exact: true }),
  ).toHaveValue("Walking");
  await expect(
    note.getByRole("button", { name: "Fitness", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await note
    .getByLabel("What are you up to?", { exact: true })
    .fill("My own title");
  await note
    .getByRole("button", { name: "Music, Creative category", exact: true })
    .click();
  await expect(
    note.getByLabel("What are you up to?", { exact: true }),
  ).toHaveValue("My own title");
  await expect(
    note.getByRole("button", { name: "Creative", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: test.info().outputPath("more-activity-choices.png"),
  });
});

test("Plan Focus shows authorized numbered physical stops without unrelated map markers", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  const viewer = account.snapshot.viewer_id!;
  account.snapshot.capabilities = {
    ...account.snapshot.capabilities,
    living_plans: false,
  };
  account.snapshot.plans.push({
    id: "physical-plan",
    owner_id: viewer,
    squad_id: null,
    title: "Physical itinerary",
    description: "",
    timezone: "America/Chicago",
    start_date: "2026-10-28",
    status: "scheduled",
    created_at: new Date().toISOString(),
  });
  const base = makeDemo().activities[0];
  for (const [index, id] of ["physical-one", "physical-two"].entries()) {
    account.snapshot.activities.push({
      ...base,
      id,
      title: `Physical stop ${index + 1}`,
      owner_id: viewer,
      audience: "private",
      audience_id: null,
      plan_id: "physical-plan",
      plan_step_index: index,
      viewer_can_access: true,
      viewer_can_read: true,
    });
    account.snapshot.places.push({
      activity_id: id,
      label: `Place ${index + 1}`,
      latitude: 41.88 + index * 0.02,
      longitude: -87.63,
      online_url: null,
    });
  }
  await page.goto("/?mapPlan=physical-plan");
  const focus = page.getByTestId("map-plan-focus");
  await expect(focus).toContainText("2 visible physical stops");
  await expect(
    page.getByRole("button", {
      name: "Plan stop 1: Physical stop 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Plan stop 2: Physical stop 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('[data-testid="map-constellation"]')).toHaveCount(
    0,
  );
  await focus.getByRole("button", { name: "Fit Plan", exact: true }).click();
  const connector = page.locator('path[stroke-dasharray="6 5"]');
  await expect(connector).toHaveCount(1);
  // A vertical SVG path has a zero-width DOM box despite its painted stroke.
  expect(await connector.evaluate(element => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    }
    return (element as SVGPathElement).getTotalLength() > 1;
  })).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("plan-focus-physical.png"),
  });
  await focus
    .getByRole("button", { name: "Exit Plan Focus", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Plan stop \d+:/ }),
  ).toHaveCount(0);
});

test("empty Map feedback follows deliberate filters and stays dismissed across automatic returns", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { eligible: false });
  await page.goto("/");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  const feedback = page.getByTestId("map-result-status");
  await expect(feedback).toContainText("No matches");
  await page
    .getByRole("button", { name: "Dismiss map message", exact: true })
    .click();
  await expect(feedback).toHaveCount(0);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(feedback).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Map", exact: true }),
  ).toBeVisible();
  await expect(feedback).toHaveCount(0);
});


test("the composer keeps completion reachable with enlarged text and keyboard dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockOnboardingAccount(page, { eligible: false });
  await page.goto("/profile");
  await page.getByTestId("add-activity-note").click();
  const note = page.getByRole("dialog", { name: "What are you doing?", exact: true });
  await note.evaluate(element => {
    for (const node of element.querySelectorAll<HTMLElement>("*")) {
      if ([...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())) {
        const style = getComputedStyle(node);
        node.style.fontSize = `${parseFloat(style.fontSize) * 1.25}px`;
        node.style.lineHeight = "normal";
      }
    }
  });
  await note.getByLabel("What are you up to?", { exact: true }).focus();
  await expect(note.getByRole("button", { name: "Share Activity", exact: true })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("composer-larger-text.png") });
  await page.keyboard.press("Escape");
  await expect(note).toHaveCount(0);
});


test("Beacon creation offers lightweight choices and staged People Picker cancellation", async ({page}) => {
  await mockOnboardingAccount(page,{eligible:false});
  await page.goto("/create?editor=yes");
  await page.getByRole("button",{name:"Choose category",exact:true}).click();
  const appearance=page.getByRole("dialog",{name:"Appearance",exact:true});
  await appearance.getByRole("button",{name:"See more activity choices",exact:true}).click();
  await appearance.getByRole("button",{name:"Food, Social category",exact:true}).click();
  await appearance.getByRole("button",{name:"Done",exact:true}).click();
  await expect(page.getByLabel("Activity title",{exact:true})).toHaveValue("Food");
  await page.getByRole("button",{name:"+ Add People",exact:true}).click();
  const people=page.getByRole("dialog",{name:"Add People",exact:true});
  await people.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(people).toHaveCount(0);
  await expect(page.getByLabel("Activity title",{exact:true})).toHaveValue("Food");
});
