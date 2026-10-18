import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
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

const phones = [
  { name: "390px phone", width: 390, height: 844 },
  { name: "320px phone", width: 320, height: 844 },
];

for (const phone of phones) {
  test(`mobile redesign remains usable at ${phone.name} dimensions`, async ({
    page,
  }) => {
    await page.setViewportSize(phone);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Your Activity", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tablist", { name: "Beacon time period" }),
    ).toHaveCount(0);
    const titleTarget = page.getByTestId("personal-activity-preview").first();
    await expect(titleTarget).toBeVisible();
    expect((await titleTarget.boundingBox())?.height).toBeGreaterThanOrEqual(
      44,
    );
    await expect(
      page
        .getByTestId("home-personal-timeline")
        .getByRole("button", { name: /^(Open Beacon|Return to Beacon)$/ }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    if (phone.width === 320 || phone.width === 390)
      await page.screenshot({
        path: `test-results/ui-redesign-home-${phone.width}x${phone.height}.png`,
      });

    await page
      .getByRole("button", { name: "Explore all →", exact: true })
      .click();
    await expect(page.getByTestId("browse-beacons-screen")).toBeVisible();
    await expect(page.getByTestId("browse-beacons-now")).toBeVisible();
    await page.getByTestId("browse-beacons-scroll").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByTestId("browse-beacons-upcoming")).toBeAttached();
    await expectNoHorizontalOverflow(page);
    if (phone.width === 320 || phone.width === 390)
      await page.screenshot({
        path: `test-results/ui-redesign-browse-${phone.width}x${phone.height}.png`,
      });
    await page
      .getByRole("button", { name: "Back to Beacons", exact: true })
      .click();

    await page.goto("/browse-beacons?section=upcoming");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await expect(page).toHaveURL(/\/browse-beacons(?:\?.*section=upcoming)?/);
    await expect(page.getByTestId("browse-beacons-upcoming")).toBeVisible();
    await page
      .getByRole("button", { name: "Back to Beacons", exact: true })
      .click();

    await page
      .getByText("Your Activity", { exact: true })
      .filter({ visible: true })
      .locator("..")
      .getByRole("button", { name: "My Activity →", exact: true })
      .click();
    await expect(page.getByTestId("your-activity-screen")).toBeVisible();
    await expect(page.getByTestId("your-activity-header")).toHaveText(
      "Your Activity",
    );
    await expectNoHorizontalOverflow(page);
    if (phone.width === 320 || phone.width === 390)
      await page.screenshot({
        path: `test-results/ui-redesign-personal-${phone.width}x${phone.height}.png`,
      });
    await page
      .getByRole("button", { name: "Back to Beacons", exact: true })
      .click();

    const create = page.getByRole("button", { name: "Create", exact: true });
    const createBounds = await create.boundingBox();
    expect(createBounds?.width).toBeGreaterThanOrEqual(44);
    expect(createBounds?.height).toBeGreaterThanOrEqual(44);
    await create.click();
    await expect(page).toHaveURL(/\/create/);
    await page.goBack();
    await expect(create).toBeVisible();

    expect(
      await page.evaluate(
        () =>
          Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          ) <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("a sheet queues Escape during opening and can be reopened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();

  const create = page.getByRole("button", {
    name: /Add a status note|Edit your status note/,
    exact: true,
  });
  const dialog = page.getByRole("dialog");
  await create.click();
  await expect(dialog).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await create.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

for (const filter of ["Past", "Now", "Upcoming"]) {
  test(`legacy ${filter} links open the modern destination`, async ({
    page,
  }) => {
    await page.goto(`/activities?filter=${filter}`);
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    if (filter === "Past") {
      await expect(page).toHaveURL(/\/your-activity\?historyExpanded=yes/);
      await expect(
        page.getByTestId("your-activity-history-disclosure"),
      ).toHaveAttribute("aria-label", "Collapse past experiences");
    } else {
      await expect(page).toHaveURL(
        new RegExp(
          `/browse-beacons\\?section=${filter === "Now" ? "now" : "upcoming"}`,
        ),
      );
    }
    await expect(
      page.getByRole("tablist", { name: "Beacon time period" }),
    ).toHaveCount(0);
  });
}
