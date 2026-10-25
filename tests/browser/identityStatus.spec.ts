import { expect, test } from "@playwright/test";

for (const [width, appearance] of [
  [320, "dark"],
  [430, "dark"],
  [320, "light"],
  [430, "light"],
  [1024, "dark"],
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
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
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
      availabilityBoxAtHome.x + availabilityBoxAtHome.width,
    ).toBeLessThanOrEqual(sonarBox.x);
    expect(Math.abs(sonarBox.y - availabilityBoxAtHome.y)).toBeLessThanOrEqual(
      1,
    );
    expect(sonarBox.height).toBeGreaterThanOrEqual(44);
    await expect(home).toContainText("Sonar Off");
    const myStatus = page.getByTestId("home-my-status");
    expect((await myStatus.boundingBox())!.height).toBeLessThanOrEqual(230);
    expect(
      (await myStatus.getByTestId("add-activity-note").boundingBox())!.height,
    ).toBeLessThanOrEqual(56);
    await expect(
      myStatus.getByText("Current Activity", { exact: true }),
    ).toHaveCount(0);
    await sonar.click();
    const sonarMenu = page.getByRole("dialog", {
      name: "Start Sonar",
      exact: true,
    });
    await expect(sonarMenu).toBeVisible();
    await sonarMenu.getByRole("button", { name: "Close", exact: true }).click();
    expect(Math.abs(noteBoxAtHome.x - homeBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(noteBoxAtHome.width - homeBox.width)).toBeLessThanOrEqual(
      1,
    );
    expect(noteBoxAtHome.y).toBeGreaterThanOrEqual(
      (await avatar.boundingBox())!.y + 44,
    );
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
      path: `.expo/identity-status/beacons-${width}-${appearance}.png`,
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
      await page.screenshot({
        path: ".expo/identity-status/beacons-large-text.png",
      });
      await largerText.evaluate((node) => node.remove());
    }
    await avatar.click();
    const identity = page.getByTestId("profile-identity");
    const note = identity.getByTestId("living-status-message");
    const pill = identity.getByRole("button", {
      name: "Change availability",
      exact: true,
    });
    await expect(note).toContainText("Coffee, then a creative afternoon");
    await expect(pill).toContainText("Busy");
    const noteBox = (await note.boundingBox())!;
    const pillBox = (await pill.boundingBox())!;
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
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
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
