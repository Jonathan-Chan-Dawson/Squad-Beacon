import { test, expect } from "@playwright/test";

test("attachment draft, modes, retained text and save at phone widths", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
  await page
    .getByRole("button", { name: /Edit your status note|Add a status note/ })
    .click();
  const editor = page.getByRole("dialog", {
    name: /Edit your status|Share your status/,
  });
  await editor
    .getByRole("textbox", { name: "Activity Note", exact: true })
    .fill("Anyone down to join?");
  await editor
    .getByRole("button", { name: "Attach Activity", exact: true })
    .click();
  await expect(
    editor.getByText("Available to Feature", { exact: true }),
  ).toBeVisible();
  await editor.getByTestId("status-attachment-preview").first().click();
  await expect(editor.getByTestId("status-attachment-preview")).toHaveCount(1);
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `.expo/status-phase2/editor-${width}.png` });
  }
  await editor
    .getByRole("button", { name: "Activity Only", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit your status note", exact: true })
    .click();
  await expect(
    editor.getByRole("textbox", { name: "Activity Note", exact: true }),
  ).toHaveValue("Anyone down to join?");
  await editor.getByRole("button", { name: "Text Only", exact: true }).click();
  await expect(
    editor.getByText("Activity retained · hidden in Text Only", {
      exact: true,
    }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Text + Activity", exact: true })
    .click();
  await expect(editor.getByTestId("status-attachment-preview")).toHaveCount(1);
  await editor
    .getByRole("button", { name: "Remove attached activity", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
});

test("friends respond and vote inside attached Status without leaving browsing", async ({
  page,
}) => {
  await page.goto("/friends");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const search = page.getByRole("textbox", {
    name: "Search all friends",
    exact: true,
  });
  const viewer = page.getByRole("dialog", {
    name: "Status & activity",
    exact: true,
  });
  await search.fill("Jordan");
  await page
    .getByRole("button", { name: /Open Jordan.*shared status/ })
    .first()
    .click();
  const featured = viewer.getByTestId("featured-status-activity");
  await expect(featured.getByTestId("status-attachment-preview")).toBeVisible();
  await expect(
    viewer
      .getByTestId("status-note-speech-bubble")
      .getByTestId("status-attachment-preview"),
  ).toHaveCount(0);
  expect(
    await viewer.getByTestId("expanded-status-viewer").evaluate((node) => {
      const identity = node
        .querySelector('[role="button"][aria-label^="View"]')!
        .getBoundingClientRect();
      const bubble = node
        .querySelector('[data-testid="status-note-speech-bubble"]')!
        .getBoundingClientRect();
      const feature = node
        .querySelector('[data-testid="featured-status-activity"]')!
        .getBoundingClientRect();
      return (
        identity.bottom <= bubble.top + 1 && bubble.bottom <= feature.top + 1
      );
    }),
  ).toBe(true);
  await expect(viewer.getByTestId("status-activity-timeline")).toHaveCount(0);
  await viewer
    .getByRole("button", { name: "Choose status reaction", exact: true })
    .click();
  await page
    .getByRole("button", { name: "React with 🙌", exact: true })
    .click();
  await expect(viewer.getByTestId("status-reaction-action")).toContainText(
    "🙌",
  );
  await viewer.getByRole("button", { name: "Interested", exact: true }).click();
  await expect(
    viewer.getByRole("button", { name: "Interested", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    viewer.getByRole("button", { name: "Interested", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: ".expo/status-note-layout/ping-interested-375.png" });
  await viewer.getByRole("button", { name: "Pass", exact: true }).click();
  await expect(
    viewer.getByRole("button", { name: "Pass", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    viewer.getByRole("button", { name: "Pass", exact: true }),
  ).toBeEnabled();
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `.expo/status-note-layout/viewer-${width}.png`,
    });
  }
  await viewer.getByRole("button", { name: /Close/ }).click();
  await expect(search).toHaveValue("Jordan");
  await search.fill("Maya");
  await page
    .getByRole("button", { name: /Open Maya.*shared status/ })
    .first()
    .click();
  const vote = viewer.getByRole("button", { name: /^Lakefront picnic walk/ });
  await vote.click();
  await expect(vote).toHaveAttribute("aria-pressed", "true");
  await expect(vote).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: ".expo/status-phase4/vote-320.png" });
  await viewer.getByRole("button", { name: /Close/ }).click();
  await expect(search).toHaveValue("Maya");
  await expect(page).toHaveURL(/\/friends/);
});

test("compact attachment shortcut and quiet planning quick actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
  const own = page.getByTestId("compact-own-status");
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await own.screenshot({ path: `.expo/status-phase5/compact-${width}.png` });
    expect(
      await own.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
  }
  await own
    .getByRole("button", { name: "Attach Activity", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: /Edit your status|Share your status/,
  });
  await expect(
    editor.getByText("Available to Feature", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("textbox", { name: "Activity Note", exact: true }),
  ).toBeHidden();
  await editor.getByTestId("status-attachment-preview").first().click();
  await expect(
    editor.getByRole("textbox", { name: "Activity Note", exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("switch", { name: "Share Status", exact: true }),
  ).toBeHidden();
  await page.screenshot({ path: ".expo/status-phase5/composer.png" });
  await editor.getByRole("button", { name: /Close/ }).click();
  await page.goto("/councils");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("button", { name: "Respond", exact: true })
    .first()
    .click();
  const quick = page.getByRole("dialog", {
    name: "Quick response",
    exact: true,
  });
  await quick.getByRole("button", { name: "Interested", exact: true }).click();
  await expect(
    quick.getByRole("button", { name: "Interested", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    quick.getByRole("button", { name: "Interested", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: ".expo/status-phase5/quick-response.png" });
  await quick.getByRole("button", { name: /Close/ }).click();
  await expect(page).toHaveURL(/\/councils/);
});

test("Profile note bubble sits above the avatar and opens the shared viewer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  const bubble = page.getByTestId("profile-status-bubble");
  const avatar = page.getByTestId("profile-avatar");
  await expect(bubble).toBeVisible();
  for (const width of [320, 375, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const noteBox = (await bubble.boundingBox())!;
    const avatarBox = (await avatar.boundingBox())!;
    expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(avatarBox.y + 1);
    await page.screenshot({ path: `.expo/status-phase3/profile-${width}.png` });
  }
  await bubble.click();
  const viewer = page.getByRole("dialog", {
    name: "Status & activity",
    exact: true,
  });
  await expect(viewer.getByTestId("expanded-status-viewer")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: ".expo/status-phase3/viewer-320.png" });
  await viewer.getByRole("button", { name: /Close/ }).click();
  await expect(bubble).toBeVisible();
  await page.getByRole("tab", { name: "Beacons", exact: true }).last().click();
  await page
    .getByTestId("friends-right-now")
    .getByRole("button", { name: /shared status$/ })
    .first()
    .click();
  await expect(viewer.getByTestId("expanded-status-viewer")).toBeVisible();
});
