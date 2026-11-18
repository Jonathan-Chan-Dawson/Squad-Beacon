import test from "node:test";
import assert from "node:assert/strict";
import { guestDatabase, guestIds } from "./guestDatabase";

test("ordered migrations expose only host-opted-in summaries to signed-out discovery", async () => {
  const { db, role, beacon } = await guestDatabase();
  try {
    const id = await beacon(false, 2);
    const asAnon = async () => {
      await role("root");
      await db.exec("set role anon");
    };
    const search = (query = "", target: string | null = null) =>
      db.query<Record<string, any>>(
        "select * from public.browse_guest_beacons($1,null,null,$2)",
        [query, target],
      );
    const visibility = () =>
      db.query<{ value: { published: boolean; enabled: boolean } }>(
        "select public.beacon_guest_visibility($1) value",
        [id],
      );
    const toggle = (enabled: boolean) =>
      db.query("select public.set_beacon_guest_visibility($1,$2)", [
        id,
        enabled,
      ]);
    const publish = (enabled: boolean) =>
      db.query(
        "select public.set_beacon_discovery($1,$2,'Chicago',41.884123,-87.632987)",
        [id, enabled],
      );
    await role("authenticated", guestIds.host);
    await assert.rejects(toggle(true), /Publish/);
    await publish(true);
    assert.deepEqual((await visibility()).rows[0].value, {
      published: true,
      enabled: false,
    });
    await asAnon();
    assert.equal((await search()).rows.length, 0);
    assert.equal((await search("", id)).rows.length, 0);
    for (const request of [
      () => toggle(true),
      visibility,
      () => db.query("select public.join_public_beacon($1)", [id]),
      () => db.query("select public.beacon_snapshot()"),
      () => db.query("select * from private.beacon_guest_discovery"),
      () => db.query("select * from public.activities"),
    ])
      await assert.rejects(request(), /permission denied/);
    await role("authenticated", guestIds.member);
    await assert.rejects(toggle(true), /Only the host/);
    await assert.rejects(visibility(), /Only the host/);
    await role("authenticated", guestIds.host);
    await toggle(true);
    await asAnon();
    const rows = (await search("chicago", id)).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].coarse_lat, "41.88");
    assert.equal(rows[0].coarse_lng, "-87.63");
    assert.equal(rows[0].viewer_response, null);
    assert.equal(rows[0].accepted_seat_count, 1);
    assert.deepEqual(
      Object.keys(rows[0]).sort(),
      [
        "activity_id",
        "title",
        "category",
        "interest_tags",
        "starts_at",
        "ends_at",
        "area_label",
        "coarse_lat",
        "coarse_lng",
        "requires_approval",
        "capacity_limit",
        "capacity_policy",
        "accepted_seat_count",
        "closed",
        "viewer_response",
      ].sort(),
    );
    assert.equal(JSON.stringify(rows).includes("SECRET VENUE"), false);
    assert.equal(JSON.stringify(rows).includes("PRIVATE DESCRIPTION"), false);
    assert.equal((await search("unmatched")).rows.length, 0);
    assert.equal((await search("", crypto.randomUUID())).rows.length, 0);
    await assert.rejects(search("x".repeat(161)), /too long/);
    await assert.rejects(
      db.query("select * from public.browse_guest_beacons('',91,0,null)"),
      /Invalid/,
    );
    await role("authenticated", guestIds.member);
    await db.query("select public.join_public_beacon($1)", [id]);
    const canonical = (
      await db.query<{ n: number }>("select private.beacon_seat_count($1) n", [
        id,
      ])
    ).rows[0].n;
    assert.equal((await search("", id)).rows[0].viewer_response, "going");
    await asAnon();
    assert.equal((await search()).rows[0].accepted_seat_count, canonical);
    assert.equal((await search()).rows[0].closed, true);
    await role("root");
    await db.query(
      "insert into public.blocks(blocker_id,blocked_id) values($1,$2)",
      [guestIds.host, guestIds.member],
    );
    await role("authenticated", guestIds.member);
    assert.equal(
      (await search("", id)).rows.length,
      0,
      "signed-in continuations preserve blocking",
    );
    await role("authenticated", guestIds.host);
    await toggle(false);
    await asAnon();
    assert.equal((await search()).rows.length, 0);
    await role("authenticated", guestIds.host);
    await toggle(true);
    await publish(false);
    await publish(true);
    assert.equal(
      (await visibility()).rows[0].value.enabled,
      false,
      "republishing does not restore guest consent",
    );
    await toggle(true);
    await role("root");
    await db.query(
      "update public.activities set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 minute' where id=$1",
      [id],
    );
    await asAnon();
    assert.equal((await search("", id)).rows.length, 0);
  } finally {
    await db.close();
  }
});
