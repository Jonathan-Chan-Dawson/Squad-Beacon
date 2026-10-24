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
    test(`inline creator ${width}px ${appearance}`, async ({ page }) => {
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
        path: `.expo/creation-inline/hub-${width}-${appearance}.png`,
      });
      await page
        .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
        .click();
      const people = page.getByRole("heading", {
        name: "People & Community",
        exact: true,
      });
      await expect(people).toBeInViewport();
      expect((await people.boundingBox())!.y).toBeLessThan(600);
      const heading = page.getByRole("heading", {
        name: "Create Beacon",
        exact: true,
      });
      expect(
        await heading.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBeTruthy();
      await expect(
        page.getByRole("button", { name: "Create Beacon", exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Modules", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");
      await expect(
        page.getByRole("button", { name: "Advanced Options", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");
      await page.screenshot({
        path: `.expo/creation-inline/editor-${width}-${appearance}.png`,
      });
      await page
        .getByLabel("Activity title", { exact: true })
        .fill("A longer basketball activity title with friends");
      await page.getByLabel("Activity title", { exact: true }).press("Tab");
      await page
        .getByRole("button", { name: "Joining & Capacity", exact: true })
        .click();
      await page
        .getByRole("radio", { name: "Host Approval", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Set maximum", exact: true })
        .click();
      await page.getByLabel("Maximum spots (2–500)", { exact: true }).fill("6");
      await page
        .getByRole("switch", { name: "Enforce maximum", exact: true })
        .check();
      await page.screenshot({
        path: `.expo/creation-inline/people-${width}-${appearance}.png`,
      });
      await page.getByRole("button", { name: "Modules", exact: true }).click();
      await page
        .getByRole("switch", { name: "Checklist", exact: true })
        .check();
      await expect(
        page.getByRole("button", { name: "Checklist settings", exact: true }),
      ).toHaveCount(0);
      await page.screenshot({
        path: `.expo/creation-inline/modules-${width}-${appearance}.png`,
      });
      const advancedHeader = page.getByRole("button", {
        name: "Advanced Options",
        exact: true,
      });
      await advancedHeader.scrollIntoViewIfNeeded();
      await advancedHeader.evaluate((node) =>
        node.addEventListener(
          "pointerdown",
          () => {
            (window as any).creationAnchorY = node.getBoundingClientRect().top;
          },
          { once: true },
        ),
      );
      await advancedHeader.click();
      const anchorY = await page.evaluate(
        () => (window as any).creationAnchorY as number,
      );
      if (width === 375 && appearance === "dark") {
        await expect
          .poll(async () => (await advancedHeader.boundingBox())!.y - anchorY)
          .toBeGreaterThan(-24);
        await expect
          .poll(async () => (await advancedHeader.boundingBox())!.y - anchorY)
          .toBeLessThan(24);
      }
      await expect(
        page.getByRole("button", { name: "Modules", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");
      await page
        .getByLabel("Description & details", { exact: true })
        .fill("Bring water and comfortable shoes. ".repeat(12));
      await page.screenshot({
        path: `.expo/creation-inline/advanced-${width}-${appearance}.png`,
      });
      await page.getByRole("button", { name: "Modules", exact: true }).click();
      await expect(
        page.getByRole("switch", { name: "Checklist", exact: true }),
      ).toBeChecked();
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      const review = page.getByRole("dialog", {
        name: "Review your Beacon",
        exact: true,
      });
      await expect(
        review.getByText("Who can see it", { exact: true }),
      ).toBeVisible();
      await expect(review.getByText(/Maximum enforced/)).toBeVisible();
      await page.screenshot({
        path: `.expo/creation-inline/review-${width}-${appearance}.png`,
      });
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    });
  }
test("Save Draft returns to the hub and restores title, modules, visibility and capacity after restart", async ({
  page,
}) => {
  await blank(page);
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Restart-safe draft");
  await page.getByRole("button", { name: "Modules", exact: true }).click();
  await page.getByRole("switch", { name: "Checklist", exact: true }).check();
  await page.getByRole("button", { name: "Visibility", exact: true }).click();
  await page.getByRole("radio", { name: "Only me", exact: true }).click();
  await page
    .getByRole("button", { name: "Joining & Capacity", exact: true })
    .click();
  await page.getByRole("button", { name: "Set maximum", exact: true }).click();
  await page.getByLabel("Maximum spots (2–500)", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Draft saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("button", {
      name: "Resume draft: Restart-safe draft",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Restart-safe draft",
  );
  await expect(page.getByText("Private", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Joining & Capacity", exact: true })
    .click();
  await expect(
    page.getByLabel("Maximum spots (2–500)", { exact: true }),
  ).toHaveValue("7");
  await page.getByRole("button", { name: "Modules", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Checklist", exact: true }),
  ).toBeChecked();
});
test("multiple draft pills resume exact tokens, confirm removal, and update without duplicates", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await demo(page);
  for (const title of ["Draft One", "Draft Two", "Draft Three", "Draft Four"]) {
    await page
      .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
      .click();
    await page.getByLabel("Activity title", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Resume draft: ${title}`, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: /^Resume draft:/ }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "See all saved drafts", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".expo/creation-inline/draft-pills.png" });
  await page
    .getByRole("button", { name: "See all saved drafts", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Saved drafts", exact: true })
      .getByRole("button", { name: /^Resume draft:/ }),
  ).toHaveCount(4);
  await page.screenshot({ path: ".expo/creation-inline/all-drafts.png" });
  await page
    .getByRole("dialog", { name: "Saved drafts", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Delete draft: Draft Two", exact: true })
    .click();
  await page.screenshot({
    path: ".expo/creation-inline/delete-confirmation.png",
  });
  await page.getByRole("button", { name: "Keep draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume draft: Draft Two", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Delete draft: Draft Two", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume draft: Draft Two", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Resume draft: Draft One", exact: true })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Edited Draft One");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Resume draft:/ }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", {
      name: "Resume draft: Edited Draft One",
      exact: true,
    }),
  ).toBeVisible();
});
test("failed draft save stays in editor, preserves values, and permits retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).failDraftSave = true;
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("beacon.creation.") && (window as any).failDraftSave)
        throw new Error("Draft storage unavailable");
      return write.call(this, key, value);
    };
  });
  await blank(page);
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Keep these edits");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByText("Draft storage unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "Keep these edits",
  );
  await page.evaluate(() => {
    (window as any).failDraftSave = false;
  });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Resume draft: Keep these edits",
      exact: true,
    }),
  ).toBeVisible();
});
test("hidden invalid music reveals its section and focuses the field", async ({
  page,
}) => {
  await blank(page);
  await page.getByLabel("Activity title", { exact: true }).fill("Music review");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meeting");
  await page.getByRole("button", { name: "Modules", exact: true }).click();
  await page.getByRole("switch", { name: "Music link", exact: true }).check();
  await page
    .getByRole("textbox", { name: "Music link", exact: true })
    .fill("http://invalid.example");
  await page
    .getByRole("button", { name: "Advanced Options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Modules", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("textbox", { name: "Music link", exact: true }),
  ).toBeFocused();
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
  await page.getByRole("radio", { name: "Online", exact: true }).click();
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
  await expect(
    page.getByRole("button", { name: "+ Add People", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Confirm reused location and access",
      exact: true,
    })
    .click();
  await returnToHub(page);
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
  await expect(page.getByLabel("Activity title", { exact: true })).toHaveValue(
    "",
  );
});

test("recovery and unreadable drafts remain protected while healthy drafts stay usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const viewer = "demo-you",
      prefix = `beacon.creation.${Array.from(viewer)
        .map((c) => c.codePointAt(0)!.toString(16))
        .join("-")}`;
    const entries = [
      {
        token: "creation:recover",
        title: "Pending basketball",
        generation: "seed-recovery",
        chunks: 1,
        updatedAt: 3,
      },
      {
        token: "creation:broken",
        title: "Broken snapshot",
        generation: "seed-broken",
        chunks: 1,
        updatedAt: 2,
      },
      {
        token: "creation:healthy",
        title: "Healthy draft",
        generation: "seed-healthy",
        chunks: 1,
        updatedAt: 1,
      },
    ];
    localStorage.setItem(`${prefix}.index`, JSON.stringify(entries));
    for (const row of entries) {
      const fields: Record<string, unknown> = { title: row.title };
      if (row.generation === "seed-recovery")
        fields.pendingPublication = {
          action: "create_activity",
          payload: { title: row.title },
          viewer,
          requestId: "11111111-1111-4111-8111-111111111111",
        };
      localStorage.setItem(
        `${prefix}.${row.generation}.0`,
        row.generation === "seed-broken"
          ? "corrupt"
          : JSON.stringify({
              version: 1,
              viewer,
              token: row.token,
              updatedAt: row.updatedAt,
              context: { editor: "yes" },
              fields,
            }),
      );
    }
  });
  await demo(page);
  await expect(
    page.getByRole("button", {
      name: "Resume recovery: Pending basketball",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Delete draft: Pending basketball",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Delete draft: Broken snapshot",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Resume draft: Healthy draft",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: ".expo/creation-inline/protected-drafts.png" });
  await page
    .getByRole("button", {
      name: "Resume recovery: Pending basketball",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirm publication", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry confirmation", exact: true }),
  ).toBeVisible();
});

test("inline people, community, joining and direct capacity entry remain independent", async ({
  page,
}) => {
  await blank(page);
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Community review");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meeting");
  await page.getByRole("button", { name: "+ Add People", exact: true }).click();
  const friends = page.getByRole("dialog", {
    name: "Add People",
    exact: true,
  });
  await friends
    .getByRole("checkbox", { name: "Select Jordan Ellis", exact: true })
    .click();
  await friends.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Community", exact: true }).click();
  const choice = page
    .getByRole("radio")
    .filter({ hasNotText: "No community selected" })
    .filter({ hasNotText: "Online" })
    .filter({ hasNotText: "In person" })
    .first();
  const name = (await choice.getAttribute("aria-label"))!;
  const kind = await choice.locator('div[dir="auto"]').last().innerText();
  const community = `${name} · ${kind}`;
  await choice.click();
  await expect(page.getByText(community, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Visibility", exact: true }).click();
  await page.getByRole("radio", { name: "Only me", exact: true }).click();
  await expect(page.getByText(community, { exact: true })).toBeVisible();
  await expect(page.getByText("1/20 selected", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Joining & Capacity", exact: true })
    .click();
  await page.getByRole("radio", { name: "Host Approval", exact: true }).click();
  await page.getByRole("button", { name: "Set maximum", exact: true }).click();
  const maximum = page.getByLabel("Maximum spots (2–500)", { exact: true });
  await maximum.fill("");
  await expect(maximum).toBeVisible();
  await maximum.fill("501");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(maximum).toBeFocused();
  await expect(maximum).toBeInViewport();
  await maximum.fill("6");
  await page.screenshot({ path: ".expo/creation-inline/people-selected.png" });
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear community", exact: true })
    .click();
  await expect(page.getByText("1/20 selected", { exact: true })).toBeVisible();
  await expect(page.getByText("Private", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Jordan Ellis", exact: true })
    .click();
  await expect(page.getByText("1/20 selected", { exact: true })).toHaveCount(0);
});
