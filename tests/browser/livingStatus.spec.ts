import { test, expect } from "@playwright/test";
import { settleEditor } from "./statusHelpers";

test("blank Current-only Status, independent note privacy, and paused preference continuity", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
  await page
    .getByRole("button", { name: /Edit your status note|Add a status note/ })
    .click();
  const editor = page.getByRole("dialog", {
    name: /Edit your status|Share your status/,
  });
  const note = editor.getByRole("textbox", {
    name: "Activity Note",
    exact: true,
  });
  const current = editor.getByRole("switch", {
    name: "Show My Current Beacon",
    exact: true,
  });
  await expect(current).not.toBeChecked();
  await note.fill("");
  await current.check();
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await editor.screenshot({
      path: `.expo/living-status/editor-${width}.png`,
    });
  }
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByTestId("profile-status-bubble").click();
  const viewer = page.getByRole("dialog", {
    name: "Status & activity",
    exact: true,
  });
  await expect(viewer.getByTestId("current-beacon-preview")).toHaveCount(1);
  await viewer.getByTestId("current-beacon-preview").click();
  await expect(page).toHaveURL(/\/activity\//);
  await page.getByRole("button", { name: "Back", exact: true }).last().click();
  await expect(page.getByTestId("profile-status-bubble")).toBeVisible();
  await page.getByTestId("profile-status-bubble").click();
  await expect(viewer.getByTestId("status-note-speech-bubble")).toHaveCount(0);
  await expect(viewer.getByTestId("featured-status-activity")).toHaveCount(0);
  await expect(viewer.getByText(/Also happening|See all/)).toHaveCount(0);
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `.expo/living-status/current-only-${width}.png`,
    });
    expect(
      await viewer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
  }
  await viewer.getByRole("button", { name: /Close/ }).click();
  await page
    .getByRole("button", { name: "Edit your status", exact: true })
    .click();
  await expect(note).toHaveValue("");
  await expect(current).toBeChecked();
  await note.fill("Basketball tonight?");
  await editor
    .getByRole("button", {
      name: "Status audience, timing and privacy",
      exact: true,
    })
    .click();
  await settleEditor(page);
  await editor
    .getByRole("switch", {
      name: "Hide Note",
      exact: true,
    })
    .check();
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await page.getByTestId("profile-status-bubble").click();
  await expect(viewer.getByTestId("status-note-speech-bubble")).toHaveCount(0);
  await expect(viewer.getByTestId("current-beacon-preview")).toHaveCount(1);
  await viewer.getByRole("button", { name: /Close/ }).click();
  await page
    .getByRole("button", { name: "Edit your status", exact: true })
    .click();
  await editor
    .getByRole("button", {
      name: "Status audience, timing and privacy",
      exact: true,
    })
    .click();
  await settleEditor(page);
  await settleEditor(page);
  await editor
    .getByRole("switch", { name: "Pause Status Sharing", exact: true })
    .check();
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(page.getByTestId("profile-status-bubble")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit your status", exact: true })
    .click();
  await expect(note).toHaveValue("Basketball tonight?");
  await expect(current).toBeChecked();
  await editor
    .getByRole("button", {
      name: "Status audience, timing and privacy",
      exact: true,
    })
    .click();
  await expect(
    editor.getByRole("switch", { name: "Pause Status Sharing", exact: true }),
  ).toBeChecked();
});

test("matching featured and Current Beacon merge without a second activity row", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
  await page
    .getByRole("button", { name: /Edit your status note|Add a status note/ })
    .click();
  const editor = page.getByRole("dialog", {
    name: /Edit your status|Share your status/,
  });
  await editor
    .getByRole("textbox", { name: "Activity Note", exact: true })
    .fill("Camera charged ☕");
  await settleEditor(page);
  await editor
    .getByRole("switch", { name: "Show My Current Beacon", exact: true })
    .check();
  await editor
    .getByRole("button", { name: "Attach Activity", exact: true })
    .click();
  await editor
    .getByRole("button", { name: /beacon: Camera walk & a little coffee/i })
    .click();
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByTestId("profile-status-bubble").click();
  const viewer = page.getByRole("dialog", {
    name: "Status & activity",
    exact: true,
  });
  await expect(viewer.getByTestId("featured-status-activity")).toHaveCount(1);
  await expect(
    viewer.getByTestId("featured-status-activity").getByText(/Happening now/i),
  ).toBeVisible();
  await expect(
    viewer.getByText("Camera walk & a little coffee", { exact: true }),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: ".expo/living-status/merged-320.png" });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: ".expo/living-status/merged-375.png" });
});
