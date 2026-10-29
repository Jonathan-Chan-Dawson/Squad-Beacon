import { expect, test, type Page } from "@playwright/test";

async function blank(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
}

test("full-screen invitations allow more than 20, inline list management, and keyboard focus", async ({
  page,
}) => {
  const inviteeIds = Array.from(
    { length: 20 },
    (_, index) => `unavailable-${index}`,
  );
  await page.goto(
    `/create?${new URLSearchParams({ editor: "yes", inviteeIds: JSON.stringify(inviteeIds) })}`,
  );
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "+ Add People", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Add People", exact: true });
  await modal
    .getByLabel("Search people and groups", { exact: true })
    .fill("Jordan");
  await modal
    .getByRole("checkbox", { name: "Select Jordan Ellis", exact: true })
    .click();
  await expect(
    modal.getByRole("checkbox", { name: "Select Jordan Ellis", exact: true }),
  ).toBeChecked();
  await expect(modal.getByText(/21 selected.*Invitations/)).toBeVisible();
  await modal
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Private Lists", exact: true })
    .click();
  await modal.getByRole("button", { name: "Favorites", exact: true }).click();
  await modal
    .getByRole("button", { name: "Manage Private Lists", exact: true })
    .click();
  const lists = modal.getByTestId("private-lists-inline");
  await expect(lists).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await lists
    .getByRole("button", { name: "Back to people", exact: true })
    .click();
  await expect(lists).toHaveCount(0);
  await modal.getByLabel("Search people and groups", { exact: true }).focus();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(
      await modal.evaluate((node) =>
        node.contains(document.activeElement)
          ? "inside"
          : document.activeElement?.outerHTML,
      ),
    ).toBe("inside");
  }
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Add People", exact: true }),
  ).toBeFocused();
});

test("inline audiences and communities keep distinct values and one expansion", async ({
  page,
}) => {
  await blank(page);
  const visibility = page.getByRole("button", {
    name: "Visibility",
    exact: true,
  });
  const community = page.getByRole("button", {
    name: "Community",
    exact: true,
  });
  const joining = page.getByRole("button", {
    name: "Joining & Capacity",
    exact: true,
  });
  await visibility.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Search audiences", { exact: true })
    .fill("Private List");
  const list = page.getByRole("radio", { name: / · Private List$/ }).first();
  const label = (await list.getAttribute("aria-label"))!.replace(
    " · Private List",
    "",
  );
  await list.click();
  await expect(visibility).toHaveAttribute("aria-expanded", "false");
  await expect(visibility).toContainText(label);
  await expect(
    page.getByText("No invitations yet", { exact: true }),
  ).toBeVisible();
  await community.click();
  await page
    .getByLabel("Search communities", { exact: true })
    .fill("Auburn Hoops");
  await page.getByRole("radio", { name: "Auburn Hoops", exact: true }).click();
  await expect(community).toContainText("Auburn Hoops");
  await expect(visibility).toContainText(label);
  await visibility.click();
  await community.click();
  await expect(visibility).toHaveAttribute("aria-expanded", "false");
  await joining.click();
  await expect(community).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("radio", { name: "Host Approval", exact: true }).click();
  await page.getByRole("button", { name: "Set maximum", exact: true }).click();
  await page.getByLabel("Maximum spots (2–500)", { exact: true }).fill("501");
  await joining.click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Capacity validation");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meet");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(joining).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByLabel("Maximum spots (2–500)", { exact: true }),
  ).toBeFocused();
  await community.click();
  await page
    .getByRole("button", { name: "Clear community", exact: true })
    .click();
  await expect(community).toContainText("No community selected");
  await expect(visibility).toContainText(label);
});

for (const width of [320, 375, 430, 1024]) {
  for (const theme of ["dark", "light"]) {
    test(`focused mobile polish ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (mode) => localStorage.setItem("beacon.appearance", mode),
        theme,
      );
      await blank(page);
      await page
        .getByLabel("Activity title", { exact: true })
        .fill("An activity with a long title for our friends");
      await page.screenshot({
        path: `.expo/creation-mobile/editor-${width}-${theme}.png`,
      });
      await page
        .getByRole("button", { name: "Choose artwork", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Appearance", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog", { name: "Appearance", exact: true })
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await page.getByLabel("Meeting place", { exact: true }).fill("Chicago");
      await page.getByRole("radio", { name: "Online", exact: true }).click();
      await page
        .getByLabel("HTTPS meeting link", { exact: true })
        .fill("https://example.com/meeting");
      await page.getByRole("radio", { name: "In person", exact: true }).click();
      await expect(
        page.getByLabel("Meeting place", { exact: true }),
      ).toHaveValue("Chicago");
      await page.getByRole("radio", { name: "Online", exact: true }).click();
      await expect(
        page.getByLabel("HTTPS meeting link", { exact: true }),
      ).toHaveValue("https://example.com/meeting");
      const visibility = page.getByRole("button", {
        name: "Visibility",
        exact: true,
      });
      await visibility.click();
      await page.screenshot({
        path: `.expo/creation-mobile/visibility-${width}-${theme}.png`,
      });
      await page
        .getByRole("button", { name: "+ Add People", exact: true })
        .click();
      const modal = page.getByRole("dialog", {
        name: "Add People",
        exact: true,
      });
      await expect(modal).toBeInViewport();
      expect((await modal.boundingBox())!.height).toBeGreaterThan(800);
      await modal
        .getByLabel("Search people and groups", { exact: true })
        .fill("Jordan");
      await modal
        .getByRole("checkbox", { name: "Select Jordan Ellis", exact: true })
        .click();
      await page.screenshot({
        path: `.expo/creation-mobile/invitations-${width}-${theme}.png`,
      });
      await modal.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "+ Add People", exact: true }),
      ).toBeFocused();
      await expect(visibility).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByText("No invitations yet", { exact: true }),
      ).toBeVisible();
      await visibility.click();
      await page
        .getByRole("button", { name: "Community", exact: true })
        .click();
      await page
        .getByLabel("Search communities", { exact: true })
        .fill("Auburn Hoops");
      await page
        .getByRole("radio", { name: "Auburn Hoops", exact: true })
        .click();
      await page.screenshot({
        path: `.expo/creation-mobile/selected-${width}-${theme}.png`,
      });
      await expect(
        page.getByLabel("Activity title", { exact: true }),
      ).toHaveValue("An activity with a long title for our friends");
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Review your Beacon", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `.expo/creation-mobile/preview-${width}-${theme}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    });
  }
}
