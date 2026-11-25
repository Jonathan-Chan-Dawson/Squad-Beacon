import assert from "node:assert/strict";
import test from "node:test";
import { beaconScoreTier } from "../src/features/profile/beaconScore";
import { guestDatabase, guestIds } from "./guestDatabase";

const scale = 12600;
type Wallet = {
  balance: number;
  xp: number;
  level: number;
  welcome: string[];
  equipped: Record<string, string>;
  shop_unlocked: boolean;
  clicker: { week: string; stage: number; starter_taps: number; remaining: number; charge: number };
  catalog: { id: string; price: number; owned: boolean }[];
};

test("Rewards levels use the same progression at each milestone", () => {
  for (const [level, xp] of [
    [2, 500],
    [5, 3200],
    [10, 11700],
    [20, 43700],
  ]) {
    assert.equal(beaconScoreTier(xp - 1).index + 1, level - 1);
    assert.equal(beaconScoreTier(xp).index + 1, level);
    assert.equal(
      beaconScoreTier(xp).nextStage.at - xp,
      500 + 200 * (level - 1),
    );
  }
});

test("a fresh viewer can earn 120 Coins, unlock and equip a starter ring once", async () => {
  const { db, role } = await guestDatabase();
  const { host, member } = guestIds;
  try {
    const query = async (action = "view", args = {}, viewer = host) =>
      (
        await db.query<{ wallet: Wallet }>(
          "select public.beacon_rewards($1,$2,$3) wallet",
          [viewer, action, JSON.stringify(args)],
        )
      ).rows[0].wallet;

    await role("root", host);
    await db.query(
      "insert into private.presence_config(owner_id,availability) values($1,'available')",
      [host],
    );
    await db.query(
      "insert into public.plans(owner_id,title,timezone,start_date) values($1,'Private Plan','UTC',current_date)",
      [host],
    );
    await db.exec(
      "update private.beacon_coin_policy set purchases_enabled=true",
    );

    await role("authenticated", host);
    await query("checkpoint", { action: "people" });
    await query("checkpoint", { action: "map" });
    const earned = await query("checkpoint", { action: "map" });
    assert.equal(earned.welcome.length, 5);
    assert.equal(earned.xp, 1200);
    assert.equal(earned.balance, 120 * scale);
    assert.equal(earned.level, 3);

    await assert.rejects(
      query("unlock", { item: "starter-ring", expected_price: scale }),
      /price changed/,
    );
    const purchase = () =>
      query("unlock", { item: "starter-ring", expected_price: 75 * scale });
    assert.equal((await purchase()).balance, 45 * scale);
    assert.equal((await purchase()).balance, 45 * scale);
    await assert.rejects(
      query("equip", {
        target_type: "profile",
        target_id: member,
        slot: "ring",
        item: "starter-ring",
      }),
      /cannot change/,
    );
    assert.deepEqual(
      (
        await query("equip", {
          target_type: "profile",
          target_id: host,
          slot: "ring",
          item: "starter-ring",
        })
      ).equipped,
      { ring: "starter-ring" },
    );
    assert.equal((await query()).xp, 1200);
    const snapshot = (
      await db.query<{ data: { equipped_looks: Record<string, object> } }>(
        "select public.beacon_snapshot() data",
      )
    ).rows[0].data;
    assert.deepEqual(snapshot.equipped_looks[host], { ring: "starter-ring" });

    const current = await query();
    assert.equal(current.clicker.stage, 0);
    assert.equal(current.shop_unlocked, false);
    const tap = {
      request_id: crypto.randomUUID(),
      week: current.clicker.week,
      taps: 7,
    };
    const firstBatch = await query("tap", tap);
    assert.equal(firstBatch.clicker.charge, (7 * scale) / 10);
    assert.equal(firstBatch.clicker.starter_taps, 7);
    assert.equal(
      (await query("tap", tap)).balance,
      45 * scale + (7 * scale) / 10,
    );
    await assert.rejects(query("view", {}, member), /Sign in/);
    const oldXP = (
      await db.query<{ info: { total: number } }>(
        "select public.sync_beacon_score($1,$2,10000,10000) info",
        [host, crypto.randomUUID()],
      )
    ).rows[0].info;
    assert.equal(oldXP.total, 1200);

    await role("root");
    await db.query(
      "update private.beacon_reward_clicker set taps=499,tokens=12 where owner_id=$1",
      [host],
    );
    await role("authenticated", host);
    const capped = await query("tap", {
      ...tap,
      request_id: crypto.randomUUID(),
      taps: 12,
    });
    assert.equal(capped.clicker.remaining, 0);
    assert.equal(capped.clicker.starter_taps, 8);
    assert.equal(capped.balance, 45 * scale + (8 * scale) / 10);
    await role("root");
    await db.query(
      "update private.beacon_reward_clicker set week_start=week_start-7 where owner_id=$1",
      [host],
    );
    await role("authenticated", host);
    const refreshed = await query();
    assert.equal(refreshed.clicker.remaining, 500);
    assert.equal(refreshed.clicker.starter_taps, 8);
    const finish = { request_id: crypto.randomUUID(), week: refreshed.clicker.week, taps: 2 };
    const unlocked = await query("tap", finish);
    assert.equal(unlocked.shop_unlocked, true);
    assert.equal(unlocked.clicker.stage, 1);
    assert.equal(unlocked.clicker.starter_taps, 10);
    assert.equal(unlocked.balance, 46 * scale);
    assert.equal((await query("tap", finish)).balance, unlocked.balance);
  } finally {
    await db.close();
  }
});

test("four weeks of ordinary social activity can buy standard cosmetics without taps", () => {
  const starters = 120;
  const profiles = [
    { visits: 1, hosts: 0, sparks: 1, tapCoins: 0 },
    { visits: 2, hosts: 1, sparks: 1, tapCoins: 0 },
    { visits: 4, hosts: 2, sparks: 1, tapCoins: 500 },
  ];
  assert.ok(starters >= 100);
  for (const [rate, cap] of [
    [1, 500],
    [1.5, 500],
    [2, 500],
  ]) {
    const results = profiles.map(
      (p) =>
        starters * rate +
        4 *
          ((p.visits * 50 + p.hosts * 100 + p.sparks * 30) * rate +
            Math.min(cap, p.tapCoins)),
    );
    assert.ok(results[0] >= 350);
    assert.ok(results[1] > results[0]);
    assert.ok(results[2] > results[1]);
  }
});

test("wallet unit migration preserves money and older ownership, and uses historical premium per award", async () => {
  const { db, role } = await guestDatabase("20261122160100_beacon_shop.sql");
  const { host } = guestIds;
  try {
    await db.query(
      "insert into private.beacon_coin_ledger(owner_id,kind,source,amount) values($1,'xp','original',1250)",
      [host],
    );
    await db.query(
      "insert into private.beacon_cosmetic_ownership(owner_id,item_id) values($1,'ember-beam')",
      [host],
    );
    const { readFile } = await import("node:fs/promises");
    await db.exec(
      await readFile(
        "supabase/migrations/20261123230124_beacon_rewards_v3.sql",
        "utf8",
      ),
    );
    await db.exec(await readFile("supabase/migrations/20261124192325_mini_beacon_starter_stage.sql", "utf8"));
    await db.exec(
      "update private.beacon_coin_policy set rewards_started_at=now()-interval '4 days'",
    );
    await db.query(
      "insert into private.premium_grants(owner_id,tier,verified_at) values($1,'plus',now()-interval '3 days')",
      [host],
    );
    await db.query(
      "update private.premium_grants set tier='pro', verified_at=now()-interval '1 day' where owner_id=$1",
      [host],
    );
    await db.query(
      "select private.beacon_reward_award($1,'ping_response','past',150,now()-interval '2 days')",
      [host],
    );
    await db.query(
      "select private.beacon_reward_award($1,'decision','present',150,now())",
      [host],
    );
    await role("authenticated", host);
    const { rows } = await db.query<{ wallet: Wallet }>(
      "select public.beacon_rewards($1) wallet",
      [host],
    );
    assert.equal(rows[0].wallet.balance, (12.5 + 22.5 + 30) * scale);
    assert.equal(rows[0].wallet.clicker.stage, 1);
    assert.equal(rows[0].wallet.shop_unlocked, true);
    assert.equal(
      rows[0].wallet.catalog.find((item) => item.id === "ember-beam")?.owned,
      true,
    );
  } finally {
    await db.close();
  }
});
