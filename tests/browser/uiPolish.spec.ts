import { expect, test, type Page, type Locator } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

function collectRuntimeIssues(page: Page) {
  const pageErrors: string[] = [];
  const textWarnings: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (/Text strings must be rendered within a <Text>/i.test(message.text())) {
      textWarnings.push(message.text());
    }
  });
  return { pageErrors, textWarnings };
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth,
    ),
  ).toBe(true);
}

async function expectIdentityTransform(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate((element) => {
          const transform = getComputedStyle(element).transform;
          if (transform === "none") return true;
          const matrix = new DOMMatrixReadOnly(transform);
          return (
            Math.abs(matrix.a - 1) < 0.0001 &&
            Math.abs(matrix.b) < 0.0001 &&
            Math.abs(matrix.c) < 0.0001 &&
            Math.abs(matrix.d - 1) < 0.0001 &&
            Math.abs(matrix.e) < 0.0001 &&
            Math.abs(matrix.f) < 0.0001
          );
        }),
      { timeout: 2000 },
    )
    .toBe(true);
}

async function transformScale(locator: Locator) {
  return locator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    if (transform === "none") return 1;
    const matrix = new DOMMatrixReadOnly(transform);
    return Math.hypot(matrix.a, matrix.b);
  });
}

test("Current, Upcoming, Past utilities, and Squads stay compact at 390px", async ({
  page,
}) => {
  page.setDefaultTimeout(8000);
  const issues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);

  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText("Friends Now", { exact: true })).toBeVisible();
  const currentTab = page.getByRole("button", { name: "Current", exact: true });
  const upcomingTab = page.getByRole("button", { name: "Upcoming", exact: true });
  await expect(currentTab).toBeVisible();
  await expect(currentTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("\u2713 Current", { exact: true })).toHaveCount(0);
  const everyoneChip = page.getByRole("button", { name: "Everyone", exact: true });
  const freeToHangChip = page.getByRole("button", { name: "Free to hang", exact: true });
  await expect(everyoneChip).toBeVisible();
  await expect(everyoneChip).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("\u2713 Everyone", { exact: true })).toHaveCount(0);
  await expect(freeToHangChip).toHaveAttribute("aria-selected", "false");
  await freeToHangChip.click();
  await expect(freeToHangChip).toHaveAttribute("aria-selected", "true");
  await expect(everyoneChip).toHaveAttribute("aria-selected", "false");
  await expect(page.getByText("\u2713 Free to hang", { exact: true })).toHaveCount(0);
  await everyoneChip.click();
  await expect(everyoneChip).toHaveAttribute("aria-selected", "true");
  for (const utility of ["Beacon Plans", "Favorites", "My templates", "Library", "Pings & Decisions"]) {
    await expect(page.getByRole("button", { name: utility, exact: true })).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/ui-polish-activities.png" });

  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("button", { name: "Fitness", exact: true }).click();
  await expect(page.getByText("\u2713 Fitness", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("activity-filter-count")).toHaveText("1");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fitness", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("activity-filter-count")).toHaveCount(0);

  await upcomingTab.click();
  await expect(page.getByText("Coming up", { exact: true })).toBeVisible();
  await expect(upcomingTab).toHaveAttribute("aria-selected", "true");
  await expect(currentTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByText("\u2713 Upcoming", { exact: true })).toHaveCount(0);
  for (const utility of ["Beacon Plans", "Favorites", "My templates", "Library", "Pings & Decisions"]) {
    await expect(page.getByRole("button", { name: utility, exact: true })).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Past", exact: true }).click();
  await expect(page.getByText("Beacon history", { exact: true })).toBeVisible();
  await expect(page.getByText("\u2713 Past", { exact: true })).toHaveCount(0);
  for (const utility of ["Beacon Plans", "Favorites", "My templates", "Library", "Pings & Decisions"]) {
    await expect(page.getByRole("button", { name: utility, exact: true })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Current", exact: true }).click();
  const viewBeacon = page.getByRole("button", {
    name: "View A few rounds. Good company. details",
    exact: true,
  });
  await expect(viewBeacon).toBeVisible();
  await viewBeacon.click();
  await expect(page.getByTestId("map-tooltip")).toBeVisible();

  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  const allSections = page.getByRole("button", { name: "All", exact: true });
  await expect(allSections).toBeVisible();
  await expect(allSections).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("\u2713 All", { exact: true })).toHaveCount(0);
  const sectionWidths = await Promise.all(
    ["All", "Squads", "Friends", "Private lists"].map(async (name) => {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error(`${name} section button has no bounds.`);
      return box.width;
    }),
  );
  expect(Math.max(...sectionWidths) - Math.min(...sectionWidths)).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/ui-polish-squads.png" });
  const friendsSection = page.getByRole("button", { name: "Friends", exact: true });
  await friendsSection.click();
  await expect(friendsSection).toHaveAttribute("aria-selected", "true");
  await expect(allSections).toHaveAttribute("aria-selected", "false");
  await expect(page.getByText("\u2713 Friends", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await allSections.click();
  await expect(allSections).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("\u2713 All", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  expect(issues.pageErrors).toEqual([]);
  expect(issues.textWarnings).toEqual([]);
});

test("reduced motion keeps a shared Button at identity while hovering, pressing, and after click", async ({
  browser,
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const issues = collectRuntimeIssues(page);

  try {
    await enterDemo(page);
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    const findFriends = page.getByRole("button", {
      name: "Find friends",
      exact: true,
    });
    await expect(findFriends).toBeVisible();
    await expectIdentityTransform(findFriends);

    await findFriends.hover();
    await expectIdentityTransform(findFriends);
    const bounds = await findFriends.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Find friends button has no clickable bounds.");
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await expectIdentityTransform(findFriends);
    await page.mouse.up();

    await expect(page).toHaveURL(/\/find-friends\/?$/);
    await page.goBack();
    const returnedButton = page.getByRole("button", {
      name: "Find friends",
      exact: true,
    });
    await expect(returnedButton).toBeVisible();
    await expectIdentityTransform(returnedButton);
    expect(issues.pageErrors).toEqual([]);
    expect(issues.textWarnings).toEqual([]);
  } finally {
    await context.close();
  }
});

test("normal press animates, then a live reduced-motion change resets scale", async ({
  browser,
}) => {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const issues = collectRuntimeIssues(page);

  try {
    await enterDemo(page);
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    const maybe = page.getByRole("button", { name: "Maybe", exact: true }).first();
    await expect(maybe).toBeVisible();
    await maybe.scrollIntoViewIfNeeded();
    const bounds = await maybe.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Maybe button has no clickable bounds.");
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await expect
      .poll(() => transformScale(maybe), { timeout: 2000 })
      .toBeLessThan(0.999);

    // A normal release returns the control to identity before checking a live
    // preference change. The Maybe action keeps the same control mounted.
    await page.mouse.up();
    await expect(maybe).toBeVisible();
    await expectIdentityTransform(maybe);
    await expect(maybe).toBeEnabled();

    const nextBounds = await maybe.boundingBox();
    expect(nextBounds).not.toBeNull();
    if (!nextBounds) throw new Error("Maybe button has no clickable bounds.");
    await page.mouse.move(
      nextBounds.x + nextBounds.width / 2,
      nextBounds.y + nextBounds.height / 2,
    );
    await page.mouse.down();
    await expect
      .poll(() => transformScale(maybe), { timeout: 2000 })
      .toBeLessThan(0.999);

    // Changing the system preference while the pointer is down must cancel
    // the in-flight scale animation and return the same control to identity.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectIdentityTransform(maybe);
    await page.mouse.move(1, 1);
    await page.mouse.up();
    await expect(maybe).toBeVisible();
    await expectIdentityTransform(maybe);

    expect(issues.pageErrors).toEqual([]);
    expect(issues.textWarnings).toEqual([]);
  } finally {
    await context.close();
  }
});
