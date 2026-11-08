import { expect, test } from "@playwright/test";

test("defined decision rows link existing choices and reorder together with ideas in a centered dialog", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await page.getByLabel("Plan title", { exact: true }).fill("Link and arrange");
  await page.getByRole("button", { name: "Add Idea", exact: true }).click();
  await page
    .getByLabel("Activity idea", { exact: true })
    .fill("Meet at a cafe");
  await page.getByRole("button", { name: "Add Decision", exact: true }).click();
  await page
    .getByRole("button", { name: "Link existing", exact: true })
    .click();
  const selection = page.getByTestId("plan-existing-selection");
  await expect(
    selection.getByLabel("Search eligible decisions", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".expo/plan-existing-decisions.png",
    fullPage: true,
  });
  const choice = selection
    .getByRole("button")
    .filter({
      has: page.getByText(/(?:Ping|Vote|Draw|Find a Time) · (?:Open|Resolved)/),
    })
    .first();
  const title = await choice.getAttribute("aria-label");
  await choice.click();
  await expect(
    page.getByRole("button", { name: `2. ${title}`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reorder", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Reorder Plan",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: ".expo/plan-centered-reorder.png",
    fullPage: true,
  });
  const box = await dialog.boundingBox();
  expect(Math.abs(box!.y + box!.height / 2 - 844 / 2)).toBeLessThan(30);
  await dialog
    .getByRole("button", { name: `Reorder item 2. ${title}`, exact: true })
    .click();
  await dialog
    .getByRole("button", { name: `Move ${title} up`, exact: true })
    .click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `1. ${title}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "2. Meet at a cafe", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `1. ${title}`, exact: true }),
  ).toBeVisible();
});

async function start(page: import("@playwright/test").Page) {
  await page.goto("/create");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await expect(page).toHaveURL(/plan-editor/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
for (const appearance of ["light", "dark"]) {
  test(`one Plan editor saves inline ideas with no setup dialog · ${appearance}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      appearance,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    await page
      .getByLabel("Plan title", { exact: true })
      .fill("A tiny adventure");
    await page.getByRole("button", { name: "Add Idea", exact: true }).click();
    await page.getByLabel("Activity idea", { exact: true }).fill("Try a cafe");
    await page
      .getByLabel("Idea details", { exact: true })
      .fill("Somewhere quiet");
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(page).toHaveURL(/\/plan\//);
    await expect(page.getByLabel("Plan title", { exact: true })).toHaveValue(
      "A tiny adventure",
    );
    await expect(
      page.getByRole("button", { name: "1. Try a cafe", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "1. Try a cafe", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Activity options", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Duplicate as draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "2. Try a cafe", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: `.expo/plan-editor-${appearance}.png`,
      fullPage: true,
    });
  });
}
test("New Beacon returns unpublished; Schedule Plan publishes explicitly and repeat settings stay inline", async ({
  page,
}) => {
  await start(page);
  await page
    .getByLabel("Plan title", { exact: true })
    .fill("Draft before publishing");
  await page.getByRole("button", { name: "Add Beacon", exact: true }).click();
  await page.getByRole("button", { name: "New Beacon", exact: true }).click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("A staged coffee");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/coffee");
  await page.getByRole("button", { name: "Add to Plan", exact: true }).click();
  await expect(page.getByLabel("Plan title", { exact: true })).toHaveValue(
    "Draft before publishing",
  );
  await expect(
    page.getByText("Beacon draft · unpublished", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByText("Beacon draft · unpublished", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Schedule activities", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schedule Plan", exact: true })
    .click();
  await expect(page.getByText(/Linked Beacon/)).toBeVisible();
  await page.getByRole("button", { name: "Repeat Plan", exact: true }).click();
  await expect(page.getByTestId("inline-routine-editor")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(
    page.getByText("Upcoming Repeats", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Repeat", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(page.getByText(/Active · Next/)).toBeVisible();
});
