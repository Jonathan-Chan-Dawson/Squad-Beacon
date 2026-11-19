import { expect, test } from "@playwright/test";
import { startDemoFromEntry } from "./demoEntry";

for (const [width, mode] of [
  [320, "dark"],
  [390, "light"],
] as const) {
  for (const community of [
    {
      name: "squad",
      base: "/squad/boxing",
      tabs: ["Members", "Activity", "Invite", "Settings"],
      memberSearch: "Search Squad members",
    },
    {
      name: "organization",
      base: "/space/space-neighborhood-studio",
      tabs: ["squads", "members", "activity", "settings"],
      memberSearch: "Search Organization members",
    },
    {
      name: "network",
      base: "/organization/org-lakefront-collective",
      tabs: ["squads", "directSquads", "members", "activity", "manage"],
      memberSearch: "Search Network members",
    },
  ]) {
    test(`${community.name} focused directories and management ${width}px ${mode}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        mode,
      );
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const tab of community.tabs) {
        await page.goto(`${community.base}?tab=${tab}`);
        await startDemoFromEntry(page);
        if (tab.toLowerCase() === "members") {
          const search = page.getByRole("textbox", {
            name: community.memberSearch,
            exact: true,
          });
          await expect(search).toBeVisible();
          await search.fill("Jordan");
          await expect(
            page.getByText("Jordan Ellis", { exact: true }).first(),
          ).toBeVisible();
          await expect(page.getByTestId("user-avatar").first()).toBeVisible();
          await search.fill("");
        }
        if (tab === "squads" || tab === "directSquads") {
          await expect(page.getByRole("textbox").first()).toBeVisible();
          await expect(page.getByText(/Loading communities/)).toHaveCount(0);
        }
        if (
          tab.toLowerCase() === "activity" &&
          community.name === "organization"
        ) {
          await expect(
            page.getByText("No shared Beacons yet", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: /Open Beacon / }),
          ).toHaveCount(0);
        }
        if (
          tab.toLowerCase() === "activity" &&
          community.name !== "organization"
        ) {
          await expect(
            page.getByRole("button", { name: /Open Beacon / }).first(),
          ).toBeVisible();
          await expect(page.getByTestId(/^beacon-icon-/).first()).toBeVisible();
          await page
            .getByRole("button", { name: /Open Beacon / })
            .first()
            .click();
          await expect(page.getByTestId("activity-detail-hero")).toBeVisible();
          await page.getByRole("button", { name: "Back", exact: true }).click();
          await expect(page).toHaveURL(
            new RegExp(`${community.base}\\?tab=${tab}`),
          );
        }
        if (tab === "Settings" || tab === "settings" || tab === "manage") {
          await expect(
            page
              .getByRole("button", {
                name: /^(Community details|Squad details|Organization details|Network details|Details|Members & roles|Members and roles)$/,
              })
              .first(),
          ).toBeVisible();
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.expo/frontend-4a-${community.name}-${tab}-${width}.png`,
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
    });
  }
}

test("In Common opens grouped actual rows and keeps private details out", async ({
  page,
}) => {
  await page.goto("/squad/boxing");
  await startDemoFromEntry(page);
  await page
    .getByRole("button", { name: "Shared Beacons in common", exact: true })
    .click();
  const details = page.getByRole("dialog", { name: "In Common", exact: true });
  await expect(details).toContainText("Shared Beacons");
  await expect(
    details.getByRole("button", { name: /Open Beacon / }).first(),
  ).toBeVisible();
  await expect(details.getByTestId(/^beacon-icon-/).first()).toBeVisible();
  await details
    .getByRole("textbox", { name: "Search in common", exact: true })
    .fill("does-not-match-anything");
  await expect(
    details.getByText("No matching people or communities.", { exact: true }),
  ).toBeVisible();
  await details
    .getByRole("textbox", { name: "Search in common", exact: true })
    .fill("");
  await page.screenshot({
    path: ".expo/frontend-4a-in-common.png",
    fullPage: true,
  });
});
