import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const output =
  process.env.PROFILE_SHOWCASE_DIR ?? "test-results/profile-showcase";
async function save(page: Page, name: string) {
  await page.screenshot({ path: path.join(output, name + ".png") });
}
async function sectionAtTop(page: Page, text: string) {
  const heading = page
    .getByText(text, { exact: true })
    .filter({ visible: true })
    .first();
  await heading.evaluate((node) => node.scrollIntoView({ block: "start" }));
  await page.mouse.move(195, 350);
  await page.mouse.wheel(0, -75);
  await expect(heading).toBeInViewport();
}
async function captureSections(page: Page, id: string) {
  await save(page, id + "-overview");
  await page.getByRole("button", { name: "Expand bio", exact: true }).click();
  await save(page, id + "-expanded-bio");
  await page.getByRole("button", { name: "Collapse bio", exact: true }).click();
  await sectionAtTop(page, "Beacon Memories");
  await save(page, id + "-memories");
  await page
    .getByTestId("profile-tabs")
    .getByRole("tab", { name: "About", exact: true })
    .click();
  await sectionAtTop(page, "Interests");
  await save(page, id + "-interests");
  await sectionAtTop(page, "Making time for");
  await save(page, id + "-aspirations");
  await page
    .getByTestId("profile-tabs")
    .getByRole("tab", { name: "Beacons", exact: true })
    .click();
  await sectionAtTop(page, "Current & Upcoming");
  await save(page, id + "-beacons");
  await sectionAtTop(page, "Past Beacons");
  await save(page, id + "-history");
}

test("dense own and friend profiles remain readable across real profile sections", async ({
  page,
}) => {
  test.setTimeout(120000);
  fs.mkdirSync(output, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-identity")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "See all memories", exact: true }),
  ).toBeVisible();
  await captureSections(page, "alex");
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  for (const [index, name] of [
    "Avery Bennett",
    "Noor Haddad",
    "Rafael Costa",
  ].entries()) {
    await page
      .getByRole("textbox", { name: "Search conversations", exact: true })
      .fill(name);
    await page
      .getByRole("button", { name: `Message ${name}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `View ${name}'s profile`, exact: true })
      .click();
    await expect(page.getByTestId("person-profile-identity")).toBeVisible();
    await captureSections(page, name.split(" ")[0].toLowerCase());
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (index < 2) {
      await page.goBack();
      await page.goBack();
    }
  }
  expect(errors).toEqual([]);
});
