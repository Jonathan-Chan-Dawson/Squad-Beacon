import { test, expect, type Page } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";

const beaconId = "73333333-3333-4333-8333-333333333333";
const summary = () => ({
  activity_id: beaconId,
  title: "Coffee in the neighborhood",
  category: "Social",
  interest_tags: ["Social"],
  starts_at: new Date(Date.now() + 3600000).toISOString(),
  ends_at: new Date(Date.now() + 7200000).toISOString(),
  area_label: "Chicago",
  coarse_lat: 41.88,
  coarse_lng: -87.63,
  requires_approval: true,
  capacity_limit: 6,
  capacity_policy: "strict",
  accepted_seat_count: 3,
  closed: false,
  viewer_response: null,
});

async function guest(
  page: Page,
  options: { empty?: boolean; fail?: boolean; noProfile?: boolean; sectionTutorials?: boolean } = {},
) {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    noProfile: options.noProfile,
    sectionTutorials: options.sectionTutorials,
  });
  let joins = 0;
  let searches = 0;
  let withdrawn = false;
  await page.route("**/rest/v1/rpc/browse_guest_beacons", async (route) => {
    searches++;
    await route.fulfill({
      status: options.fail ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        options.fail
          ? { message: "Unavailable" }
          : options.empty || withdrawn
            ? []
            : [summary()],
      ),
    });
  });
  await page.route("**/rest/v1/rpc/join_public_beacon", async (route) => {
    joins++;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "requested" }),
    });
  });
  return {
    account,
    get joins() {
      return joins;
    },
    get searches() {
      return searches;
    },
    withdraw() {
      withdrawn = true;
    },
  };
}

async function enterAccount(page: Page) {
  await page
    .getByLabel("Email", { exact: true })
    .fill("fixture@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("long-password-123");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
  await page.route(/.*(?:cartocdn\.com|basemaps\.carto\.com).*/, (route) =>
    route.abort(),
  );
});

test("the first visit opens the normal Map and the tours stay replayable", async ({ page }) => {
  await guest(page, { sectionTutorials: true });
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  const mapTip = page.getByRole("dialog", { name: "Welcome to the Map!" });
  await mapTip.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page).toHaveURL(/\/activities$/);
  const welcome = page.getByRole("dialog", { name: "Welcome to Squad Beacon!" });
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "Let’s explore" }).click();
  await expect(page.getByTestId("home-explore-beacons").getByText("Coffee in the neighborhood")).toBeVisible();
  await expect(page.getByTestId("saved-tools-entry")).toBeVisible();
  await page.goto("/activities");
  await expect(page.getByTestId("home-explore-beacons")).toBeVisible();
  await expect(welcome).toHaveCount(0);
  await page.goto("/help");
  await page.getByRole("button", { name: "Quick Tour" }).click();
  await page.getByRole("button", { name: "Replay Map tutorial", exact: true }).click();
  await expect(mapTip).toBeVisible();
});

test("signing in from the visitor welcome does not show a second welcome", async ({ page }) => {
  const { account } = await guest(page);
  await page.goto("/activities");
  await page.getByRole("dialog", { name: "Welcome to Squad Beacon!" }).getByRole("button", { name: "Skip introduction" }).click();
  await page.getByTestId("home-friends-section").getByRole("button", { name: "Login to use", exact: true }).click();
  await enterAccount(page);
  await expect(page).toHaveURL(/\/activities$/);
  await expect(page.locator('[data-testid="saved-tools-entry"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid="onboarding-returning"]:visible')).toBeVisible();
  await expect.poll(() => account.keys.has("welcome.dismissed.v1")).toBe(true);
  await expect(page.getByTestId("onboarding-welcome")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Welcome to Squad Beacon!" })).toHaveCount(0);
});

test("email confirmation restores Create without private draft parameters", async ({ page }) => {
  await guest(page);
  await page.goto("/create?kind=ping&draftId=private-draft");
  await expect(page.getByRole("button", { name: "Login to use", exact: true })).toBeVisible();
  await page.goto("/auth/confirm?token_hash=fixture-email&type=email");
  await page.getByRole("button", { name: "Confirm and continue", exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
});

test("signed-out visitors see the original Map, tabs and Create button", async ({
  page,
}) => {
  const runtime = await guest(page);
  await page.goto("/?mapDiscovery=yes");
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Profile", exact: true }),
  ).toBeVisible();
  expect(runtime.account.snapshotReads).toBe(0);
  expect(runtime.account.reads).toBe(0);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const blank = page.getByRole("button", { name: "Create Blank Beacon" });
  await expect(blank).toBeVisible();
  await blank.click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Keep exploring", exact: true })
    .click();
  await expect(blank).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  const identity = page.getByTestId("profile-identity");
  const login = identity.getByRole("button", { name: "Login to use", exact: true });
  await expect(page.getByTestId("profile-tabs")).toBeVisible();
  await identity.getByRole("button", { name: "Dismiss login card", exact: true }).click();
  await expect(identity.getByTestId("login-to-use-card")).toHaveCount(0);
  await login.click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

test("the Beacons home and full Browse directory work signed out", async ({
  page,
}) => {
  const runtime = await guest(page);
  await page.goto("/activities");
  await expect(page.getByTestId("beacons-home-scroll")).toBeVisible();
  await page
    .getByRole("button", { name: "Let’s explore", exact: true })
    .click();
  await expect(page).toHaveURL(/\/activities$/);
  await expect(page.getByRole("dialog", { name: "Welcome to Squad Beacon!" })).toHaveCount(0);
  await page.getByRole("button", { name: "Explore all →", exact: true }).click();
  const directory = page.getByTestId("browse-beacons-screen");
  await expect(directory).toBeVisible();
  await expect(
    directory.getByText("Coffee in the neighborhood", { exact: true }),
  ).toBeVisible();
  expect(runtime.account.snapshotReads).toBe(0);
  await page
    .getByRole("button", { name: "Saved Beacons", exact: true })
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

test("a guest can sign in and continue with the selected Create template", async ({ page }) => {
  await guest(page);
  await page.goto("/create");
  await page.getByTestId("creation-starters").getByRole("button", { name: "Basketball", exact: true }).click();
  await enterAccount(page);
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue("Basketball");
});

test("joining uses existing login and returns to the existing Browse preview for confirmation", async ({
  page,
}) => {
  const runtime = await guest(page, { noProfile: true });
  await page.goto(`/discover/${beaconId}`);
  const preview = page
    .getByRole("dialog")
    .filter({ has: page.getByTestId("map-public-preview") });
  await expect(preview).toBeVisible();
  await preview
    .getByRole("button", { name: "Request to Join", exact: true })
    .click();
  await enterAccount(page);
  await page.getByLabel("Your name", { exact: true }).fill("Guest Explorer");
  await page.getByLabel("Username", { exact: true }).fill("guest_explorer");
  await page
    .getByLabel("Date of birth · YYYY-MM-DD", { exact: true })
    .fill("2000-01-31");
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/browse-beacons/);
  await expect(preview).toBeVisible();
  expect(runtime.joins).toBe(0);
  await preview
    .getByRole("button", { name: "Request to Join", exact: true })
    .click();
  await expect(
    preview.getByRole("button", { name: "Requested ✓", exact: true }),
  ).toBeVisible();
  expect(runtime.joins).toBe(1);
});

test("protected direct links show existing authentication without reading private data", async ({
  page,
}) => {
  const runtime = await guest(page);
  for (const path of [
    "/create?editor=yes",
    `/activity/${beaconId}/chat`,
  ]) {
    await page.goto(path);
    await page.getByRole("button", { name: "Login to use", exact: true }).click();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  }
  expect(runtime.account.snapshotReads).toBe(0);
  expect(runtime.joins).toBe(0);
});

test("guest Squads retains the Communities tab when sign-in is cancelled", async ({ page }, info) => {
  const runtime = await guest(page);
  await page.goto("/squads");
  await expect(page.getByText("Log in to see your chats and connect with friends.")).toBeVisible();
  const communities = page.getByRole("button", { name: "Communities", exact: true });
  await communities.click();
  await expect(page.getByRole("heading", { name: "Your Communities" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("guest-communities.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Login to use", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await expect(communities).toHaveAttribute("aria-pressed", "true");
  expect(runtime.account.snapshotReads).toBe(0);
});

test("demo is already signed in and its Create and Profile work without real login", async ({
  page,
}) => {
  await guest(page);
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Create", exact: true }).press("Enter");
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
});

for (const width of [320, 390]) {
  test(`original guest Map fits ${width}px in both appearances`, async ({
    page,
  }) => {
    await guest(page);
    await page.setViewportSize({ width, height: 844 });
    for (const mode of ["light", "dark"]) {
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        mode,
      );
      await page.goto("/?mapDiscovery=yes");
      await expect(page.getByTestId("full-map-screen")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/onboarding3-existing-ui-${width}-${mode}.png`,
      });
    }
  });
}
