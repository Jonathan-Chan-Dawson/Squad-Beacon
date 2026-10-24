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
    expect(
      Math.abs(
        availabilityBoxAtHome.x +
          availabilityBoxAtHome.width -
          homeBox.x -
          homeBox.width,
      ),
    ).toBeLessThanOrEqual(1);
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
