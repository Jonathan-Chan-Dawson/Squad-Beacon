import { expect, test } from "@playwright/test";

test("calendar, selected friends, place search, and Map cancellation preserve one draft", async ({
  page,
}) => {
  const query = new URLSearchParams({
    editor: "yes",
    inviteeIds: JSON.stringify(["jordan"]),
    startsAt: "2026-12-25T15:00:00-06:00",
    timezone: "America/Chicago",
    latitude: "32.6099",
    longitude: "-85.4808",
    placeLabel: "Campus meeting point",
  });
  await page.goto(`/create?${query}`);
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Calendar and Map handoff");
  await expect(
    page.getByRole("button", { name: /^Starts, Dec 25, 3:00 PM/ }),
  ).toBeVisible();
  await expect(page.getByText("1/20 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Modules", exact: true }).click();
  await page.getByRole("switch", { name: "Checklist", exact: true }).check();
  await page
    .getByRole("button", { name: "Adjust on Map", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel location selection", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Calendar and Map handoff",
  );
  await expect(
    page.getByRole("button", { name: "Modules", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("switch", { name: "Checklist", exact: true }),
  ).toBeChecked();

  await expect(
    page.getByText("Campus meeting point", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Starts, Dec 25, 3:00 PM/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Change location", exact: true })
    .click();
  await page.getByLabel("Meeting place", { exact: true }).fill("Auburn");
  await page
    .getByRole("button", { name: "Choose Auburn", exact: true })
    .click();
  await expect(page.getByText("Auburn", { exact: true })).toBeVisible();
  await expect(page.getByText("1/20 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const review = page.getByRole("dialog", {
    name: "Review your Beacon",
    exact: true,
  });
  await expect(review.getByText("Auburn", { exact: true })).toBeVisible();
  await expect(
    review.getByText("Invitations & notifications", { exact: true }),
  ).toBeVisible();
});

test("storage failure blocks publication and reports that recovery is not saved", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("beacon.creation."))
        throw new DOMException("Draft storage is full", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  await page.goto("/create?editor=yes");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Storage failure check");
  await page.getByRole("button", { name: "Use online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meeting");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirm publication", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Draft storage is full/).first()).toBeVisible();
  await expect(
    page.getByText(/If saving failed, keep this editor open/),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/activity-created/);
});

test("tablet layout and larger browser text retain a reachable footer and scrolling sheets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/create?editor=yes");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("A long title for a larger display and larger text");
  await page.addStyleTag({
    content:
      'input, button, [role="button"] {font-size:20px !important;line-height:1.4 !important;}',
  });
  await expect(
    page.getByRole("button", { name: "Create Beacon", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: ".expo/creation-polish/editor-tablet-large-text.png",
  });
  await page
    .getByRole("button", { name: "Advanced Options", exact: true })
    .click();
  await page
    .getByLabel("Description & details", { exact: true })
    .fill("Extra instructions and things to bring.");
  await page
    .getByRole("button", { name: "Advanced Options", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeInViewport();
});

test("organizer roles are granted and removed only through the post-publication People route", async ({
  page,
}) => {
  await page.goto("/activity/demo-you-showcase-live");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "People", exact: true }).click();
  await page
    .getByRole("button", { name: "Organizer roles", exact: true })
    .click();
  const roles = page.getByRole("dialog", {
    name: "Organizer roles",
    exact: true,
  });
  await expect(
    roles.getByText(/Only approved Going participants/),
  ).toBeVisible();
  await roles.getByRole("button", { name: /^Make Jordan.* admin$/ }).click();
  await expect(
    roles.getByRole("button", { name: /^Remove Jordan.* organizer role$/ }),
  ).toBeVisible();
  await page.screenshot({ path: ".expo/creation-polish/organizer-roles.png" });
  await roles
    .getByRole("button", { name: /^Remove Jordan.* organizer role$/ })
    .click();
  await expect(
    roles.getByRole("button", { name: /^Make Jordan.* admin$/ }),
  ).toBeVisible();
});
