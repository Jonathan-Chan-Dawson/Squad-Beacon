import { expect, test } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { startDemoFromEntry } from "./demoEntry";

test("tiny Profile Beacon can open a surprise draft with inline timing choices", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-identity")).toBeVisible();
  const icon = page.getByTestId("profile-tiny-beacon").locator("svg");
  const trigger = page.getByRole("button", { name: "Tap the tiny Beacon" });
  const noteBox = (await page.getByTestId("living-status-message").boundingBox())!;
  const triggerBox = (await trigger.boundingBox())!;
  expect(triggerBox.x).toBeGreaterThanOrEqual(noteBox.x + noteBox.width);
  expect(Math.abs(triggerBox.y + triggerBox.height / 2 - noteBox.y - noteBox.height / 2)).toBeLessThan(2);
  const firstColor = (await icon.getAttribute("stroke"))!;
  expect(firstColor).toMatch(/^#/);
  await trigger.click();
  await expect(icon).not.toHaveAttribute("stroke", firstColor);
  for (let tap = 1; tap < 8; tap++) await trigger.click();
  const draftAction = page.getByRole("button", { name: "Open surprise draft" });
  await expect(draftAction).toBeVisible();
  await draftAction.click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(/Coffee together|Study together|Go for a walk/);
  const timing = page.getByTestId("inline-beacon-timing");
  const later = timing.getByLabel("Start time: In 30 min", { exact: true });
  await later.click();
  await expect(later).toHaveAttribute("aria-selected", "true");
  const duration = timing.getByLabel("Duration: 2 hours", { exact: true });
  await duration.click();
  await expect(duration).toHaveAttribute("aria-selected", "true");
  await expect(timing.getByRole("button", { name: /^Ends,/ })).toBeVisible();
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
    const home = page.getByTestId("home-identity-status");
    const avatar = home.getByTestId("home-status-avatar");
    const homeNote = home.getByTestId("living-status-message");
    await expect(avatar).toBeVisible();
    const homeBox = (await home.boundingBox())!;
    const noteBoxAtHome = (await homeNote.boundingBox())!;
    const availabilityBoxAtHome = (await home
      .getByRole("button", { name: "Change availability", exact: true })
      .boundingBox())!;
    const sonar = home.getByRole("button", { name: "Open Sonar", exact: true });
    const sonarBox = (await sonar.boundingBox())!;
    expect(
      sonarBox.x - (availabilityBoxAtHome.x + availabilityBoxAtHome.width),
    ).toBeGreaterThanOrEqual(4);
    expect(Math.abs(sonarBox.y - availabilityBoxAtHome.y)).toBeLessThanOrEqual(
      1,
    );
    expect(sonarBox.height).toBeGreaterThanOrEqual(44);
    await expect(sonar).toHaveAccessibleName("Open Sonar");
    const myStatus = page.getByTestId("home-my-status");
    const homeActivity = myStatus.getByTestId("current-activity-section");
    await expect(homeActivity).toHaveCSS("border-top-width", "1px");
    await expect(homeActivity).toHaveCSS("padding-top", "8px");
    const dialogueColor = appearance === "dark" ? "rgb(39, 39, 42)" : "rgb(242, 242, 243)";
    await expect(homeNote.getByTestId("status-note-dialogue")).toHaveCSS("background-color", dialogueColor);
    const addActivity = myStatus.getByTestId("add-activity-note");
    await expect(addActivity).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(addActivity.getByText("Add", { exact: true })).toBeVisible();
    const chooseBeacon = myStatus.getByRole("button", { name: "Choose live Beacon", exact: true });
    await expect(chooseBeacon).toBeVisible();
    expect((await chooseBeacon.boundingBox())!.y).toBeGreaterThan((await addActivity.boundingBox())!.y);
    await myStatus.screenshot({ path: test.info().outputPath(`status-home-${width}-${appearance}.png`) });
    expect((await myStatus.boundingBox())!.height).toBeLessThanOrEqual(280);
    await expect(page.getByTestId("home-status-card")).toHaveCount(0);
    await expect(page.getByTestId("home-personal-timeline")).toHaveCSS("border-top-width", "1px");
    expect(
      (await myStatus.getByTestId("add-activity-note").boundingBox())!.height,
    ).toBeLessThanOrEqual(56);
    await expect(
      myStatus.getByText("Current Activity", { exact: true }),
    ).toHaveCount(0);
    await sonar.click();
    const sonarMenu = page.getByRole("dialog", {
      name: "Share location with",
      exact: true,
    });
    await expect(sonarMenu).toBeVisible();
    await sonarMenu.getByRole("button", { name: "Close", exact: true }).click();
    const avatarBox = (await avatar.boundingBox())!;
    expect(avatarBox.width).toBeGreaterThanOrEqual(76);
    expect(avatarBox.height).toBeGreaterThanOrEqual(
      (noteBoxAtHome.y + noteBoxAtHome.height - availabilityBoxAtHome.y) * 0.7,
    );
    expect(await home.getByText("Alex Morgan", { exact: true }).evaluate(
      (node) => node.scrollWidth <= node.clientWidth + 1,
    )).toBe(true);
    expect(noteBoxAtHome.x).toBeGreaterThanOrEqual(avatarBox.x + avatarBox.width + 8);
    expect(noteBoxAtHome.x + noteBoxAtHome.width).toBeLessThanOrEqual(homeBox.x + homeBox.width + 1);
    expect(noteBoxAtHome.y).toBeGreaterThanOrEqual(avatarBox.y);
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
    await home
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
    await expect(availability).toHaveCount(0);
    await expect(homeNote).toContainText("Coffee, then a creative afternoon");
    await page.screenshot({
      path: test.info().outputPath(`beacons-${width}-${appearance}.png`),
      fullPage: true,
    });
    if (width === 320 && appearance === "dark") {
      const largerText = await page.addStyleTag({
        content:
          '[data-testid="home-my-status"] [dir="auto"] { font-size: 20px !important; line-height: 28px !important; }',
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const largeAvailability = (await home
        .getByRole("button", { name: "Change availability", exact: true })
        .boundingBox())!;
      const largeSonar = (await sonar.boundingBox())!;
      expect(
        largeSonar.x - (largeAvailability.x + largeAvailability.width),
      ).toBeGreaterThanOrEqual(4);
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
    await expect(page.getByRole("button", { name: "Add Activity Note", exact: true }).getByText("Add", { exact: true })).toBeVisible();
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
      .getByRole("button", { name: "Add Activity Note", exact: true })
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
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  const section = page.getByTestId("home-my-status");
  const originalStatus = await section
    .getByTestId("living-status-message")
    .textContent();
  await section
    .getByRole("button", { name: "Add Activity Note", exact: true })
    .click();
  const create = page.getByRole("dialog", {
    name: "What are you doing?",
    exact: true,
  });
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
  await note
    .getByRole("button", { name: "Edit Activity Note", exact: true })
    .click();
  const edit = page.getByRole("dialog", {
    name: "Edit Activity Note",
    exact: true,
  });
  await edit
    .getByRole("textbox", { name: "What are you up to?", exact: true })
    .fill("Practicing free throws");
  await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(note).toContainText("Practicing free throws");
  await note
    .getByRole("button", { name: "Activity Note options", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Activity Note", exact: true })
    .getByRole("button", { name: "Switch to live Beacon", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Choose live Beacon",
    exact: true,
  });
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
      name: "Manage Current Activity",
      exact: true,
    }),
  ).toBeVisible();
  expect(await section.getByTestId("living-status-message").textContent()).toBe(
    originalStatus,
  );
  await page.screenshot({
    path: ".expo/identity-status/beacons-current-compact.png",
    fullPage: true,
  });
});
