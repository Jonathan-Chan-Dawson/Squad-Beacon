import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("place context keeps reports private, moderates aging tips and thresholds temporary coarse interest", async () => {
  const db = new PGlite();
  const users = Array.from({ length: 8 }, (_, i) => `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`);
  const place = { placeKey: "court", category: "court", lat: 41.889, lng: -87.626 };
  const actor = async (index: number) => {
    await db.exec("reset role;set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[index]]);
  };
  const call = async (action = "read", payload: string | null = null, venue = place) =>
    (await db.query<{ value: any }>("select public.pulse_place_context($1::jsonb,$2,$3) value", [JSON.stringify(venue), action, payload])).rows[0].value;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;
      create table public.profiles(id uuid primary key);
      create table private.test_blocks(viewer uuid,other uuid);
      create function private.blocked(other_id uuid) returns boolean language sql stable as $$select exists(select 1 from private.test_blocks where (viewer=auth.uid() and other=other_id) or (viewer=other_id and other=auth.uid()))$$;`);
    for (const user of users) await db.query("insert into public.profiles values($1)", [user]);
    for (const migration of ["202610090002_live_updates.sql", "202610110002_place_knowledge.sql"])
      await db.exec(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
    await actor(0);
    assert.deepEqual(await call(), { tips: [], interest: [], ownInterest: null });
    await assert.rejects(call("tip", "hello", { ...place, placeKey: "area:test" }), /invalid_place/);
    await assert.rejects(call("interest", "study"), /invalid_interest/);
    await assert.rejects(call("tip", " "), /invalid_tip/);
    await assert.rejects(call("tip", "a".repeat(181)), /invalid_tip/);
    const first = await call("tip", "Games usually start around 6.");
    const id = first.tips[0].id;
    assert.equal(first.tips[0].own, true);
    await assert.rejects(call("helpful", id), /invalid_tip/);
    await assert.rejects(db.query("select * from private.place_interest"), /permission denied/);
    await assert.rejects(call("read", null, { ...place, lat: 40 }), /place_changed/);
    await actor(1);
    let response = await call("helpful", id);
    assert.equal(response.tips[0].helpful, 1);
    assert.equal((await call("helpful", id)).tips[0].helpful, 1);
    assert.equal(response.tips[0].own, false);
    assert.equal((await call("accurate", id)).tips[0].accuracy, "accurate");
    await assert.rejects(call("accurate", id), /cooldown/);
    assert.ok(!JSON.stringify(response).includes(users[0]));
    for (let i = 2; i <= 4; i++) { await actor(i); await call("stale", id); }
    await actor(0);
    assert.deepEqual((await call()).tips, []);
    const second = await call("tip", "South entrance is easiest for groups.");
    const secondId = second.tips[0].id;
    assert.notEqual(id, secondId);
    for (let i = 1; i <= 3; i++) {
      await actor(i);
      assert.deepEqual((await call("report", secondId)).tips, []);
    }
    await actor(0);
    assert.deepEqual((await call()).tips, []);
    const third = await call("tip", "The lights turn off at 10.");
    await db.exec("reset role");
    await db.exec("update private.place_tips set accurate_at=now()-interval '91 days'");
    await actor(1);
    assert.deepEqual((await call()).tips, []);
    await assert.rejects(call("accurate", third.tips[0].id), /invalid_tip/);
    // Self interest never reveals an otherwise suppressed small group.
    for (let i = 0; i <= 4; i++) { await actor(i); await call("interest", "pickup"); }
    await actor(0);
    assert.deepEqual((await call()).interest, []);
    await actor(5); await call("interest", "pickup");
    await actor(0);
    response = await call();
    assert.equal(response.interest.length, 1);
    assert.equal(response.interest[0].kind, "pickup");
    assert.ok(response.interest[0].validUntil > Date.now());
    assert.deepEqual(Object.keys(response.interest[0]).sort(), ["kind", "validUntil"]);
    assert.equal(response.ownInterest, "pickup");
    assert.ok(!JSON.stringify(response).includes("lat"));
    await db.exec("reset role");
    await db.query("insert into private.test_blocks values($1,$2)", [users[0], users[5]]);
    await actor(0);
    assert.equal((await call()).interest.length, 0);
    await db.exec("reset role;delete from private.test_blocks");
    await actor(0);
    // A different venue in the same coarse area sees the same aggregate.
    assert.equal((await call("read", null, { ...place, placeKey: "nearby-court", lat: 41.888 })).interest.length, 1);
    assert.equal((await call("read", null, { ...place, placeKey: "far-court", lat: 42 })).interest.length, 0);
    await actor(5); await call("withdraw");
    await actor(0);
    assert.equal((await call()).interest.length, 0);
    await actor(5); await call("interest", "pickup");
    await db.exec("reset role");
    await db.query("update private.place_interest set expires_at=now()-interval '1 minute' where viewer_id=$1", [users[5]]);
    await actor(0);
    assert.equal((await call()).interest.length, 0);
    // Contextual live answer validation uses the same place profile as the client.
    const live = async (category: string, answers: unknown) => db.query("select public.post_pulse($1::jsonb)", [JSON.stringify({ ...place, placeKey: category, category, answers })]);
    await live("court", { crowd: 2, availability: "courts_open" });
    await assert.rejects(live("court", { condition: "field_wet" }), /invalid_update/);
    await live("field", { condition: "field_wet" });
    await assert.rejects(live("field", { availability: "courts_open" }), /invalid_update/);
    await actor(7);
    for (let i = 0; i < 30; i++) await call("withdraw");
    await assert.rejects(call("withdraw"), /rate_limited/);
    await db.exec("reset role;set role anon");
    await assert.rejects(call(), /permission denied/);
  } finally { await db.close(); }
});
