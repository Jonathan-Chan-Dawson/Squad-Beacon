import { expect, test, type Page } from "@playwright/test";

async function openProfile(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-identity")).toBeVisible();
}

test("profile uses phone-sized identity and visibility changes do not start Sonar", async ({
  page,
}) => {
  await openProfile(page);
  const identity = await page.getByTestId("profile-identity").boundingBox();
  const avatar = await page.getByTestId("profile-avatar").boundingBox();
  expect(identity!.width).toBeGreaterThanOrEqual(350);
  expect(identity!.width).toBeLessThanOrEqual(360);
  expect(avatar!.width).toBeGreaterThanOrEqual(96);
  await page
    .getByRole("button", { name: "Profile visibility", exact: true })
    .click();
  const form = page.getByTestId("profile-visibility-form");
  await expect(form).toBeVisible();
  await expect(
    form.getByText(/These grants control profile details only/),
  ).toBeVisible();
  await form.getByRole("button", { name: "Custom", exact: true }).click();
  await expect(
    form.getByText("Your private lists", { exact: true }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Friends", exact: true }).click();
  await form
    .getByRole("button", { name: "Save profile privacy", exact: true })
    .click();
  await expect(form).not.toBeVisible();
  await expect(
    page.getByText("Profile visibility: Friends", { exact: true }),
  ).toBeVisible();
  const sonar = page.getByTestId("profile-sonar-card");
  await sonar.scrollIntoViewIfNeeded();
  await expect(
    sonar.getByText("Location sharing is off", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Widget Studio", exact: true }),
  ).toHaveCount(0);
});

test("Sonar requires picked friends and explicit confirmation and the demo never starts location", async ({
  page,
}) => {
  await openProfile(page);
  const sonar = page.getByTestId("profile-sonar-card");
  await sonar.scrollIntoViewIfNeeded();
  await sonar.getByRole("button", { name: "Start Sonar", exact: true }).click();
  const confirmation = page.getByTestId("profile-sonar-confirmation");
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByText(
      "Temporary. Only the friends you pick. Not a safety service.",
      { exact: true },
    ),
  ).toBeVisible();
  const start = confirmation.getByRole("button", {
    name: "Confirm and start Sonar",
    exact: true,
  });
  await expect(start).toBeDisabled();
  await confirmation
    .getByRole("checkbox", { name: /^Share location with/ })
    .first()
    .click();
  await expect(start).toBeEnabled();
  await start.click();
  await expect(
    confirmation.getByText(
      "The demo never shares your device location. Use a real account and mobile development build.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    sonar.getByText("Location sharing is off", { exact: true }),
  ).toBeVisible();
});

test("the full-screen editor keeps Save reachable and confirms dirty dismissal", async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const editor = page.getByTestId("profile-editor");
  await expect(editor).toBeVisible();
  const name = editor.getByRole("textbox", { name: "Name", exact: true });
  const originalName = await name.inputValue();
  await name.fill("Phone sized profile");
  await expect(page.getByTestId("profile-editor-save-bar")).toBeInViewport();
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(
    page.getByText("Discard your changes?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(name).toHaveValue("Phone sized profile");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page
      .getByTestId("profile-identity")
      .getByText(originalName, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Phone sized profile");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page
      .getByTestId("profile-identity")
      .getByText("Phone sized profile", { exact: true }),
  ).toBeVisible();
});

test("settings search exposes privacy and location and all palettes apply in Light and Dark", async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const search = page.getByRole("textbox", {
    name: "Search settings",
    exact: true,
  });
  await search.fill("privacy");
  await expect(
    page.getByRole("button", { name: "Profile visibility", exact: true }),
  ).toBeInViewport();
  await search.fill("location");
  await expect(
    page.getByRole("button", { name: "Sonar defaults", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Location permission", exact: true }),
  ).toBeInViewport();
  await search.fill("appearance");
  for (const mode of ["Light", "Dark"] as const) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("beacon.appearance")),
      )
      .toBe(mode.toLowerCase());
    for (const palette of ["Mint", "Sunset", "Midnight", "Ocean", "Berry"]) {
      const option = page.getByRole("button", {
        name: `${palette} palette`,
        exact: true,
      });
      await option.scrollIntoViewIfNeeded();
      await option.click();
      await expect(option).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("beacon.theme")))
        .toBe(palette);
    }
  }
  await search.fill("nonsense search with no matches");
  await expect(page.getByText(/No settings match/)).toBeVisible();
});
