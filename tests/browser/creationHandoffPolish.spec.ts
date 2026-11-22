import { expect, test } from "@playwright/test";
import { startDemoFromEntry } from "./demoEntry";

test("returning from Find a Time preserves the Beacon timing choices", async ({ page }) => {
  await page.goto("/create?editor=yes&timezone=America%2FChicago");
  await startDemoFromEntry(page);
  const title = page.getByLabel("Activity title", { exact: true });
  await title.fill("After-work hangout");
  const timing = page.getByTestId("inline-beacon-timing");
  const preset = timing.getByRole("button", { name: "Start time: In 30 min", exact: true });
  const duration = timing.getByRole("radio", { name: "2 hours", exact: true });
  await preset.click();
  await duration.click();

  await page.getByRole("button", { name: "Let friends choose a time", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find a Time", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await expect(title).toHaveValue("After-work hangout");
  await expect(preset).toHaveAttribute("aria-selected", "true");
  await expect(duration).toBeChecked();
});

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
  await startDemoFromEntry(page);
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Calendar and Map handoff");
  await expect(
    page.getByTestId("inline-beacon-timing").getByText(/Dec 25 · 3:00 PM/),
  ).toBeVisible();
  const selectedFriend = page.getByRole("button", {
    name: "Remove Jordan Ellis",
    exact: true,
  });
  await expect(selectedFriend).toBeVisible();
  await page.getByRole("button", { name: /^Beacon tools,/ }).click();
  await page.getByRole("switch", { name: "Checklist", exact: true }).check();
  await page.getByRole("dialog", { name: "Configure Beacon tools" }).getByRole("button", { name: "Done" }).click();
  await page
    .getByRole("button", { name: "Adjust on Map", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel location placement", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Calendar and Map handoff",
  );
  await expect(page.getByRole("button", { name: /^Beacon tools,.*Checklist/ })).toBeVisible();
  await page.getByRole("button", { name: /^Beacon tools,/ }).click();
  await expect(
    page.getByRole("switch", { name: "Checklist", exact: true }),
  ).toBeChecked();
  await page.getByRole("dialog", { name: "Configure Beacon tools" }).getByRole("button", { name: "Done" }).click();

  await expect(
    page.getByText("Campus meeting point", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("inline-beacon-timing").getByText(/Dec 25 · 3:00 PM/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Change location", exact: true })
    .click();
  await page.getByLabel("Meeting place", { exact: true }).fill("Auburn");
  await page
    .getByRole("button", { name: "Choose Auburn", exact: true })
    .click();
  await expect(page.getByText("Auburn", { exact: true })).toBeVisible();
  await expect(selectedFriend).toBeVisible();
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
  await startDemoFromEntry(page);
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Storage failure check");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
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
  await startDemoFromEntry(page);
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
    .getByRole("button", { name: "Add a description", exact: true })
    .click();
  await page
    .getByLabel("Description & details", { exact: true })
    .fill("Extra instructions and things to bring.");

  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeInViewport();
});

test("organizer roles are granted and removed only through the post-publication People route", async ({
  page,
}) => {
  await page.goto("/activity/demo-you-showcase-live");
  await startDemoFromEntry(page);
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
