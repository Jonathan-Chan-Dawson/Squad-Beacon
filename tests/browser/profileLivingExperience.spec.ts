import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-identity")).toBeVisible();
}
async function openFriend(page: Page) {
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search conversations", exact: true })
    .fill("Jordan");
  await page
    .getByRole("button", { name: "Message Jordan Ellis", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View Jordan Ellis's profile", exact: true })
    .click();
  await expect(page.getByTestId("person-profile-identity")).toBeVisible();
}
for (const width of [360, 390, 430]) {
  for (const appearance of ["dark", "light"]) {
    test(`profiles retain hierarchy and navigation at ${width}px in ${appearance}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openDemo(page);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("button", {
          name: appearance === "dark" ? "Dark" : "Light",
          exact: true,
        })
        .click();
      await page.goBack();
      await expect(page.getByTestId("profile-identity")).toBeVisible();
      const tabs = page.getByTestId("profile-tabs");
      await expect(
        page.getByRole("button", { name: "Edit profile", exact: true }),
      ).toBeInViewport();
      await expect(tabs).toBeInViewport();
      await expect(page.getByTestId("profile-memories")).toBeInViewport({
        ratio: 0.05,
      });
      await page.screenshot({
        path: `test-results/profile-own-${width}-${appearance}.png`,
      });
      await tabs.getByRole("tab", { name: "Beacons", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "Search past Beacons", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Search past Beacons", exact: true })
        .fill("no-matching-experience");
      await expect(
        page.getByText("No experiences match your search."),
      ).toBeVisible();
      await tabs.getByRole("tab", { name: "About", exact: true }).click();
      await expect(
        page.getByText("Making time for", { exact: true }),
      ).toBeVisible();
      await tabs.getByRole("tab", { name: "Beacons", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "Search past Beacons", exact: true }),
      ).toHaveValue("no-matching-experience");
      await openFriend(page);
      await expect(
        page.getByRole("button", { name: "Message", exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Open mutual friends", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/profile-friend-${width}-${appearance}.png`,
      });
      await page
        .getByRole("button", { name: "Safety & Privacy", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Block account", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Report account", exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test("long identity text remains usable and biography expands without losing editing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await openDemo(page);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const name =
    "Alexandria Morgan and a very long display name for a small phone";
  const bio =
    "Making time for friends, exploring new places, and collecting little experiences together. ".repeat(
      5,
    );
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Bio", exact: true }).fill(bio);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page
      .getByTestId("profile-identity")
      .getByRole("heading", { name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand bio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Collapse bio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Collapse bio", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit your status", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
