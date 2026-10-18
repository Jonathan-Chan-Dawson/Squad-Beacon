import { expect, test, type Page } from "@playwright/test";
async function home(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByTestId("friends-right-now")).toBeAttached();
}
for (const width of [320, 375, 430, 1024]) {
  test(`polished cards, saved collections and contextual menu at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await home(page);
    const saved = page.getByRole("button", {
      name: "Saved & Tools",
      exact: true,
    });
    await saved.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.expo/final-polish/after-${width}.png` });
    const card = page
      .getByTestId("home-explore-beacons")
      .getByTestId(/^beacon-feed-card-/)
      .first();
    const title = await card.getByRole("heading").textContent();
    if (await card.getByTestId("discovery-secondary-metadata").count())
      await expect(
        card.getByTestId("discovery-secondary-metadata"),
      ).not.toHaveText(title!);
    const primary = card.getByRole("button", { name: "Join", exact: true });
    await expect(primary).toHaveText("Join");
    const bounds = await primary.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeLessThanOrEqual(
      (await card.boundingBox())!.width,
    );
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    const more = card.getByRole("button", {
      name: "More Beacon actions",
      exact: true,
    });
    await more.scrollIntoViewIfNeeded();
    await expect(more).toBeInViewport();
    await more.click();
    await page
      .getByRole("dialog", { name: title!, exact: true })
      .getByRole("button", { name: "Save Beacon", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: title!, exact: true }),
    ).toHaveCount(0);
    await expect(page).not.toHaveURL(/activity\//);
    await more.click();
    const menu = page.getByRole("dialog", { name: title!, exact: true });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Unsave Beacon", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Join", exact: true }),
    ).toHaveCount(0);
    await expect(
      menu.getByRole("button", { name: "Share Beacon", exact: true }),
    ).toBeVisible();
    if (width >= 768)
      expect(
        (await page.getByTestId("anchored-context-menu").boundingBox())!.width,
      ).toBeLessThanOrEqual(340);
    await page.screenshot({ path: `.expo/final-polish/menu-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(more).toBeFocused();
    await saved.click();
    const tools = page.getByRole("dialog", {
      name: "Saved & Tools",
      exact: true,
    });
    await expect(
      tools.getByRole("button", { name: "Saved Beacons", exact: true }),
    ).toBeVisible();
    await expect(
      tools.getByRole("button", { name: "Favorite friends", exact: true }),
    ).toBeVisible();
    await expect(
      tools.getByRole("button", { name: "Favorite Squads", exact: true }),
    ).toBeVisible();
    await expect(
      tools.getByRole("button", { name: /Responses|Invitations/ }),
    ).toHaveCount(0);
    await page.screenshot({ path: `.expo/final-polish/tools-${width}.png` });
    await tools
      .getByRole("button", { name: "Saved Beacons", exact: true })
      .click();
    const collection = page.getByRole("dialog", {
      name: "Saved Beacons",
      exact: true,
    });
    await expect(
      collection.getByRole("button", { name: title!, exact: true }),
    ).toBeVisible();
    await collection
      .getByRole("button", { name: `Unsave ${title}`, exact: true })
      .click();
    await expect(
      collection.getByRole("button", { name: title!, exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Explore all →", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Saved Beacons", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Saved Beacons", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Save a Beacon from its bookmark to find it here.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("quick current availability and clearing preserve the existing future schedule", async ({
  page,
}) => {
  await home(page);
  const status = page.getByTestId("compact-own-status");
  await expect(status).toContainText("Scheduled");
  const scheduled = await status.textContent();
  await page
    .getByRole("button", { name: "Availability choices", exact: true })
    .click();
  await expect(page.getByTestId("anchored-context-menu")).toBeVisible();
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Share your availability", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Schedule availability", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Share availability", exact: true })
    .click();
  await expect(status).toContainText("Available");
  await page
    .getByRole("button", { name: "Availability choices", exact: true })
    .click();
  await page.getByRole("button", { name: "Not sharing", exact: true }).click();
  await expect(status).toHaveText(scheduled!);
});
test("reporting opens only after the action menu dismisses and cancellation sends nothing", async ({
  page,
}) => {
  await home(page);
  const card = page
    .getByTestId("home-explore-beacons")
    .getByTestId(/^beacon-feed-card-/)
    .first();
  await card
    .getByRole("button", { name: "More Beacon actions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Report Beacon", exact: true })
    .click();
  const report = page.getByRole("dialog", {
    name: "Report Beacon",
    exact: true,
  });
  await expect(report).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    report.getByRole("button", { name: "Submit report", exact: true }),
  ).toBeDisabled();
  await report.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(report).toHaveCount(0);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page
    .getByRole("button", { name: "Responses & Invitations", exact: true })
    .click();
  await expect(page).toHaveURL(/responses/);
});

test("card reaction toggles in place and Comments opens the existing authorized composer", async ({
  page,
}) => {
  await home(page);
  const card = page
    .getByTestId("home-explore-beacons")
    .getByTestId(/^beacon-feed-card-/)
    .filter({ has: page.getByRole("button", { name: /^React to / }) })
    .first();
  const react = card.getByRole("button", { name: /^React to / });
  await expect(react).toBeAttached();
  await react.click();
  const choice = page.getByRole("button", { name: /^React with / }).first();
  const choiceName = await choice.getAttribute("aria-label");
  await choice.click();
  const emoji = choiceName!.replace("React with ", "");
  await expect(react).toContainText(emoji);
  await expect(react).toHaveAccessibleName(
    new RegExp(`your reaction ${emoji}`),
  );
  await expect(page).not.toHaveURL(/activity\//);
  await react.click();
  await page.getByRole("button", { name: choiceName!, exact: true }).click();
  await expect(react).not.toContainText(emoji);
  const comments = card.getByRole("button", { name: /^Comments on / });
  await comments.click();
  await expect(page).toHaveURL(/activity\/.*tab=comments/);
  await expect(page.getByTestId("beacon-comments-section")).toBeInViewport();
  const input = page.getByLabel("Add a comment", { exact: true });
  await expect(input).toBeVisible();
});
