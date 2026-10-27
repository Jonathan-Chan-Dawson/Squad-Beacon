import { expect, test } from "@playwright/test";

for (const width of [320, 430]) {
  test(`group members expand in place at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/create?editor=yes");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page
      .getByRole("button", { name: "+ Add People", exact: true })
      .click();
    const picker = page.getByRole("dialog", {
      name: "Add People",
      exact: true,
    });
    await picker.getByRole("button", { name: "Squads", exact: true }).click();
    const groups = picker.getByRole("button", { name: /^Filter friends in / });
    const count = await groups.count();
    expect(count).toBeGreaterThan(0);
    const group = groups.first();
    await group.focus();
    await page.keyboard.press("Enter");
    await expect(group).toHaveAttribute("aria-expanded", "true");
    await expect(groups).toHaveCount(count);
    await page.screenshot({ path: `.expo/prompt3-expanded-${width}.png` });
    await expect(
      picker.getByRole("button", { name: "Selected · 0", exact: true }),
    ).toBeVisible();
    const person = picker.getByRole("checkbox").first();
    expect(await person.count()).toBeGreaterThan(0);
    if (await person.count()) {
      const name = await person.getAttribute("aria-label");
      await person.click();
      await group.click();
      await expect(group).toHaveAttribute("aria-expanded", "false");
      await group.click();
      await expect(
        picker.getByRole("checkbox", { name: name!, exact: true }),
      ).toBeChecked();
      await picker.getByRole("button", { name: "Done", exact: true }).click();
      await page
        .getByRole("button", { name: "+ Add People", exact: true })
        .click();
      await picker
        .getByRole("button", { name: "Selected · 1", exact: true })
        .click();
      await expect(
        picker.getByRole("checkbox", { name: name!, exact: true }),
      ).toBeChecked();
    }
    await page.screenshot({ path: `.expo/prompt3-picker-${width}.png` });
  });
}
