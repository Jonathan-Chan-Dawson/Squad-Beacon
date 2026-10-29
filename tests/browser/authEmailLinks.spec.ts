import { test, expect } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";

const origin = "https://squad-beacon.vercel.app";
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});

for (const host of ["127.0.0.1", "localhost", "sb-auth-preview.example"]) {
  test(`signup and resend from ${host} use the configured website`, async ({
    page,
  }) => {
    const account = await mockOnboardingAccount(page, { signedOut: true });
    const preview = host === "sb-auth-preview.example";
    if (preview) {
      await page.route(`https://${host}/**`, async (route) => {
        const requested = new URL(route.request().url());
        const response = await route.fetch({
          url: `http://127.0.0.1:4189${requested.pathname}${requested.search}`,
        });
        await route.fulfill({ response });
      });
    }
    await page.goto(
      preview ? `https://${host}/activities` : `http://${host}:4189/activities`,
    );
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByLabel("Email", { exact: true })
      .fill(" fixture@example.invalid ");
    await page
      .getByLabel("Password", { exact: true })
      .fill("new-long-password-123");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", {
        name: "Resend confirmation email",
        exact: true,
      }),
    ).toBeVisible();
    const signup = account.authRequests.find(
      (r) => r.path === "/auth/v1/signup",
    )!;
    expect(new URL(signup.url).searchParams.get("redirect_to")).toBe(
      `${origin}/auth/confirm`,
    );
    await page
      .getByRole("button", { name: "Resend confirmation email", exact: true })
      .click();
    await expect(
      page.getByText(/If this address can receive the link/),
    ).toBeVisible();
    const resend = account.authRequests.find(
      (r) => r.path === "/auth/v1/resend",
    )!;
    expect(new URL(resend.url).searchParams.get("redirect_to")).toBe(
      `${origin}/auth/confirm`,
    );
    expect(resend.body?.type).toBe("signup");
    expect(
      account.authCalls.filter((p) => p === "/auth/v1/signup"),
    ).toHaveLength(1);
  });
}

test("prefetch does not consume a token; confirmation exchanges once across account remounts", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    surveyStatus: "pending",
  });
  const response = await page.goto(
    "/auth/confirm?token_hash=fixture-email&type=email",
  );
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  const confirm = page.getByRole("button", {
    name: "Confirm and continue",
    exact: true,
  });
  await expect(confirm).toBeEnabled();
  expect(account.authCalls.filter((p) => p === "/auth/v1/verify")).toHaveLength(
    0,
  );
  await confirm.evaluate((node: HTMLElement) => {
    node.click();
    node.click();
  });
  await expect(page).not.toHaveURL(/auth\/confirm/);
  await expect(
    page.getByRole("tab", { name: "Profile", exact: true }),
  ).toBeVisible();
  expect(account.authCalls.filter((p) => p === "/auth/v1/verify")).toHaveLength(
    1,
  );
  await expect(page.getByTestId("profile-survey")).toHaveCount(0);
  expect(page.url()).not.toContain("token_hash");
});

test("a fresh browser without a verifier can confirm and complete only the required profile", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    noProfile: true,
  });
  await page.goto("/auth/confirm?token_hash=new-browser-token&type=email");
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((key) => key.includes("code-verifier")),
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Confirm and continue", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Email Arrival");
  await page.getByLabel("Username", { exact: true }).fill("email_arrival");
  await page
    .getByLabel("Date of birth · YYYY-MM-DD", { exact: true })
    .fill("2000-01-31");
  await page
    .getByRole("button", { name: "Enter Squad Beacon", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("profile-survey")).toHaveCount(0);
  expect(account.snapshot.profiles[0].onboarding_survey_status).toBe("pending");
});

test("recovery requires confirmation and a verified recovery session before password replacement", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/confirm?token_hash=reset-token&type=recovery");
  await expect(
    page.getByRole("button", { name: "Confirm and continue", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  expect(account.authCalls.filter((p) => p === "/auth/v1/verify")).toHaveLength(
    0,
  );
  await page
    .getByRole("button", { name: "Confirm and continue", exact: true })
    .click();
  await page
    .getByLabel("New password", { exact: true })
    .fill("replacement-password-123");
  await page
    .getByRole("button", { name: "Set new password", exact: true })
    .click();
  await expect(page).not.toHaveURL(/auth\/confirm/);
  expect(
    account.authRequests.find((r) => r.path === "/auth/v1/verify")?.body?.type,
  ).toBe("recovery");
});

test("expired confirmation offers resend without creating an account", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    failVerify: true,
  });
  await page.goto("/auth/confirm?token_hash=expired&type=email");
  await page
    .getByRole("button", { name: "Confirm and continue", exact: true })
    .click();
  await expect(page.getByText(/This link could not be used/)).toBeVisible();
  await page
    .getByLabel("Email for a new link", { exact: true })
    .fill("fixture@example.invalid");
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  await expect(
    page.getByText(/If this address can receive the link/),
  ).toBeVisible();
  expect(account.authCalls.filter((p) => p === "/auth/v1/signup")).toHaveLength(
    0,
  );
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});

test("malformed links cannot exchange and resend throttling has a recoverable message", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, {
    signedOut: true,
    failResend: 429,
  });
  await page.goto("/auth/confirm?type=email");
  await expect(
    page.getByRole("button", { name: "Confirm and continue", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Email for a new link", { exact: true })
    .fill("fixture@example.invalid");
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Please wait");
  expect(account.authCalls.filter((p) => p === "/auth/v1/verify")).toHaveLength(
    0,
  );
});

test("signup verification cannot expose the recovery form and a missing session never claims success", async ({
  page,
}) => {
  await mockOnboardingAccount(page, {
    signedOut: true,
    callbackWithoutSession: true,
  });
  await page.goto("/auth/confirm?token_hash=no-session&type=email");
  await page
    .getByRole("button", { name: "Confirm and continue", exact: true })
    .click();
  await expect(page.getByText(/you are not signed in/)).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});
