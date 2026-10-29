import { expect, test, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

let harnessScript = "";

test.beforeAll(async () => {
  // Controlled async outcomes exercise the real dialogs, focus handling and overlay registry.
  // Theme and motion values are supplied without loading the entire Expo app into this fixture.
  const result = await build({
    entryPoints: ["tests/browser/fixtures/dialogs.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    alias: { "react-native": "react-native-web" },
    resolveExtensions: [
      ".web.tsx",
      ".tsx",
      ".web.ts",
      ".ts",
      ".web.js",
      ".js",
      ".json",
    ],
    define: { "process.env.NODE_ENV": '"test"', __DEV__: "true" },
    plugins: [
      {
        name: "dialog-theme",
        setup(builder) {
          builder.onResolve({ filter: /^\.\/(ui|design-system)$/ }, (args) =>
            ["Dialogs.tsx", "ContextMenu.tsx"].some((file) =>
              args.importer.endsWith(`${path.sep}${file}`),
            )
              ? { path: args.path, namespace: "dialog-theme" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "dialog-theme" }, () => ({
            contents: `
        import {useSyncExternalStore} from 'react';
        const colors={surface:'#fff',surfaceRaised:'#f1f3f5',textPrimary:'#17202a',textSecondary:'#485563',accent:'#795d17',onAccent:'#fff',border:'#ddd',danger:'#b42318',scrim:'rgba(0,0,0,.35)'};
        export const useTheme=()=>({semanticColors:colors,tokens:{radius:{sheet:20},space:{md:16},type:{title:{fontSize:20,lineHeight:26}}},styles:{body:{fontSize:16,color:colors.textPrimary},error:{color:colors.danger}}});
        export const useDesignTheme=()=>({colors});
        export const Sheet=()=>{throw new Error('Anchored test unexpectedly fell back to a sheet')};
        export const useReducedMotion=()=>useSyncExternalStore(callback=>{const query=matchMedia('(prefers-reduced-motion: reduce)');query.addEventListener('change',callback);return()=>query.removeEventListener('change',callback)},()=>matchMedia('(prefers-reduced-motion: reduce)').matches,()=>true);
      `,
            resolveDir: process.cwd(),
            loader: "js",
          }));
        },
      },
    ],
  });
  harnessScript = result.outputFiles![0].text;
});

async function fixture(page: Page) {
  await page.route("**/dialog-harness.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: harnessScript }),
  );
  await page.route("**/__dialog-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script src="/dialog-harness.js"></script></body></html>',
    }),
  );
  await page.goto("/__dialog-test");
}

async function centered(page: Page, dialog: Locator) {
  await expect(dialog.locator("..")).toHaveCSS("opacity", "1");
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.width).toBeLessThanOrEqual(401);
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(
    3,
  );
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(
    3,
  );
}

test("long confirmations stay centered with reachable actions and safe keyboard cancellation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const trigger = page.getByRole("button", {
      name: "Delete content",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Delete this content?" });
    await centered(page, dialog);
    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await expect(
      dialog.getByRole("button", { name: "Delete content", exact: true }),
    ).toBeInViewport();
    for (let index = 0; index < 7; index++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator("output")).toHaveText("Attempts: 0; saved: 0");
  }
});

test("pending confirmations block dismissal and duplicate actions, retain failures, and close after success", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Delete content", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete this content?" });
  // Two synchronous presses also cover the gap before React commits disabled state.
  await dialog
    .getByRole("button", { name: "Delete content", exact: true })
    .evaluate((node) => {
      node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  await expect(dialog.getByRole("button", { name: "Working…" })).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByTestId("dialog-backdrop").click({ position: { x: 1, y: 1 } });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.releaseConfirmation?.());
  await expect(dialog.getByRole("alert")).toContainText("The server rejected");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("output")).toHaveText("Attempts: 1; saved: 0");
  await page.getByRole("checkbox").uncheck();
  await page
    .getByRole("button", { name: "Delete content", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete content", exact: true })
    .click();
  await page.evaluate(() => window.releaseConfirmation?.());
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("output")).toHaveText("Attempts: 2; saved: 1");
});

test("quick choice dismissal completes before opening its destination", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("button", { name: "Choose action" }).click();
  const chooser = page.getByRole("dialog", { name: "Small choices" });
  await centered(page, chooser);
  await expect(
    chooser.getByRole("button", { name: "Unavailable" }),
  ).toBeDisabled();
  await chooser
    .getByRole("button", { name: "Delete content", exact: true })
    .click();
  await expect(chooser).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Delete this content?" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Choose action" }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("anchored menus share focus and isolation with a confirmation above them", async ({
  page,
}) => {
  await fixture(page);
  const trigger = page.getByRole("button", {
    name: "Anchored actions",
    exact: true,
  });
  await trigger.click();
  const menu = page.getByRole("dialog", {
    name: "Anchored choices",
    exact: true,
  });
  await expect(menu).toBeVisible();
  expect((await menu.boundingBox())!.width).toBeLessThanOrEqual(280);
  await menu
    .getByRole("button", { name: "Review deletion", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Delete this content?",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Review deletion", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("actual community choices render in both themes across phone and desktop sizes", async ({
  page,
}) => {
  for (const appearance of ["light", "dark"]) {
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      appearance,
    );
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("tab", { name: "Squads", exact: true }).click();
    for (const width of [320, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const trigger = page.getByRole("button", {
        name: "New conversation",
        exact: true,
      });
      await trigger.click();
      const chooser = page.getByRole("dialog", {
        name: "New conversation",
        exact: true,
      });
      await expect(chooser).toBeVisible();
      await centered(page, chooser);
      await page.screenshot({
        path: `.expo/dialog-polish/choices-${appearance}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(chooser).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  }
});

test("list confirmation isolates its parent sheet and cancellation preserves the unsaved name", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: "Private Lists", exact: true })
    .click();
  await page.getByRole("button", { name: "Create List", exact: true }).click();
  await page
    .getByRole("textbox", { name: "List name", exact: true })
    .fill("Dialog list");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage Dialog list", exact: true })
    .click();
  const input = page.getByRole("textbox", { name: "List name", exact: true });
  await input.fill("Unsaved name");
  await page.getByRole("button", { name: "Delete list", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Delete this list?",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: "List name", exact: true }),
  ).toHaveCount(0);
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(input).toHaveValue("Unsaved name");
  await expect(
    page.getByRole("button", { name: "Delete list", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Delete list", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "Delete list", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Private Lists", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage Dialog list", exact: true }),
  ).toHaveCount(0);
});

test("profile confirmations dismiss completely before restoring their action menu", async ({
  page,
}) => {
  await page.goto("/person/jordan");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("person-profile-identity")).toBeVisible();
  await page
    .getByRole("button", { name: "Safety & Privacy", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Safety & Privacy", exact: true })
    .getByRole("button", { name: "Block account", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Block Jordan Ellis?",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await centered(page, confirmation);
  await page.screenshot({ path: ".expo/dialog-polish-block-confirmation.png" });
  await page.keyboard.press("Escape");
  const safety = page.getByRole("dialog", {
    name: "Safety & Privacy",
    exact: true,
  });
  await expect(safety).toBeVisible();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await safety.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Friendship", exact: true })
    .getByRole("button", { name: "Remove friendship", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Remove friendship?", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Friendship", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});
