import { expect, test } from "@playwright/test";
import { guestDatabase, guestIds } from "../guestDatabase";
import { mockOnboardingAccount } from "./onboardingAccount";

for (const appearance of ["light", "dark"] as const) {
  test(`Rewards earns, unlocks and equips via a local database in ${appearance}`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await page.emulateMedia({
      reducedMotion: appearance === "dark" ? "reduce" : "no-preference",
    });
    const viewer = guestIds.host;
    const { db, role } = await guestDatabase();
    try {
      const account = await mockOnboardingAccount(page, {
        viewer,
        eligible: false,
      });
      account.snapshot.profiles[0].viewer_can_view_full_profile = true;
      await page.addInitScript(
        (scheme) => localStorage.setItem("beacon.appearance", scheme),
        appearance,
      );
      await role("root", viewer);
      await db.query(
        "insert into private.presence_config(owner_id,availability) values($1,'available')",
        [viewer],
      );
      await db.query(
        "insert into public.plans(owner_id,title,timezone,start_date) values($1,'Private Walk','UTC',current_date)",
        [viewer],
      );
      await db.exec(
        "update private.beacon_coin_policy set purchases_enabled=true",
      );
      await role("authenticated", viewer);
      for (const action of ["map", "people"]) {
        await db.query("select public.beacon_rewards($1,'checkpoint',$2)", [
          viewer,
          JSON.stringify({ action }),
        ]);
      }
      const tapResponse = Promise.withResolvers<void>();
      const shopResponse = Promise.withResolvers<void>();
      const exitTap = Promise.withResolvers<void>();
      const exitTapReceived = Promise.withResolvers<void>();
      const exitTapHandled = Promise.withResolvers<void>();
      let holdExitTap = false;
      const tapRequests: string[] = [];
      let shopViews = 0;
      await page.route("**/rest/v1/rpc/beacon_rewards", async (route) => {
        const input = route.request().postDataJSON();
        try {
          if (
            input.p_action === "view" &&
            input.p_args.format !== "mini" &&
            ++shopViews === 1
          )
            await shopResponse.promise;
          const { rows } = await db.query<{
            result: { equipped: Record<string, string> };
          }>("select public.beacon_rewards($1,$2,$3) result", [
            input.p_viewer,
            input.p_action,
            JSON.stringify(input.p_args),
          ]);
          if (input.p_action === "equip")
            account.snapshot.equipped_looks = {
              [viewer]: rows[0].result.equipped,
            };
          if (input.p_action === "tap") {
            tapRequests.push(input.p_args.request_id);
            if (holdExitTap) {
              exitTapReceived.resolve();
              await exitTap.promise;
              await route.fulfill({ json: rows[0].result }).catch(() => {});
              exitTapHandled.resolve();
              return;
            }
            if (tapRequests.length === 1) {
              await tapResponse.promise;
              if (appearance === "light") return await route.abort("failed");
            }
          }
          await route.fulfill({ json: rows[0].result });
        } catch (error) {
          await route.fulfill({
            status: 400,
            json: { message: (error as Error).message },
          });
        }
      });
      await page.goto("/profile");
      const tap = page.getByRole("button", { name: "Tap Mini Beacon" });
      const shop = page.getByRole("button", { name: "Open Shop", exact: true });
      await expect(tap).not.toHaveAttribute("aria-busy", "true");
      await expect(shop).toHaveCount(0);
      const initialTapBox = await tap.boundingBox();
      await tap.evaluate((button) => {
        for (let press = 0; press < 10; press++) button.click();
      });
      await expect(page.getByTestId("mini-beacon-tap-feedback")).toHaveText(
        "+10",
      );
      await expect(shop).toHaveCount(0);
      tapResponse.resolve();
      await expect(shop).toBeVisible();
      await expect(page.getByText(/Shop unlocked!/)).toBeVisible();
      expect(tapRequests).toHaveLength(appearance === "light" ? 2 : 1);
      expect(new Set(tapRequests).size).toBe(1);
      const shopBox = await shop.boundingBox();
      const tapBox = await tap.boundingBox();
      expect(shopBox!.x).toBeLessThan(tapBox!.x);
      expect(Math.abs(initialTapBox!.x - tapBox!.x)).toBeLessThan(1);
      await shop.click();
      await expect(page.getByText("Loading Shop…")).toBeVisible();
      await page.getByRole("tab", { name: "Quests", exact: true }).click();
      shopResponse.resolve();
      await expect(
        page.getByText("4 / 4 complete · 1,200 XP and 120 base Coins"),
      ).toBeVisible();
      await expect(page.getByText("121 Coins", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add demo Coins" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Explore Shop" }).click();
      await expect(
        page.getByRole("button", { name: "View Halo Ring", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath("shop.png"),
        animations: "disabled",
      });
      await page.getByRole("button", { name: "Filter looks: Profile" }).click();
      await expect(
        page.getByRole("button", { name: "Preview Aurora" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Preview Halo Ring" }).click();
      await expect(
        page.getByRole("dialog", { name: "Halo Ring" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Buy", exact: true }).click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("46 Coins", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Equip · Avatar ring" }).click();
      await expect(
        page.getByRole("button", { name: "Equipped · Avatar ring" }),
      ).toBeInViewport();
      await page.screenshot({
        path: info.outputPath("look-preview.png"),
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Halo Ring" })).toHaveCount(
        0,
      );
      await page.getByRole("button", { name: "Filter looks: Owned" }).click();
      await expect(
        page.getByRole("button", { name: "Preview Halo Ring" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Preview Aurora" }),
      ).toHaveCount(0);
      await page.reload();
      await page.getByRole("button", { name: "Preview Halo Ring" }).click();
      await expect(
        page.getByRole("button", { name: "Equipped · Avatar ring" }),
      ).toBeVisible();
      await expect(page.getByText("46 Coins", { exact: true })).toBeVisible();
      await page.goto("/profile");
      await expect(
        page.getByTestId("equipped-avatar-ring").first(),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath("equipped-profile.png"),
        animations: "disabled",
      });
      if (appearance === "dark") {
        holdExitTap = true;
        await expect(tap).not.toHaveAttribute("aria-busy", "true");
        await tap.click();
        await exitTapReceived.promise;
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .last()
          .click();
        await expect(
          page
            .getByRole("button", { name: "Login to use" })
            .or(page.getByLabel("Email", { exact: true }))
            .first(),
        ).toBeVisible();
        exitTap.resolve();
        await exitTapHandled.promise;
        await expect(tap).toHaveCount(0);
      }
    } finally {
      await db.close();
    }
  });
}
