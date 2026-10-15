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
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) <= innerWidth,
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

test("Beacons home and dedicated activity screens, and Squads stay compact at 390px", async ({
  page,
}) => {
  page.setDefaultTimeout(8000);
  const issues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);

  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText("Friends Right Now", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Activity", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse", exact: true })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Beacon time period" })).toHaveCount(0);
  const titleTarget = page.getByRole("button", { name: /^View .* details$/ }).first();
  await expect(titleTarget).toBeVisible();
  expect((await titleTarget.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/ui-polish-beacons-home.png" });

  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.getByTestId("browse-beacons-screen")).toBeVisible();
  await expect(page.getByTestId("browse-beacons-now")).toBeVisible();
  await expect(page.getByTestId("browse-beacons-upcoming")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/ui-polish-browse-beacons.png" });
  await page.getByRole("button", { name: "Back to Beacons", exact: true }).click();

  await page.getByText("Coming Up", { exact: true }).filter({ visible: true }).locator("..").getByRole("button", { name: "See all", exact: true }).click();
  await expect(page).toHaveURL(/\/browse-beacons(?:\?.*section=upcoming)?/);
  await expect(page.getByTestId("browse-beacons-upcoming")).toBeVisible();
  await page.getByRole("button", { name: "Back to Beacons", exact: true }).click();
  await page.getByText("Your Activity", { exact: true }).filter({ visible: true }).locator("..").getByRole("button", { name: "See all", exact: true }).click();
  await expect(page.getByTestId("your-activity-screen")).toBeVisible();
  await expect(page.getByTestId("your-activity-header")).toHaveText("Your Activity");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/ui-polish-your-activity.png" });
  await page.getByRole("button", { name: "Back to Beacons", exact: true }).click();

  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Open Friends & Lists", exact: true }).click();
  const sectionControls = page.getByLabel("Directory sections");
  const allSections = sectionControls.getByRole("button", {
    name: "All",
    exact: true,
  });
  await expect(allSections).toBeVisible();
  await expect(allSections).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("\u2713 All", { exact: true })).toHaveCount(0);
  const sectionWidths = await Promise.all(
    ["All", "Squads", "Friends", "Private lists"].map(async (name) => {
      const box = await sectionControls
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error(`${name} section button has no bounds.`);
      return box.width;
    }),
  );
  expect(
    Math.max(...sectionWidths) - Math.min(...sectionWidths),
  ).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/ui-polish-squads.png" });
  const friendsSection = sectionControls.getByRole("button", {
    name: "Friends",
    exact: true,
  });
  await friendsSection.click();
  await expect(friendsSection).toHaveAttribute("aria-selected", "true");
  await expect(allSections).toHaveAttribute("aria-selected", "false");
  await expect(page.getByText("\u2713 Friends", { exact: true })).toHaveCount(
    0,
  );
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
      name: "Browse",
      exact: true,
    });
    await expect(findFriends).toBeVisible();
    await expectIdentityTransform(findFriends);

    await findFriends.hover();
    await expectIdentityTransform(findFriends);
    const bounds = await findFriends.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds)
      throw new Error("Find friends button has no clickable bounds.");
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await expectIdentityTransform(findFriends);
    await page.mouse.up();

    await expect(page).toHaveURL(/\/browse-beacons\/?$/);
    await page.getByRole("button", { name: "Back to Beacons", exact: true }).click();
    const returnedButton = page.getByRole("button", {
      name: "Browse",
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
    const control = page.getByRole("button", { name: "Browse", exact: true });
    await expect(control).toBeVisible();
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Create Beacon button has no clickable bounds.");
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await expect
      .poll(() => transformScale(control), { timeout: 2000 })
      .toBeLessThan(0.999);

    // Cancel the navigation press outside the target so the same shared
    // button remains mounted for the live preference change.
    await page.mouse.move(1, 1);
    await page.mouse.up();
    await expect(control).toBeVisible();
    await expectIdentityTransform(control);
    await expect(control).toBeEnabled();

    const nextBounds = await control.boundingBox();
    expect(nextBounds).not.toBeNull();
    if (!nextBounds)
      throw new Error("Create Beacon button has no clickable bounds.");
    await page.mouse.move(
      nextBounds.x + nextBounds.width / 2,
      nextBounds.y + nextBounds.height / 2,
    );
    await page.mouse.down();
    await expect
      .poll(() => transformScale(control), { timeout: 2000 })
      .toBeLessThan(0.999);

    // Changing the system preference while the pointer is down must cancel
    // the in-flight scale animation and return the same control to identity.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectIdentityTransform(control);
    await page.mouse.move(1, 1);
    await page.mouse.up();
    await expect(control).toBeVisible();
    await expectIdentityTransform(control);

    expect(issues.pageErrors).toEqual([]);
    expect(issues.textWarnings).toEqual([]);
  } finally {
    await context.close();
  }
});
