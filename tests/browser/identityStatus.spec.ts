import { expect, test } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { startDemoFromEntry } from "./demoEntry";

test("Profile keeps the Mini Beacon interaction beside Shop and Score lives in Rewards", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  const identity = page.getByTestId("profile-identity");
  const tap = identity.getByRole("button", { name: "Tap Mini Beacon" });
  const shop = identity.getByRole("button", { name: "Open Shop" });
  await expect(tap).toBeVisible();
  await expect(shop).toBeVisible();
  const noteBox = (await identity.getByTestId("living-status-message").boundingBox())!;
  const rewardsBox = (await identity.getByTestId("profile-status-rewards").boundingBox())!;
  expect(rewardsBox.x).toBeGreaterThanOrEqual(noteBox.x + noteBox.width);
  expect(Math.abs(rewardsBox.y + rewardsBox.height / 2 - noteBox.y - noteBox.height / 2)).toBeLessThan(2);
  expect((await identity.getByTestId("profile-mini-beacon-face").boundingBox())!.width).toBe(28);
  expect((await identity.getByTestId("profile-shop-face").boundingBox())!.width).toBe(28);
  expect((await tap.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect((await shop.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await tap.click();
  await expect(identity.getByText("+0.1 Coins", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await tap.click({ delay: 650 });
  const info = page.getByRole("dialog", { name: "Mini Beacon" });
  await expect(info.getByText("10 taps per Coin · 499 rewarded taps left this week")).toBeVisible();
  await page.keyboard.press("Escape");
  await shop.click();
  await expect(page.getByRole("button", { name: "Tap Mini Beacon" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "View Beacon Score", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Beacon Score" })).toBeVisible();
});

for (const [width, appearance] of [
  [320, "dark"],
  [430, "dark"],
  [390, "dark"],
  [320, "light"],
  [430, "light"],
  [390, "light"],
  [1024, "dark"],
  [1024, "light"],
] as const) {
  test(`identity-attached status at ${width}px in ${appearance}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ appearance }) => {
        localStorage.setItem("beacon.appearance", appearance);
      },
      { appearance },
    );
    await mockOnboardingAccount(page, { signedOut: true });
    await page.goto("/auth/sign-in");
    await startDemoFromEntry(page);
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    const home = page.getByTestId("your-people-self");
    const avatar = home.getByRole("button", { name: "Open your profile", exact: true });
    const homeNote = home.getByTestId("living-status-message");
    const sonar = home.getByRole("button", { name: "Open Sonar", exact: true });
    const activity = page.getByTestId("home-personal-timeline");
    const dialogueColor = appearance === "dark" ? "rgb(39, 39, 42)" : "rgb(242, 242, 243)";
    await expect(avatar).toBeVisible();
    await expect(home).toContainText("You");
    await expect(activity.getByRole("button", { name: "Add activity", exact: true })).toBeVisible();
    expect((await home.boundingBox())!.y).toBeLessThan((await activity.boundingBox())!.y);
    expect((await sonar.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await sonar.click();
    const sonarMenu = page.getByRole("dialog", { name: "Share location with", exact: true });
    await expect(sonarMenu).toBeVisible();
    await sonarMenu.getByRole("button", { name: "Close", exact: true }).click();
    await homeNote.click();
    const editor = page.getByRole("dialog", {
      name: /Edit your status|Share your status/,
    });
    await editor
      .getByRole("textbox", { name: "Status Note", exact: true })
      .fill("Coffee, then a creative afternoon");
    await editor
      .getByRole("button", { name: "Save Status", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(homeNote).toContainText("Coffee, then a creative afternoon");
    await page
      .getByRole("button", { name: "Change availability", exact: true })
      .click();
    const availability = page.getByRole("dialog", {
      name: "Availability & sharing",
      exact: true,
    });
    await expect(availability).toBeVisible();
    await page.screenshot({
      path: `.expo/identity-status/availability-${width}-${appearance}.png`,
    });
    await availability
      .getByRole("button", { name: "Busy", exact: true })
      .click();
    await availability.getByRole("button", { name: "Save availability", exact: true }).click();
    await expect(availability).toHaveCount(0);
    await expect(homeNote).toContainText("Coffee, then a creative afternoon");
    await page.screenshot({
      path: test.info().outputPath(`beacons-${width}-${appearance}.png`),
    });
    if (width === 320 && appearance === "dark") {
      const largerText = await page.addStyleTag({
        content:
          '[data-testid="your-people-self"] [dir="auto"] { font-size: 20px !important; line-height: 28px !important; }',
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const largeSonar = (await sonar.boundingBox())!;
      expect(largeSonar.x + largeSonar.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: ".expo/identity-status/beacons-large-text.png",
      });
      await largerText.evaluate((node) => node.remove());
    }
    await avatar.click();
    const identity = page.getByTestId("profile-identity");
    const note = identity.getByTestId("living-status-message");
    await expect(note.getByTestId("status-note-dialogue")).toHaveCSS("background-color", dialogueColor);
    await expect(page.getByTestId("up-next").filter({ visible: true }).last()).toBeVisible();
    const pill = identity.getByRole("button", {
      name: "Change availability",
      exact: true,
    });
    await expect(note).toContainText("Coffee, then a creative afternoon");
    await expect(pill).toContainText("Busy");
    const noteBox = (await note.boundingBox())!;
    const pillBox = (await pill.boundingBox())!;
    const profileSonar = identity.getByRole("button", {
      name: "Open Sonar",
      exact: true,
    });
    await expect(profileSonar).toBeVisible();
    const profileSonarBox = (await profileSonar.boundingBox())!;
    expect(
      profileSonarBox.x - (pillBox.x + pillBox.width),
    ).toBeGreaterThanOrEqual(4);
    expect(Math.abs(profileSonarBox.y - pillBox.y)).toBeLessThanOrEqual(1);
    expect(profileSonarBox.x + profileSonarBox.width).toBeLessThanOrEqual(
      width,
    );
    await expect(
      page.getByRole("button", { name: "Open Sonar", exact: true }),
    ).toHaveCount(1);
    if (width === 320 && appearance === "dark") {
      const largerText = await page.addStyleTag({
        content:
          '[data-testid="profile-identity"] [dir="auto"] { font-size: 20px !important; line-height: 28px !important; }',
      });
      const largeAvailability = (await pill.boundingBox())!;
      const largeSonar = (await profileSonar.boundingBox())!;
      expect(
        largeSonar.x - (largeAvailability.x + largeAvailability.width),
      ).toBeGreaterThanOrEqual(4);
      expect(largeSonar.x + largeSonar.width).toBeLessThanOrEqual(width);
      await largerText.evaluate((node) => node.remove());
    }
    const bioBox = (await identity
      .getByRole("button", { name: "Expand bio", exact: true })
      .boundingBox())!;
    const editBox = (await identity
      .getByRole("button", { name: "Edit profile", exact: true })
      .boundingBox())!;
    const currentBox = (await page
      .getByRole("button", { name: "Add activity", exact: true }).last()
      .boundingBox())!;
    expect(pillBox.y + pillBox.height).toBeLessThanOrEqual(noteBox.y + 1);
    expect(bioBox.y).toBeGreaterThanOrEqual(noteBox.y + noteBox.height - 1);
    expect(
      (await identity.getByTestId("availability-pill-visual").boundingBox())!
        .height,
    ).toBeLessThanOrEqual(32);
    expect(pillBox.height).toBeGreaterThanOrEqual(44);
    expect(editBox.y).toBeGreaterThan(bioBox.y);
    expect(currentBox.y).toBeGreaterThan(editBox.y);
    await expect(
      page.getByRole("button", { name: "Open Sonar", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.expo/identity-status/profile-${width}-${appearance}.png`,
      fullPage: true,
    });
  });
}

test("compact homepage previews preserve Activity Note editing and explicit Beacon selection", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  const section = page.getByTestId("home-personal-timeline");
  const self = page.getByTestId("your-people-self");
  const originalStatus = await self
    .getByTestId("living-status-message")
    .textContent();
  await section
    .getByRole("button", { name: "Add activity", exact: true })
    .click();
  const create = page.getByRole("dialog", {
    name: "What are you up to?",
    exact: true,
  });
  await create.getByRole("button", { name: "Write a quick update", exact: true }).click();
  await create
    .getByRole("textbox", { name: "What are you up to?", exact: true })
    .fill("Shooting hoops");
  await create
    .getByRole("button", { name: "Share Activity", exact: true })
    .click();
  await expect(create).toHaveCount(0);
  const note = section.getByTestId("activity-note-card");
  await expect(note).toContainText("Shooting hoops");
  expect((await note.boundingBox())!.height).toBeLessThanOrEqual(140);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("beacons-current-note.png") });
  await page.setViewportSize({ width: 320, height: 844 });
  await section.getByRole("button", { name: "Edit activity", exact: true }).click();
  const edit = page.getByRole("dialog", {
    name: "What are you up to?",
    exact: true,
  });
  await edit.getByRole("button", { name: "Edit activity note", exact: true }).click();
  await edit
    .getByRole("textbox", { name: "What are you up to?", exact: true })
    .fill("Practicing free throws");
  await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(note).toContainText("Practicing free throws");
  await section.getByRole("button", { name: "Edit activity", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "What are you up to?", exact: true });
  await picker.getByRole("button", { name: "Manage live Beacon", exact: true }).click();
  await picker
    .getByRole("button", { name: "Camera walk & a little coffee", exact: true })
    .click();
  await picker
    .getByRole("button", { name: "Use as My Current Activity", exact: true })
    .click();
  await expect(picker).toHaveCount(0);
  await expect(section.getByTestId("current-beacon-preview")).toContainText(
    "Camera walk & a little coffee",
  );
  await expect(
    section.getByRole("button", {
      name: "Edit activity",
      exact: true,
    }),
  ).toBeVisible();
  expect(await self.getByTestId("living-status-message").textContent()).toBe(
    originalStatus,
  );
  await page.screenshot({
    path: ".expo/identity-status/beacons-current-compact.png",
    fullPage: true,
  });
});
