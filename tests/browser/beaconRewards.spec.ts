import { expect, test } from "@playwright/test";
import { guestDatabase, guestIds } from "../guestDatabase";
import { mockOnboardingAccount } from "./onboardingAccount";

for (const appearance of ["light", "dark"] as const) {
  test(`Rewards earns, unlocks and equips via a local database in ${appearance}`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
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
      await page.route("**/rest/v1/rpc/beacon_rewards", async (route) => {
        const input = route.request().postDataJSON();
        try {
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
          await route.fulfill({ json: rows[0].result });
        } catch (error) {
          await route.fulfill({
            status: 400,
            json: { message: (error as Error).message },
          });
        }
      });
      await page.goto("/beacon-shop?tab=Quests");
      await expect(
        page.getByText("4 / 4 complete · 1,200 XP and 120 base Coins"),
      ).toBeVisible();
      await expect(page.getByText("120 Coins", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add demo Coins" })).toHaveCount(0);
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
      await expect(page.getByText("45 Coins", { exact: true })).toBeVisible();
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
      await page.getByRole("button", { name: "Explore Shop" }).click();
      await page.getByRole("button", { name: "Preview Halo Ring" }).click();
      await expect(
        page.getByRole("button", { name: "Equipped · Avatar ring" }),
      ).toBeVisible();
      await expect(page.getByText("45 Coins", { exact: true })).toBeVisible();
      await page.goto("/profile");
      await expect(
        page.getByTestId("equipped-avatar-ring").first(),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath("equipped-profile.png"),
        animations: "disabled",
      });
    } finally {
      await db.close();
    }
  });
}
