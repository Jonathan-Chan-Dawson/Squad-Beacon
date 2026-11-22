import { expect, test } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { startDemoFromEntry } from "./demoEntry";

test("tiny Profile Beacon toast opens the Machine and can seed a Beacon", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-identity")).toBeVisible();
  const icon = page.getByTestId("profile-tiny-beacon").locator("svg").last();
  const count = page.getByTestId("profile-tiny-beacon-count");
  const trigger = page.getByRole("button", { name: "Tap the tiny Beacon" });
  const noteBox = (await page.getByTestId("living-status-message").boundingBox())!;
  const triggerBox = (await trigger.boundingBox())!;
  expect(triggerBox.x).toBeGreaterThanOrEqual(noteBox.x + noteBox.width);
  expect(Math.abs(triggerBox.y + triggerBox.height / 2 - noteBox.y - noteBox.height / 2)).toBeLessThan(2);
  const firstColor = (await icon.getAttribute("stroke"))!;
  expect(firstColor).toMatch(/^#/);
  await expect(count).toHaveText("1,500");
  await trigger.click();
  await expect(count).toHaveText("1,500");
  await expect(icon).not.toHaveAttribute("stroke", firstColor);
  for (let tap = 1; tap < 8; tap++) await trigger.click();
  await expect(count).toHaveText("1,502");
  await expect(trigger).toHaveAttribute("aria-valuetext", "1502 points, Citywide stage");
  await expect(page).toHaveURL(/\/profile$/);
  const toast = page.getByRole("button", { name: /Open Spontaneity Machine$/ });
  await expect(toast).toBeVisible();
  await toast.click();
  await expect(page).toHaveURL(/\/spontaneity$/);
  await page.getByRole("button", { name: "Generate Side Quest", exact: true }).click();
  const title = await page.getByTestId("side-quest-title").innerText();
  await page.getByRole("button", { name: "Create Beacon", exact: true }).click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(title);
  const timing = page.getByTestId("inline-beacon-timing");
  const later = timing.getByLabel("Start time: In 30 min", { exact: true });
  await later.click();
  await expect(later).toHaveAttribute("aria-selected", "true");
  const duration = timing.getByRole("radio", { name: "2 hours", exact: true });
  await duration.click();
  await expect(duration).toBeChecked();
  await expect(timing.getByRole("button", { name: "Start time: Choose date", exact: true })).toBeVisible();
});

test("tiny Beacon saves progress through the five-million-point upgrade", async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
  await mockOnboardingAccount(page, { signedOut: true });
  const key = `beacon.viewer-defaults.${Array.from("demo-you", char => char.codePointAt(0)!.toString(16)).join("-")}`;
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify({ tinyBeaconTaps: 4_998_499 }));
  }, key);
  async function openProfile() {
    await page.goto("/auth/sign-in");
    await startDemoFromEntry(page);
    await expect(page.getByTestId("full-map-screen")).toBeVisible();
    await page.getByRole("tab", { name: "Profile", exact: true }).click();
  }
  await openProfile();
  const trigger = page.getByRole("button", { name: "Tap the tiny Beacon" });
  const milestone = "5000000 points, Infinite Signal stage";
  await expect(trigger).toHaveAttribute("aria-valuetext", /The Last Star stage/);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-valuetext", milestone);
  await expect(page.getByText("Infinite Signal unlocked", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").tinyBeaconTaps, key)).toBe(4_998_500);
  await page.getByRole("button", { name: "View score", exact: true }).click();
  await expect(page.getByText("5,000,000 points · Infinite Signal · Level 50")).toBeVisible();
  await openProfile();
  await expect(trigger).toHaveAttribute("aria-valuetext", milestone);
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
