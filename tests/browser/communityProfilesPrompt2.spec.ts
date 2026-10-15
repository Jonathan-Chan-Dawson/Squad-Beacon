import { expect, test, type Page } from "@playwright/test";
import { openConversation } from "./chatHelpers";

async function openDemo(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

for (const width of [320, 375, 430]) {
  test(`Squad profile stays compact and returns to the same chat at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 780 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openDemo(page);
    await page.getByRole("tab", { name: "Squads", exact: true }).click();
    const search = page.getByRole("textbox", {
      name: "Search conversations",
      exact: true,
    });
    await search.fill("training");
    await openConversation(page, "The training crew");
    await page
      .getByRole("button", {
        name: "Open Squad profile for The training crew",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/squad\/boxing/);
    for (const name of ["Chat", "Ping", "Beacon"]) {
      const action = page.getByRole("button", { name, exact: true });
      await expect(action).toBeInViewport();
      const bounds = await action.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(
      page.getByRole("tab", { name: "Overview", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.getByTestId("squad-activity-preview").count(),
    ).toBeLessThanOrEqual(3);
    await page.screenshot({ path: `test-results/prompt2-squad-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(page).toHaveURL(/\/squad-chat\/boxing/);
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("legacy Squad Members and Activity links remain focused destinations", async ({
  page,
}) => {
  await openDemo(page, "/squad/boxing?tab=Members");
  await expect(
    page.getByText("Jordan Ellis", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Chat", exact: true }),
  ).toHaveCount(0);
  await openDemo(page, "/squad/boxing?tab=Activity");
  await expect(
    page.getByRole("button", { name: /Plans/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveCount(0);
});

test("Organization and Network keep distinct focused directories", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openDemo(page, "/space/space-neighborhood-studio");
  await expect(
    page.getByText("Neighborhood Studio", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Organization settings|Settings)$/i }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /^(All Squads|Explore Squads|View All Squads)$/i,
    })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", { name: /Search (squads|Neighborhood Studio)/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^(Organization settings|Settings)$/i }),
  ).toBeVisible();
  await openDemo(page, "/organization/org-lakefront-collective");
  await expect(
    page.getByText("Lakefront Collective", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Network", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /^(Browse Organizations|View All Organizations)$/i,
    })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", {
      name: /Search (organizations|communities|Lakefront Collective)/i,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const community of [
  {
    path: "/space/space-neighborhood-studio",
    name: "Neighborhood Studio",
    settings: "Organization settings",
  },
]) {
  test(`${community.name} details use focused forms, preserve drafts, and save canonical changes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await openDemo(page, community.path);
    await page
      .getByRole("button", { name: /^(Organization settings|Settings)$/i })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const details = page.getByRole("button", {
      name: /^(Organization details|Network details|Details)$/i,
    });
    await details.click();
    const name = page.getByRole("textbox", {
      name: /^(Organization name|Name)$/i,
    });
    await expect(name).toHaveValue(community.name);
    await name.fill(`${community.name} draft`);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Keep editing", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(name).toHaveValue(`${community.name} draft`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const discard = page.getByRole("button", {
      name: "Discard changes",
      exact: true,
    });
    await expect(
      discard.or(details).filter({ visible: true }).first(),
    ).toBeVisible();
    if (await discard.isVisible()) await discard.click();
    await details.click();
    await expect(name).toHaveValue(community.name);
    await name.fill(`${community.name} updated`);
    await page
      .getByRole("button", {
        name: /^(Save Organization|Save details|Save changes)$/i,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toHaveCount(0);
    await details.click();
    await expect(name).toHaveValue(`${community.name} updated`);
    await page.screenshot({
      path: `test-results/prompt2-${community.settings.split(" ")[0].toLowerCase()}-details.png`,
    });
  });
}

test("Network elder keeps its actual connection permissions without owner settings", async ({
  page,
}) => {
  await openDemo(page, "/organization/org-lakefront-collective");
  await page
    .getByRole("button", {
      name: /^(Community settings|Network settings|Settings)$/i,
    })
    .click();
  await expect(
    page.getByRole("button", { name: /^(Network details|Details)$/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Privacy & access", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Link a Squad", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Link an Organization", exact: true }),
  ).toHaveCount(0);
});

test("Squad Organization and direct Network disclosures preserve their distinct destinations", async ({
  page,
}) => {
  await openDemo(page, "/squad/boxing");
  await page
    .getByRole("button", {
      name: "Show related communities in Neighborhood Studio",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "View Organization", exact: true })
    .click();
  await expect(page).toHaveURL(/\/space\/space-neighborhood-studio$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View Organization", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Show related communities in Lakefront Collective",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "View Network", exact: true }).click();
  await expect(page).toHaveURL(/\/organization\/org-lakefront-collective$/);
  await page
    .getByRole("button", {
      name: "Open profile Neighborhood Studio",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/space\/space-neighborhood-studio$/);
});
