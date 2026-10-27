import { expect, test, type Page } from "@playwright/test";
test.setTimeout(90000);

async function profile(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("add-activity-note")).toBeVisible();
}
async function shareNote(page: Page) {
  await page.getByTestId("add-activity-note").click();
  const editor = page.getByRole("dialog", {
    name: "What are you doing?",
    exact: true,
  });
  await editor
    .getByRole("textbox", { name: "What are you up to?", exact: true })
    .fill("Shooting hoops");
  await editor.getByRole("button", { name: "Fitness", exact: true }).click();
  await editor
    .getByRole("button", { name: "More details", exact: true })
    .click();
  await editor
    .getByRole("textbox", { name: "Add a place · Optional", exact: true })
    .fill("Campus Courts");
  await expect(
    editor.getByText(/This does not share your live location/),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Share Activity", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Shooting hoops");
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Campus Courts");
}

test("compact empty state, direct editing, independent Status and availability, screenshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await profile(page);
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    const row = page.getByTestId("add-activity-note");
    await expect(row.getByRole("button")).toHaveCount(0);
    const box = await row.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(96);
    const edit = await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .boundingBox();
    const share = await page
      .getByRole("button", { name: "Share profile", exact: true })
      .boundingBox();
    expect(edit!.y).toBeLessThan(box!.y);
    expect(share!.y).toBeLessThan(box!.y);
    await page.screenshot({
      path: `.expo/pass3/empty-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 1000 });
  await shareNote(page);
  await page
    .getByRole("button", { name: "Edit Activity Note", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit Activity Note",
    exact: true,
  });
  await expect(
    editor.getByRole("textbox", { name: "What are you up to?", exact: true }),
  ).toHaveValue("Shooting hoops");
  await editor
    .getByRole("textbox", { name: "What are you up to?", exact: true })
    .fill("Practicing free throws");
  await editor
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Campus Courts");
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toHaveCount(1);
  await page.getByTestId("living-status-message").click();
  const status = page.getByRole("dialog", {
    name: /Edit your status|Share your status/,
  });
  await status
    .getByRole("textbox", { name: "Status Note", exact: true })
    .fill("A personal message");
  await status
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(status).toHaveCount(0);
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Practicing free throws");
  await expect(page.getByTestId("living-status-message")).toContainText(
    "A personal message",
  );
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Campus Courts");
  await page
    .getByRole("button", { name: "Change availability", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Availability & sharing", exact: true })
    .getByRole("button", { name: "Not sharing availability", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Availability & sharing", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Practicing free throws");
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `.expo/pass3/solo-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("Do with others creates an independent Ping and offers featuring without replacing the note", async ({
  page,
}) => {
  await profile(page);
  await shareNote(page);
  await page
    .getByRole("button", { name: "Do with others", exact: true })
    .click();
  const sheet = page.getByRole("dialog", {
    name: "Do with others",
    exact: true,
  });
  await expect(
    page.getByRole("dialog", { name: "Edit Activity Note", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: ".expo/pass3/do-with-others.png" });
  await sheet.getByRole("button", { name: "Ping", exact: true }).click();
  const editor = page;
  await expect(page).toHaveURL(/planning\/create/);
  await expect(
    page.getByRole("dialog", { name: "Do with others", exact: true }),
  ).toHaveCount(0);
  await expect(
    editor.getByRole("textbox", {
      name: "What are you thinking?",
      exact: true,
    }),
  ).toHaveValue("Shooting hoops");
  await editor
    .getByRole("button", { name: "Create Ping", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Feature on Status", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Not Now", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Shooting hoops");
});

test("Council setup requires two options and retains the Activity Note", async ({
  page,
}) => {
  await profile(page);
  await shareNote(page);
  await page
    .getByRole("button", { name: "Do with others", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Do with others", exact: true })
    .getByRole("button", { name: "Vote", exact: true })
    .click();
  const editor = page;
  await expect(page).toHaveURL(/planning\/create/);
  await expect(
    page.getByRole("dialog", { name: "Do with others", exact: true }),
  ).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Create Vote Council", exact: true })
    .click();
  await expect(
    editor.getByText("Give the beacon a title (up to 120 characters).", {
      exact: true,
    }),
  ).toBeVisible();
  await editor
    .getByRole("textbox", { name: "Activity option", exact: true })
    .nth(1)
    .fill("Go for a walk");
  await editor
    .getByRole("button", { name: "Create Vote Council", exact: true })
    .click();
  await page.getByRole("button", { name: "Not Now", exact: true }).click();
  await expect(page.getByText("Go for a walk", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Shooting hoops");
});

test("explicit Current Beacon takeover preserves the Status Note and never resurrects the Activity Note", async ({
  page,
}) => {
  await profile(page);
  await shareNote(page);
  await page
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
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Shooting hoops");
  await picker
    .getByRole("button", { name: "Use as My Current Activity", exact: true })
    .click();
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("current-beacon-preview").filter({ visible: true }),
  ).toContainText("Camera walk & a little coffee");
  await page.screenshot({ path: ".expo/pass3/live.png", fullPage: true });
  await page
    .getByRole("button", { name: "Manage Current Activity", exact: true })
    .click();
  await picker
    .getByRole("button", { name: "Stop sharing Current Beacon", exact: true })
    .click();
  await expect(
    page.getByTestId("add-activity-note").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("living-status-message").filter({ visible: true }),
  ).toContainText("Free for coffee");
});

for (const appearance of ["light", "dark"]) {
  test(`Mint ${appearance}: keyboard entry, audience privacy, editor and larger text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ appearance }) => {
        localStorage.setItem("beacon.theme", "Mint");
        localStorage.setItem("beacon.appearance", appearance);
      },
      { appearance },
    );
    await profile(page);
    const add = page.getByTestId("add-activity-note");
    await add.focus();
    await page.keyboard.press("Enter");
    const editor = page.getByRole("dialog", {
      name: "What are you doing?",
      exact: true,
    });
    await expect(editor).toBeVisible();
    await editor
      .getByRole("textbox", { name: "What are you up to?", exact: true })
      .fill("A quiet afternoon working on my creative project");
    await editor
      .getByRole("button", { name: "Choose audience", exact: true })
      .click();
    const audience = page.getByRole("dialog", {
      name: "Choose audience",
      exact: true,
    });
    await audience
      .getByRole("button", { name: "Only me", exact: true })
      .click();
    await page.screenshot({ path: `.expo/pass3/editor-${appearance}.png` });
    await editor
      .getByRole("button", { name: "Share Activity", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    const note = page
      .getByTestId("activity-note-card")
      .filter({ visible: true });
    await expect(note).toContainText("A quiet afternoon");
    await page.addStyleTag({
      content:
        '[data-testid="activity-note-card"] [dir="auto"]{font-size:20px!important;line-height:28px!important;}',
    });
    await page.screenshot({
      path: `.expo/pass3/large-text-${appearance}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      (await page
        .getByRole("button", { name: "Do with others", exact: true })
        .boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
  });
}

test("paused owner controls and visitor Profile expose no owner creation affordances", async ({
  page,
}) => {
  await profile(page);
  await shareNote(page);
  await page
    .getByRole("button", { name: "Change availability", exact: true })
    .click();
  const controls = page.getByRole("dialog", {
    name: "Availability & sharing",
    exact: true,
  });
  await controls
    .getByRole("button", { name: "Pause Sharing", exact: true })
    .click();
  await expect(controls).toHaveCount(0);
  await page.screenshot({ path: ".expo/pass3/paused.png", fullPage: true });
  await page
    .getByRole("button", { name: "Change availability", exact: true })
    .click();
  await expect(
    controls.getByRole("button", { name: "Resume Sharing", exact: true }),
  ).toBeVisible();
  await controls
    .getByRole("button", { name: "Resume Sharing", exact: true })
    .click();
  await expect(controls).toHaveCount(0);
  await expect(
    page.getByTestId("activity-note-card").filter({ visible: true }),
  ).toContainText("Shooting hoops");
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search conversations", exact: true })
    .fill("Jordan");
  await page
    .getByRole("button", { name: "Message Jordan Ellis", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View Jordan Ellis's profile", exact: true })
    .click();
  await expect(page.getByTestId("person-profile-identity")).toBeVisible();
  await expect(
    page.getByTestId("add-activity-note").filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Do with others", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: ".expo/pass3/visitor.png", fullPage: true });
});

test("Featured creation hands off after dismissing the Status editor", async ({
  page,
}) => {
  await profile(page);
  await page.getByTestId("living-status-message").click();
  const status = page.getByRole("dialog", {
    name: /Edit your status|Share your status/,
  });
  await status
    .getByRole("button", {
      name: /^(Attach Activity|Change attached activity)$/,
    })
    .click();
  await status.getByRole("button", { name: "Create New", exact: true }).click();
  await status
    .getByRole("button", { name: "Create Ping", exact: true })
    .click();
  await expect(status).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Start a ping or decision", exact: true }),
  ).toBeVisible();
});
