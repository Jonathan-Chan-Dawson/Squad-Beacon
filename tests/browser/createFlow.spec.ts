import { expect, test } from "@playwright/test";

async function createHome(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }),
  ).toBeVisible();
}

async function returnToHub(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /^(Back|Back to Beacons)$/ }).click();
  const create = page.getByRole("button", { name: "Create", exact: true }),
    blank = page.getByRole("button", {
      name: "+ Create Blank Beacon",
      exact: true,
    });
  await expect(create.or(blank)).toBeVisible();
  if (await create.isVisible()) await create.click();
  await expect(blank).toBeVisible();
}
test("Create stays compact and app templates prefill the Beacon Quick Editor", async ({
  page,
}) => {
  await createHome(page);
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Browse All", exact: true }).click();
  await page.getByLabel("Search", { exact: true }).fill("Basketball");
  await page.getByRole("button", { name: "Basketball", exact: true }).click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Basketball",
  );
  await expect(
    page.getByRole("button", { name: "Create Beacon", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Search aspirations", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Advanced Options", exact: true })
    .click();
  await expect(
    page.getByLabel("Search aspirations", { exact: true }),
  ).toBeVisible();
});

test("Plan timeline can create a reusable manual Routine", async ({ page }) => {
  await createHome(page);
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Friday test itinerary");
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await page.getByRole("button", { name: "+ Add Stop", exact: true }).click();
  await page.getByRole("button", { name: "Add Activity", exact: true }).click();
  await page
    .getByRole("button", { name: "Dinner together", exact: true })
    .click();
  await page.getByRole("button", { name: "Repeat", exact: true }).click();
  await page
    .getByRole("button", { name: "Whenever I choose", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create Routine", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Routine tools", exact: true })
    .click();
  await page.getByRole("button", { name: "Run Now", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(
    page.getByText("This occurrence · Edit its Beacons individually", {
      exact: true,
    }),
  ).toBeVisible();
});

test("Routine quick start offers source Plans and the shared Plan builder", async ({
  page,
}) => {
  await createHome(page);

  await page
    .getByRole("button", { name: "Create Routine", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build a Plan from scratch", exact: true })
    .click();
  await expect(page.getByLabel("Plan name", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Plan", exact: true }),
  ).toBeVisible();
});

test("a Suggested Beacon creates a Vote and can add another suggestion with the Quick Editor", async ({
  page,
}) => {
  await createHome(page);
  await page
    .getByLabel("Search activities or templates", { exact: true })
    .fill("Coffee together");
  await page
    .getByRole("button", { name: "Coffee together", exact: true })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Coffee suggestion test");
  await page.getByRole("button", { name: /^Starts,/ }).click();
  await page.getByRole("button", { name: "In 30 min", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to Plan or Council", exact: true })
    .click();
  await page.getByRole("button", { name: "Vote / Draw", exact: true }).click();
  await page
    .getByLabel("Decision name (optional)", { exact: true })
    .fill("Friday choices test");
  await page
    .getByRole("dialog", { name: "Add to Plan or Council", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit Council Option", exact: true })
    .click();
  await expect(page).toHaveURL(/\/council\//);
  await expect(
    page.getByText("Coffee suggestion test", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add option", exact: true }).click();
  await page
    .getByRole("button", { name: "Use Beacon editor", exact: true })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Bowling suggestion test");
  await page
    .getByRole("button", { name: "Submit Council Option", exact: true })
    .click();
  await expect(page).toHaveURL(/\/council\//);
  await expect(
    page
      .getByText("Bowling suggestion test", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
});

test("launcher preserves blank first, recommendations, search, and compact family navigation", async ({
  page,
}) => {
  await createHome(page);
  const blank = page.getByRole("button", {
    name: "+ Create Blank Beacon",
    exact: true,
  });
  const forYou = page.getByText("RECOMMENDED STARTERS", { exact: true });
  expect((await blank.boundingBox())!.y).toBeLessThan(
    (await forYou.boundingBox())!.y,
  );
  await page
    .getByLabel("Search activities or templates", { exact: true })
    .fill("groceries");
  await expect(
    page.getByRole("button", { name: "Grocery Run", exact: true }),
  ).toBeVisible();
  await expect(forYou).toHaveCount(0);
  await page
    .getByLabel("Search activities or templates", { exact: true })
    .fill("");
  await page.screenshot({ path: "test-results/create-launcher-390.png" });
  await page.getByRole("button", { name: "Browse All", exact: true }).click();
  const browser = page.getByRole("dialog");
  await expect(
    browser.getByRole("button", { name: "Hangout", exact: true }),
  ).toBeVisible();
  await expect(
    browser.getByRole("button", { name: "Photography & Content", exact: true }),
  ).toHaveCount(1);
  await browser
    .getByRole("button", { name: "Errands & Shopping", exact: true })
    .click();
  await expect(
    browser.getByRole("button", { name: "Grocery Run", exact: true }),
  ).toBeVisible();
  await browser
    .getByRole("button", { name: "Back to categories", exact: true })
    .click();
  await browser
    .getByRole("button", { name: "Photography & Content", exact: true })
    .click();
  await expect(
    browser.getByRole("button", { name: "Outdoor Photography", exact: true }),
  ).toBeVisible();
  await browser
    .getByRole("button", { name: "Back to categories", exact: true })
    .click();
  await browser.getByLabel("Search", { exact: true }).fill("movie night");
  await browser.getByRole("button", { name: "Movie", exact: true }).click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Movie",
  );
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Movie at mine");
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Movie at mine",
  );
});

for (const preset of ["Grocery Run", "General Hangout"]) {
  test(`${preset} creates a Beacon with appropriate sheet tools`, async ({
    page,
  }) => {
    await createHome(page);
    await page
      .getByLabel("Search activities or templates", { exact: true })
      .fill(preset);
    await page.getByRole("button", { name: preset, exact: true }).click();
    await page.getByRole("radio", { name: "Online", exact: true }).click();
    await page
      .getByLabel("HTTPS meeting link", { exact: true })
      .fill("https://example.com/meeting");
    await page
      .getByRole("button", { name: "Create Beacon", exact: true })
      .click();
    await expect(page).toHaveURL(/activity-created/);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByTestId("activity-detail-hero")).toBeVisible();
    const panel = page;
    await panel.getByRole("tab", { name: "Activity", exact: true }).click();
    if (preset === "Grocery Run") {
      await panel.getByRole("tab", { name: "Checklist", exact: true }).click();
      await expect(
        panel.getByLabel("Add a checklist item", { exact: true }),
      ).toBeVisible();
    } else
      await expect(
        panel.getByRole("tab", { name: "Checklist", exact: true }),
      ).toHaveCount(0);
    await returnToHub(page);
    await expect(
      page.getByText("RECENT BEACONS", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: preset, exact: true }).first(),
    ).toBeVisible();
  });
}

test("My Templates saves, reuses, and edits the existing configuration", async ({
  page,
}) => {
  await createHome(page);
  await page
    .getByLabel("Search activities or templates", { exact: true })
    .fill("Grocery Run");
  await page.getByRole("button", { name: "Grocery Run", exact: true }).click();
  await page
    .getByRole("button", { name: "Advanced Options", exact: true })
    .click();
  await page
    .getByLabel("Template name", { exact: true })
    .fill("Weekly groceries");
  await page
    .getByRole("button", { name: "Save as template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Advanced Options", exact: true })
    .click();
  await returnToHub(page);
  await page.getByRole("button", { name: "My Templates", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Weekly groceries", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Grocery Run",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await returnToHub(page);
  await page.getByRole("button", { name: "My Templates", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Edit template Weekly groceries",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Groceries and supplies");
  await page
    .getByRole("button", { name: "Save Template", exact: true })
    .click();
  await returnToHub(page);
  await page.getByRole("button", { name: "My Templates", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Weekly groceries", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Groceries and supplies",
  );
});

test("a preset Beacon can join an existing Plan through the same editor", async ({
  page,
}) => {
  await createHome(page);
  await page
    .getByLabel("Search activities or templates", { exact: true })
    .fill("Grocery Run");
  await page.getByRole("button", { name: "Grocery Run", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to Plan or Council", exact: true })
    .click();
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await page
    .getByRole("button", { name: /^Friday Night Routine.*First plan$/ })
    .click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add to Plan or Council", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meeting");
  await page
    .getByRole("button", { name: "Add Beacon Step", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(
    page.getByText("Grocery Run", { exact: true }).first(),
  ).toBeVisible();
});
