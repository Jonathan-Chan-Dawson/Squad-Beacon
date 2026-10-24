import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }),
  ).toBeVisible();
}
async function returnToHub(page: Page) {
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const create = page.getByRole("button", { name: "Create", exact: true });
  await expect(
    create.or(
      page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }),
    ),
  ).toBeVisible();
  if (await create.isVisible()) await create.click();
  await expect(
    page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }),
  ).toBeVisible();
}
async function blank(page: Page) {
  await demo(page);
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
  await expect(
    page.getByLabel("Activity title", { exact: true }),
  ).toBeVisible();
}
for (const width of [320, 375, 430])
  for (const appearance of ["light", "dark"]) {
    test(`compact creator ${width}px ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        appearance,
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await demo(page);
      await expect(
        page.getByTestId("creation-starters").getByRole("button"),
      ).toHaveCount(6);
      await page.screenshot({
        path: `.expo/creation-polish/hub-${width}-${appearance}.png`,
      });
      await page
        .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
        .click();
      const people = page.getByRole("button", { name: /^People & Access,/ });
      await expect(people).toBeInViewport();
      const peopleBox = (await people.boundingBox())!;
      expect(peopleBox.y + peopleBox.height).toBeLessThan(650);
      const advanced = page.getByRole("button", { name: /^Advanced Options,/ });
      await expect(advanced).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "Create Beacon", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: `.expo/creation-polish/editor-${width}-${appearance}.png`,
      });
      await page
        .getByLabel("Activity title", { exact: true })
        .fill("A longer basketball activity title with friends");
      await page.getByLabel("Activity title", { exact: true }).press("Tab");
      await people.click();
      const sheet = page.getByRole("dialog", {
        name: "People & Access",
        exact: true,
      });
      await expect(
        sheet.getByText("Who can see this Beacon?", { exact: true }),
      ).toBeVisible();
      await sheet
        .getByLabel("Maximum spots (optional)", { exact: true })
        .fill("6");
      await sheet
        .getByRole("switch", { name: "Enforce maximum", exact: true })
        .check();
      await page.screenshot({
        path: `.expo/creation-polish/people-${width}-${appearance}.png`,
      });
      await sheet.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: /^Modules,/ }).click();
      await expect(
        page.getByRole("dialog", { name: "Modules", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog", { name: "Modules", exact: true })
        .getByRole("button", { name: "Done", exact: true })
        .click();
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      const review = page.getByRole("dialog", {
        name: "Review your Beacon",
        exact: true,
      });
      await expect(
        review.getByText("Who can see it", { exact: true }),
      ).toBeVisible();
      await expect(
        review.getByText("Invitations & notifications", { exact: true }),
      ).toBeVisible();
      await expect(review.getByText(/Maximum enforced/)).toBeVisible();
      await page.screenshot({
        path: `.expo/creation-polish/review-${width}-${appearance}.png`,
      });
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    });
  }
test("draft saves across reload and restores title, modules, audience, and capacity", async ({
  page,
}) => {
  await blank(page);
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Restart-safe draft");
  await page.getByRole("button", { name: /^Modules,/ }).click();
  await page.getByRole("switch", { name: /Checklist$/ }).check();
  await page
    .getByRole("dialog", { name: "Modules", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.getByRole("button", { name: /^People & Access,/ }).click();
  await page
    .getByRole("button", { name: "Choose audience", exact: true })
    .click();
  await page.getByRole("button", { name: "Only me", exact: true }).click();
  await page.getByLabel("Maximum spots (optional)", { exact: true }).fill("7");
  await page
    .getByRole("dialog", { name: "People & Access", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  const enterDemo = page.getByRole("button", { name: /Explore the demo/ });
  await enterDemo.click();
  await returnToHub(page);
  await page
    .getByRole("button", { name: "Continue Draft", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Restart-safe draft",
  );
  await expect(
    page.getByRole("button", { name: /^Modules,.*Checklist/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^People & Access, Private/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^People & Access,/ }).click();
  await expect(
    page.getByLabel("Maximum spots (optional)", { exact: true }),
  ).toHaveValue("7");
});
test("required location, templates, real reuse, and independent blank drafts", async ({
  page,
}) => {
  await blank(page);
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Original Beacon for reuse");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(
    page
      .getByText("Choose a place or a point on the Map.", { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meeting");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/activity-created|beacon=|activity\//);
  await returnToHub(page);
  await page
    .getByRole("button", { name: "Original Beacon for reuse", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Original Beacon for reuse",
  );
  await page.getByRole("button", { name: /^People & Access,/ }).click();
  await expect(
    page.getByRole("button", { name: "+ Add People", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "People & Access", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await returnToHub(page);
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "",
  );
});
