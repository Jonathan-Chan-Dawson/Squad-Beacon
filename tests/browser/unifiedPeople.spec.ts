import { expect, test } from "@playwright/test";
import { startDemoFromEntry } from "./demoEntry";

for (const width of [320, 390, 430, 1100]) {
  test(`invitation changes commit only on Done at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({
      reducedMotion: "reduce",
      colorScheme: width === 430 ? "dark" : "light",
    });
    await page.goto("/create?editor=yes");
    await startDemoFromEntry(page);
    const open = page.getByRole("button", {
      name: /^(?:Add friends|Edit invited friends)$/,
    });
    await open.click();
    const picker = page.getByRole("dialog", {
      name: "Invite friends",
      exact: true,
    });
    const jordan = picker.getByRole("checkbox", {
      name: "Select Jordan Ellis",
      exact: true,
    });
    await picker
      .getByLabel("Search friends", { exact: true })
      .fill("Jordan");
    await jordan.click();
    await expect(jordan).toBeChecked();
    await picker.getByRole("button", { name: "Cancel", exact: true }).click();
    await open.click();
    await picker
      .getByLabel("Search friends", { exact: true })
      .fill("Jordan");
    await expect(jordan).not.toBeChecked();
    await jordan.click();
    await picker.getByRole("button", { name: "Done", exact: true }).click();
    await open.click();
    await picker
      .getByRole("button", { name: "Selected · 1", exact: true })
      .click();
    await expect(jordan).toBeChecked();
    await expect(picker.getByRole("checkbox")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({ path: `.expo/unified-people/picker-${width}.png` });
  });
}

test("more than 50 is a cancellable recommendation and keeps failed publication editable", async ({
  page,
}) => {
  const ids = Array.from({ length: 51 }, (_, i) => `unavailable-${i}`);
  await page.goto(
    `/create?${new URLSearchParams({ editor: "yes", inviteeIds: JSON.stringify(ids) })}`,
  );
  await startDemoFromEntry(page);
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  const warning = page.getByRole("dialog", {
    name: "Invite more than 50 people?",
    exact: true,
  });
  await expect(warning).toContainText("51 people");
  await warning
    .getByRole("button", { name: "Review people", exact: true })
    .click();
  await expect(warning).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await warning
    .getByRole("button", { name: "Publish with 51 invitations", exact: true })
    .click();
  await expect(warning.getByRole("alert")).toBeVisible();
  await warning
    .getByRole("button", { name: "Review people", exact: true })
    .click();
  await page.getByRole("button", { name: /^(?:Add friends|Edit invited friends)$/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Invite friends", exact: true }),
  ).toContainText("Selected · 51");
});

test("legacy Map location route opens canonical Sonar with explicit recipients", async ({
  page,
}) => {
  await page.goto("/location?extend=yes");
  await startDemoFromEntry(page);
  const sonar = page.getByRole("dialog", { name: "Start Sonar", exact: true });
  await expect(sonar).toBeVisible();
  await sonar
    .getByLabel("Search people and groups", { exact: true })
    .fill("Jordan");
  await sonar
    .getByRole("checkbox", {
      name: "Share location with Jordan Ellis",
      exact: true,
    })
    .click();
  await sonar
    .getByRole("button", { name: "Start Sonar · 1 person", exact: true })
    .click();
  await expect(sonar.getByRole("alert")).toContainText("demo never shares");
  await sonar.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sonar).toHaveCount(0);
});
