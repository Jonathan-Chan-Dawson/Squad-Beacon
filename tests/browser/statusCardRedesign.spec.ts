import { expect, test, type Page } from "@playwright/test";
import { settleEditor } from "./statusHelpers";

async function home(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
}
// Create owned sources through the existing UI; the demo's planning sources belong to friends.
async function homeWithPlanningSources(page: Page, kinds: string[]) {
  await page.goto("/councils");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  for (const kind of kinds) {
    await page
      .getByRole("button", { name: "Start a ping, vote, or draw", exact: true })
      .click();
    const composer = page.getByRole("dialog", {
      name: "Start a ping or decision",
      exact: true,
    });
    await composer.getByRole("button", { name: kind, exact: true }).click();
    await composer
      .getByRole("textbox", { name: "Question or decision", exact: true })
      .fill(
        kind === "Draw"
          ? "Status card Draw: coffee, a creative detour, and a relaxed evening with everyone from the neighborhood"
          : `Status card ${kind}`,
      );
    await composer
      .getByRole("button", { name: "Create ping or decision", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pings & Decisions", exact: true })
      .click();
  }
  for (
    let index = 0;
    index < 5 &&
    !(await page.getByRole("tab", { name: "Beacons", exact: true }).count());
    index++
  ) {
    await page
      .getByRole("button", { name: "Back", exact: true })
      .last()
      .click();
  }
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
}

const editorFor = (page: Page) =>
  page.getByRole("dialog", { name: /Edit your status|Share your status/ });

test("homepage draft entry points retain edits, failed saves, and explicit publication", async ({
  page,
}) => {
  test.setTimeout(60000);
  await home(page);
  const card = page.getByTestId("compact-own-status");
  const editor = editorFor(page);
  const note = editor.getByRole("textbox", {
    name: "Activity Note",
    exact: true,
  });
  await card
    .getByRole("button", { name: /Edit your status note|Add a status note/ })
    .click();
  await note.fill("Coffee and a creative detour");
  await editor.getByRole("button", { name: /Close/ }).click();
  await expect(card).not.toContainText("Coffee and a creative detour");
  await card
    .getByRole("button", { name: "Attach Activity", exact: true })
    .click();
  await editor.getByTestId("status-attachment-preview").first().click();
  await expect(note).toHaveValue("Coffee and a creative detour");
  await expect(
    editor.getByRole("radio", { name: "Both", exact: true }),
  ).toBeChecked();
  await editor.getByRole("radio", { name: "Activity", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    editor.getByRole("radio", { name: "Activity", exact: true }),
  ).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(
    editor.getByRole("radio", { name: "Both", exact: true }),
  ).toBeChecked();
  await expect(
    editor.getByRole("radio", { name: "Both", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");

  await expect(
    editor.getByRole("radio", { name: "Activity", exact: true }),
  ).toBeChecked();
  await expect(editor.getByTestId("draft-preview-note")).toHaveCount(0);
  await editor.getByRole("button", { name: /Close/ }).click();
  await card
    .getByRole("button", { name: "Status options", exact: true })
    .click();
  await expect(note).toHaveValue("Coffee and a creative detour");
  await expect(
    editor.getByRole("radio", { name: "Activity", exact: true }),
  ).toBeChecked();
  await editor
    .getByRole("textbox", {
      name: "Duration in minutes (5 to 1440)",
      exact: true,
    })
    .fill("0");
  await editor.screenshot({
    path: ".expo/status-card-pt2/unavailable-editor.png",
  });
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText("Choose a duration");
  await editor.getByRole("button", { name: /Close/ }).click();
  await card
    .getByRole("button", { name: /Edit your status note|Add a status note/ })
    .click();
  await expect(note).toHaveValue("Coffee and a creative detour");
  await editor
    .getByRole("textbox", {
      name: "Duration in minutes (5 to 1440)",
      exact: true,
    })
    .fill("60");
  await editor.getByRole("radio", { name: "Both", exact: true }).click();
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(card).toContainText("Coffee and a creative detour");
  await expect(card.getByTestId("own-status-featured")).toBeVisible();
  await card
    .getByRole("button", { name: "Edit your status note", exact: true })
    .click();
  await note.fill("Unsaved creative detour");
  await editor.getByRole("button", { name: /Close/ }).click();
  await card
    .getByTestId("own-status-featured")
    .getByTestId("status-attachment-preview")
    .click();
  await expect(page).toHaveURL(/\/activity\//);
  await page.getByRole("button", { name: "Back", exact: true }).last().click();
  await expect(card).toContainText("Coffee and a creative detour");
  await card
    .getByRole("button", { name: "Edit your status note", exact: true })
    .click();
  await expect(note).toHaveValue("Unsaved creative detour");
  await editor.getByRole("button", { name: /Close/ }).click();

  await card
    .getByRole("button", { name: "Change attached activity", exact: true })
    .click();
  await expect(
    editor.getByText("Available to Feature", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Save Status", exact: true }),
  ).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Back to note", exact: true })
    .click();
  await editor.getByRole("radio", { name: "Note", exact: true }).click();
  await expect(
    editor
      .getByTestId("status-draft-preview")
      .getByTestId("status-attachment-preview"),
  ).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(card).toContainText("Activity attached · hidden");
  await expect(card.getByTestId("own-status-featured")).toHaveCount(0);
});

test("card hierarchy, activity types, privacy preview, and responsive touch targets", async ({
  page,
}) => {
  test.setTimeout(120000);
  await homeWithPlanningSources(page, ["Ping", "Vote", "Draw"]);
  const card = page.getByTestId("compact-own-status");
  const editor = editorFor(page);
  await card
    .getByRole("button", { name: "Attach Activity", exact: true })
    .click();
  for (const [filter, kind] of [
    ["Pings", "ping"],
    ["Beacons", "beacon"],
    ["Votes", "vote"],
    ["Draws", "draw"],
  ]) {
    await editor.getByRole("button", { name: filter, exact: true }).click();
    await editor
      .getByRole("button", { name: new RegExp(`^${kind}:`) })
      .first()
      .click();
    await editor.getByRole("radio", { name: "Both", exact: true }).click();
    await expect(
      editor
        .getByTestId("status-draft-preview")
        .getByTestId("status-attachment-preview"),
    ).toBeVisible();
    await editor
      .getByRole("button", { name: "Change attached activity", exact: true })
      .click();
  }
  await editor
    .getByRole("button", { name: "Back to note", exact: true })
    .click();
  await editor
    .getByRole("textbox", { name: "Activity Note", exact: true })
    .fill("Free for coffee and a creative detour with friends this evening");
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const avatar = (await card.getByTestId("own-status-avatar").boundingBox())!;
    const note = (await card.getByTestId("own-status-note").boundingBox())!;
    expect(avatar.x + avatar.width).toBeLessThanOrEqual(note.x);
    for (const target of [
      card.getByRole("button", { name: "Status settings", exact: true }),
      card.getByRole("button", { name: "Status options", exact: true }),
      card.getByRole("button", {
        name: "Change attached activity",
        exact: true,
      }),
      card.getByTestId("availability-dropdown"),
      card.getByRole("button", { name: "Open Sonar", exact: true }),
    ]) {
      const box = (await target.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card.screenshot({ path: `.expo/status-card-pt2/home-${width}.png` });
    await card.getByRole("button", { name: /Edit your status note/ }).click();
    await settleEditor(page);
    await editor.screenshot({
      path: `.expo/status-card-pt2/editor-${width}.png`,
    });
    await editor.getByRole("button", { name: /Close/ }).click();
    await expect(editor).toHaveCount(0);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await card
    .getByTestId("own-status-note")
    .locator("div")
    .first()
    .evaluate((node) => {
      node.style.fontSize = "22px";
      node.style.lineHeight = "30px";
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await card.screenshot({ path: ".expo/status-card-pt2/large-text-320.png" });
  await card
    .getByRole("button", { name: "Status options", exact: true })
    .click();
  await editor.getByRole("switch", { name: "Hide Note", exact: true }).check();
  await expect(editor.getByTestId("draft-preview-note")).toHaveCount(0);
  await expect(
    editor
      .getByTestId("status-draft-preview")
      .getByTestId("status-attachment-preview"),
  ).toHaveCount(0);
  await editor
    .getByRole("switch", { name: "Pause Status Sharing", exact: true })
    .check();
  await expect(editor.getByTestId("status-draft-preview")).toContainText(
    "Nothing is shared",
  );
  await expect(
    editor.getByRole("switch", { name: "Show My Current Beacon", exact: true }),
  ).not.toBeChecked();
  await settleEditor(page);
  await editor.screenshot({
    path: ".expo/status-card-pt2/paused-editor-320.png",
  });
});

test("Activity mode never reveals retained text when its attachment expires or is removed", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.clock.install();
  await homeWithPlanningSources(page, ["Ping"]);
  const card = page.getByTestId("compact-own-status");
  await card
    .getByRole("button", { name: "Attach Activity", exact: true })
    .click();
  const editor = editorFor(page);
  await editor.getByRole("button", { name: "Pings", exact: true }).click();
  await editor
    .getByRole("button", { name: /^ping:/ })
    .first()
    .click();
  await editor
    .getByRole("textbox", { name: "Activity Note", exact: true })
    .fill("Retained private text");
  await editor.getByRole("radio", { name: "Activity", exact: true }).click();
  await page.clock.fastForward(15 * 24 * 60 * 60 * 1000);
  await expect(
    editor.getByText("Attached activity unavailable. Change or remove it.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    editor.getByRole("radio", { name: "Activity", exact: true }),
  ).toBeChecked();
  await expect(editor.getByTestId("status-draft-preview")).not.toContainText(
    "Retained private text",
  );
  await editor.screenshot({
    path: ".expo/status-card-pt2/unavailable-editor.png",
  });
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText(
    "Your Status changed while editing",
  );
  await expect(
    editor.getByRole("textbox", { name: "Activity Note", exact: true }),
  ).toHaveValue("Retained private text");
  await editor
    .getByRole("button", { name: "Remove attached activity", exact: true })
    .click();
  await expect(
    editor.getByRole("radio", { name: "Activity", exact: true }),
  ).toBeChecked();
  await expect(editor.getByTestId("status-draft-preview")).not.toContainText(
    "Retained private text",
  );
  await editor
    .getByRole("textbox", { name: "Activity Note", exact: true })
    .fill("");
  await expect(editor.getByTestId("draft-preview-note")).toHaveCount(0);
});

test("scheduling remains separate from the current note and availability", async ({
  page,
}) => {
  await home(page);
  const card = page.getByTestId("compact-own-status");
  const originalNote = await card.getByTestId("own-status-note").textContent();
  await card
    .getByRole("button", { name: "Status settings", exact: true })
    .click();
  const timing = page.getByRole("dialog", {
    name: "Share your availability",
    exact: true,
  });
  const schedules = timing.getByRole("button", { name: /^Scheduled ·/ });
  const originalSchedules = await schedules.allTextContents();
  expect(originalSchedules.length).toBeGreaterThan(0);
  await schedules.first().click();
  await expect(
    timing.getByRole("button", { name: "Schedule availability", exact: true }),
  ).toBeVisible();
  await timing.getByRole("button", { name: /Close/ }).click();
  await expect(card.getByTestId("own-status-note")).toHaveText(originalNote!);
  await card
    .getByRole("button", { name: "Status settings", exact: true })
    .click();
  await expect(
    timing.getByRole("button", { name: "Schedule availability", exact: true }),
  ).toHaveCount(0);
  expect(await schedules.allTextContents()).toEqual(originalSchedules);
});
