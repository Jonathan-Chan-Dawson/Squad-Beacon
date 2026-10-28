import { test, expect, type Page } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});
const survey = (page: Page) => page.getByTestId("profile-survey");
async function basics(page: Page) {
  await page.getByLabel("Your name", { exact: true }).fill("New Person");
  await page.getByLabel("Username", { exact: true }).fill("new_person");
  await page
    .getByLabel("Date of birth · YYYY-MM-DD", { exact: true })
    .fill("2000-01-31");
}
async function signIn(page: Page) {
  await page
    .getByLabel("Email", { exact: true })
    .fill("  fixture@example.invalid  ");
  await page.getByLabel("Password", { exact: true }).fill("long-password-123");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
}
for (const status of ["pending", "skipped", "completed"] as const) {
  test(`${status} enters the normal app and initializes progress without a survey`, async ({
    page,
  }) => {
    const account = await mockOnboardingAccount(page, { surveyStatus: status });
    await page.goto("/activities");
    await expect.poll(() => account.reads).toBeGreaterThan(0);
    await expect(page.getByTestId("onboarding-welcome")).toBeVisible();
    await expect(survey(page)).toHaveCount(0);
    await expect(page.getByLabel("Your name", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Explore Beacons", exact: true }),
    ).toBeVisible();
  });
}

test("new signed-out account signs in, completes only required setup and enters directly", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    noProfile: true,
  });
  await page.goto("/activities");
  await signIn(page);
  await expect(
    page.getByText("Just the basics, then you’re in."),
  ).toBeVisible();
  expect(account.reads).toBe(0);
  await basics(page);
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(page.getByTestId("onboarding-welcome")).toBeVisible();
  await expect(survey(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Explore Beacons", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(account.actions.filter((a) => a.action === "onboard")).toHaveLength(1);
  expect(account.snapshot.profiles[0].onboarding_survey_status).toBe("pending");
});

test("required setup keeps input after an interrupted save and permits a safe retry", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    noProfile: true,
    failProfileSave: true,
  });
  await page.goto("/activities");
  await basics(page);
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Interrupted profile save",
  );
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "New Person",
  );
  expect(account.reads).toBe(0);
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(page.getByTestId("onboarding-welcome")).toBeVisible();
  expect(account.snapshot.profiles).toHaveLength(1);
});

test("an authenticated account without a profile can sign out safely", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { noProfile: true });
  await page.goto("/activities");
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  expect(
    account.actions.filter((a) => a.action === "stop_location"),
  ).toHaveLength(0);
});

test("loading and failed snapshots do not show setup or request progress", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    noProfile: true,
    failSnapshot: true,
    delaySnapshot: 700,
  });
  await page.goto("/activities");
  await expect.poll(() => account.snapshotReads).toBeGreaterThan(0);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveCount(0);
  expect(account.reads).toBe(0);
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  expect(account.reads).toBe(0);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveCount(0);
});

test("unavailable progress backend leaves the normal app accessible", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    surveyStatus: "pending",
    failProgress: true,
  });
  await page.goto("/activities");
  await expect.poll(() => account.reads).toBeGreaterThan(0);
  await expect(page.getByTestId("onboarding-returning")).toBeVisible();
  await expect(survey(page)).toHaveCount(0);
  await page.goto("/profile");
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).toBeVisible();
});

test("sign-out and another account reject delayed progress from the first account", async ({
  page,
}) => {
  const first = await mockOnboardingAccount(page, {
    surveyStatus: "pending",
    holdProgress: true,
  });
  await page.goto("/activities");
  await expect.poll(() => first.reads).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await mockOnboardingAccount(page, {
    viewer: "92222222-2222-4222-8222-222222222222",
    signedOut: true,
    eligible: false,
  });
  await signIn(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByTestId("onboarding-returning")).toBeVisible();
  first.releaseProgress();
  await expect.poll(() => first.completedReads).toBeGreaterThan(0);
  expect(first.keys.has("welcome.seen.v1")).toBe(false);
  await expect(page.getByTestId("onboarding-welcome")).toHaveCount(0);
});

test("invalid required fields do not submit and rapid duplicate taps create once", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { noProfile: true });
  await page.goto("/activities");
  await basics(page);
  await page.getByLabel("Username", { exact: true }).fill("a!");
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("3–24");
  expect(account.actions.filter((a) => a.action === "onboard")).toHaveLength(0);
  await page.getByLabel("Username", { exact: true }).fill("new_person");
  await page
    .getByLabel("Date of birth · YYYY-MM-DD", { exact: true })
    .fill("2020-01-01");
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("16 and older");
  expect(account.actions.filter((a) => a.action === "onboard")).toHaveLength(0);
  await page
    .getByLabel("Date of birth · YYYY-MM-DD", { exact: true })
    .fill("2000-01-31");
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .evaluate((node: HTMLElement) => {
      node.click();
      node.click();
    });
  await expect(page.getByTestId("onboarding-welcome")).toBeVisible();
  expect(account.actions.filter((a) => a.action === "onboard")).toHaveLength(1);
});

test("PKCE recovery is recognized from the verified exchange rather than the URL label", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { signedOut: true });
  await page.addInitScript(
    (key) =>
      sessionStorage.setItem(
        `${key}-code-verifier`,
        JSON.stringify("fixture-verifier/recovery"),
      ),
    account.storageKey,
  );
  await page.goto("/auth/callback?code=fixture-code");
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  expect(
    account.authCalls.filter((path) => path === "/auth/v1/token"),
  ).toHaveLength(1);
});

test("a recovery URL label alone cannot enable password replacement", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { signedOut: true });
  await page.addInitScript(
    (key) =>
      sessionStorage.setItem(
        `${key}-code-verifier`,
        JSON.stringify("fixture-signup-verifier"),
      ),
    account.storageKey,
  );
  await page.goto("/auth/callback?code=fixture-signup-code&type=recovery");
  await expect(page).not.toHaveURL(/auth\/callback/);
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});

test("invitation survives sign-in and required setup without sending a request", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    noProfile: true,
  });
  await page.goto("/invite?username=friend_name");
  await expect(page.getByText(/Connect with @friend_name/)).toBeVisible();
  await page
    .getByRole("button", { name: "Sign in to continue", exact: true })
    .click();
  await signIn(page);
  await basics(page);
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Send friend request", exact: true }),
  ).toBeVisible();
  expect(page.url()).toContain("username=friend_name");
  expect(
    account.actions.filter((a) => a.action === "friend_request"),
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "Send friend request", exact: true })
    .click();
  await expect
    .poll(
      () => account.actions.filter((a) => a.action === "friend_request").length,
    )
    .toBe(1);
});

test("personalization is voluntary; cancel writes nothing and saving preserves other fields", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    surveyStatus: "pending",
  });
  const original = structuredClone(account.snapshot.profiles[0]);
  await page.goto("/profile");
  await expect(survey(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Personalize Profile", exact: true })
    .click();
  await page
    .getByLabel("About me (optional)", { exact: true })
    .fill("Unsaved draft");
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(survey(page)).toHaveCount(0);
  expect(
    account.actions.filter((a) => a.action === "save_profile"),
  ).toHaveLength(0);
  expect(account.snapshot.profiles[0]).toEqual(original);
  await page
    .getByRole("button", { name: "Personalize Profile", exact: true })
    .click();
  await page
    .getByLabel("About me (optional)", { exact: true })
    .fill("Another unsaved draft");
  await page
    .getByRole("button", { name: "Close personalization", exact: true })
    .click();
  await expect(survey(page)).toHaveCount(0);
  expect(
    account.actions.filter((a) => a.action === "save_profile"),
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "Personalize Profile", exact: true })
    .click();
  await expect(
    page.getByLabel("About me (optional)", { exact: true }),
  ).toHaveValue(original.bio ?? "");
  await page
    .getByLabel("About me (optional)", { exact: true })
    .fill("A voluntary introduction");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Save personalization", exact: true })
    .click();
  await expect(survey(page)).toHaveCount(0);
  await expect(
    page.getByText("Your profile is looking good.", { exact: true }),
  ).toBeVisible();
  expect(account.snapshot.profiles[0].onboarding_survey_status).toBe(
    "completed",
  );
  expect(account.snapshot.profiles[0].quiet_start).toBe(original.quiet_start);
  expect(account.snapshot.profiles[0].aspiration_goals).toEqual(
    original.aspiration_goals,
  );
  expect(account.snapshot.profiles[0].interests).toEqual(original.interests);
  await expect(page.getByTestId("profile-personalization-entry")).toHaveCount(
    0,
  );
});

test("editor protects unsaved work before opening personalization", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { surveyStatus: "completed" });
  await page.goto("/profile/edit");
  await page.getByLabel("Bio", { exact: true }).fill("Keep this draft");
  await page
    .getByRole("button", { name: "Edit Interests & Goals", exact: true })
    .click();
  await expect(
    page.getByText("Open personalization?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Bio", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await expect(survey(page)).toHaveCount(0);
});

test("invalid account links never expose a password replacement form", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/callback?error_description=expired&type=recovery");
  await expect(page.getByText(/This link could not be used/)).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Return to sign in", exact: true })
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

test("authentication modes clear errors and password reset uses neutral confirmation", async ({
  page,
}) => {
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/activities");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alert")).toContainText("valid email");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByLabel("Email", { exact: true })
    .fill("fixture@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alert")).toContainText("10 characters");
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(page.getByText(/If an account uses this email/)).toBeVisible();
});

test("verified link without a session offers sign-in rather than claiming entry", async ({
  page,
}) => {
  await mockOnboardingAccount(page, {
    signedOut: true,
    callbackWithoutSession: true,
  });
  await page.goto("/auth/callback?token_hash=fixture&type=signup");
  await expect(page.getByText(/you are not signed in/)).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});

test("verified signup enters directly while verified recovery offers password replacement", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    surveyStatus: "pending",
  });
  await page.goto("/auth/callback?token_hash=fixture&type=signup");
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).not.toBeVisible();
  await expect(page).not.toHaveURL(/auth\/callback/);
  await expect(survey(page)).toHaveCount(0);
  await page.goto("/auth/callback?token_hash=recovery-fixture&type=recovery");
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  expect(
    account.authCalls.filter((path) => path === "/auth/v1/verify"),
  ).toHaveLength(2);
  await page
    .getByLabel("New password", { exact: true })
    .fill("new-password-12345");
  await page
    .getByRole("button", { name: "Set new password", exact: true })
    .click();
  await expect(page).not.toHaveURL(/auth\/callback/);
});

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 390]) {
    test(`phone screenshots: ${appearance}, ${width}px`, async ({ page }) => {
      await mockOnboardingAccount(page, { signedOut: true, noProfile: true });
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        appearance,
      );
      await page.setViewportSize({ width, height: 844 });
      if (width === 320) await page.emulateMedia({ reducedMotion: "reduce" });
      const capture = async (name: string) => {
        if (["about-you", "interests", "aspirations"].includes(name)) {
          await expect(
            page.getByText(
              "Your profile, your pace. These choices never turn on location sharing.",
              { exact: true },
            ),
          ).toBeInViewport({ ratio: 1 });
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/onboarding2-${name}-${appearance}-${width}.png`,
          animations: "disabled",
        });
      };
      await page.goto("/activities");
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      await capture("signin");
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await capture("signup");
      await page
        .getByRole("button", { name: "Sign in", exact: true })
        .first()
        .click();
      await signIn(page);
      await basics(page);
      await capture("required-profile");
      await page
        .getByRole("button", { name: "Enter Squad Beacon", exact: true })
        .click();
      await expect(page.getByTestId("onboarding-welcome")).toBeVisible();
      await capture("first-entry");
      await page.getByRole("tab", { name: "Profile", exact: true }).click();
      const name = await page
        .getByRole("heading", { name: "New Person", exact: true })
        .boundingBox();
      expect(name?.width).toBeGreaterThan(80);
      await page
        .getByRole("button", { name: "Personalize Profile", exact: true })
        .scrollIntoViewIfNeeded();
      await capture("profile-entry");
      await page
        .getByRole("button", { name: "Personalize Profile", exact: true })
        .click();
      await expect(survey(page)).toBeVisible();
      await capture("about-you");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByText("What are you into?", { exact: true }),
      ).toBeInViewport();
      const interestTarget = await page
        .getByRole("button", { name: "Choose Basketball", exact: true })
        .boundingBox();
      expect(interestTarget?.height).toBeGreaterThanOrEqual(44);
      await page
        .getByRole("button", { name: "Choose Basketball", exact: true })
        .click();
      await expect(
        page
          .getByRole("button", { name: "Remove Basketball", exact: true })
          .first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Remove Basketball", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Choose Basketball", exact: true })
        .click();
      await capture("interests");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByText("What would you like to make time for?", {
          exact: true,
        }),
      ).toBeInViewport();
      await capture("aspirations");
      await page
        .getByRole("button", { name: "Save personalization", exact: true })
        .click();
      await expect(survey(page)).toHaveCount(0);
      await capture("completed");
    });
  }
}
