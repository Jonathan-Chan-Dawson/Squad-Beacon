import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { aggregatePulse } from "@/src/features/pulse/aggregatePulse";
import { pulseAreaKey, pulseAreaCenter } from "@/src/features/pulse/validation";
import type { PulseReport } from "@/src/features/pulse/reports";

test("isolated Live Update SQL enforces private rows, rolling submissions, cooldown, expiry and summary parity", async () => {
  const db = new PGlite(),
    owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222";
  const root = () => db.exec("reset role");
  const actor = async (id: string) => {
    await db.exec("reset role;set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const call = async (name: string, args: unknown[]) =>
    (
      await db.query<{ value: any }>(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
        args,
      )
    ).rows[0].value;
  const draft = (
    key = "cafe",
    answers: Record<string, unknown> = { crowd: 2, wait: 2 },
    category = "cafe",
  ) => ({
    placeKey: key,
    lat: 41.8,
    lng: -87.6,
    category,
    answers,
    note: "Open terrace",
  });
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;
      create table public.profiles(id uuid primary key);insert into public.profiles values('${owner}'),('${other}');`);
    // Only this in-memory PGlite database executes the new file; no linked database or CLI apply.
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610090002_live_updates.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await actor(owner);
    const first = await call("post_pulse", [JSON.stringify(draft())]);
    assert.equal(first.recentCount, 2);
    assert.equal(first.confidence.crowd, 1);
    assert.equal(first.confidence.wait, 1);
    assert.ok(!JSON.stringify(first).includes(owner));
    assert.ok(!JSON.stringify(first).includes("reporter"));
    await assert.rejects(
      db.query("select * from public.pulse_reports"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from private.pulse_batches"),
      /permission denied/,
    );
    await call("post_pulse", [JSON.stringify(draft())]);
    await root();
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.pulse_reports where place_key='cafe'",
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from private.pulse_post_events",
        )
      ).rows[0].n,
      2,
    );
    await actor(owner);
    for (const invalid of [
      null,
      {},
      { ...draft(), answers: {} },
      { ...draft(), lat: null },
      { ...draft(), answers: { condition: "blocked_closed" } },
      { ...draft(), category: "trail" },
      { ...draft(), lat: 44 },
    ])
      await assert.rejects(
        call("post_pulse", [invalid === null ? null : JSON.stringify(invalid)]),
      );
    for (const invalid of [
      null,
      {},
      { north: 42, south: 41, east: -87 },
      { north: 40, south: 41, east: -87, west: -88 },
    ])
      await assert.rejects(
        call("get_pulse_summaries", [
          invalid === null ? null : JSON.stringify(invalid),
          15,
        ]),
      );
    await root();
    await db.exec("delete from private.pulse_post_events");
    await actor(owner);
    for (let i = 0; i < 6; i++)
      await call("post_pulse", [JSON.stringify(draft("rate-" + i))]);
    await assert.rejects(
      call("post_pulse", [JSON.stringify(draft("rate-7"))]),
      /pulse_rate_limited/,
    );
    await assert.rejects(
      db.query(
        "insert into public.pulse_reports(reporter_id,place_key,lat,lng,category,kind,value,expires_at) values($1,'rate-direct-bypass',41.8,-87.6,'cafe','crowd','2',now())",
        [owner],
      ),
      /pulse_rate_limited/,
    );
    await root();
    await db.exec(
      "update private.pulse_post_events set at=now()-interval '59 minutes'",
    );
    await actor(owner);
    await assert.rejects(
      call("post_pulse", [JSON.stringify(draft("rate-next-clock-hour"))]),
      /pulse_rate_limited/,
    );
    await root();
    await db.exec(
      "update private.pulse_post_events set at=now()-interval '1 hour'",
    );
    await actor(owner);
    await call("post_pulse", [
      JSON.stringify(draft("rate-after-rolling-window")),
    ]);
    await root();
    await db.exec("delete from private.pulse_post_events");
    await actor(owner);
    await db.query(
      "insert into public.pulse_reports(reporter_id,place_key,lat,lng,category,kind,value,created_at,expires_at,confirm_count) values($1,'direct',41.8,-87.6,'cafe','crowd','2','2030-01-01','2090-01-01',999)",
      [owner],
    );
    await assert.rejects(
      db.query(
        "insert into public.pulse_reports(reporter_id,place_key,lat,lng,category,kind,value,expires_at) values($1,'wrong-owner',41.8,-87.6,'cafe','crowd','2',now())",
        [other],
      ),
      /unauthorized/,
    );
    await root();
    const direct = (
      await db.query<{ ttl: number; confirm_count: number }>(
        "select extract(epoch from expires_at-created_at)::float8 ttl,confirm_count from public.pulse_reports where place_key='direct'",
      )
    ).rows[0];
    assert.equal(direct.ttl, 5400);
    assert.equal(direct.confirm_count, 0);
    await db.exec("delete from private.pulse_post_events");
    await actor(owner);
    const closure = draft("closed", { condition: "blocked_closed" }, "trail");
    assert.equal(
      (await call("post_pulse", [JSON.stringify(closure)])).conditions[0]
        .strength,
      "reported",
    );
    const confirmed = await call("confirm_pulse", ["closed"]);
    assert.equal(confirmed.conditions[0].strength, "reported");
    assert.equal(confirmed.confirmCount, 1);
    await assert.rejects(call("confirm_pulse", ["closed"]), /cooldown/);
    await actor(other);
    assert.equal(
      (await call("post_pulse", [JSON.stringify(closure)])).conditions[0]
        .strength,
      "likely",
    );
    await call("report_pulse_note", ["closed", "Open terrace"]);
    assert.equal(
      (
        await call("get_pulse_summaries", [
          JSON.stringify({ north: 42, south: 41, east: -87, west: -88 }),
          15,
        ])
      ).find((s: any) => s.placeKey === "closed").noteSample,
      undefined,
    );
    await actor(owner);
    assert.equal(
      (
        await call("get_pulse_summaries", [
          JSON.stringify({ north: 42, south: 41, east: -87, west: -88 }),
          15,
        ])
      ).find((s: any) => s.placeKey === "closed").noteSample,
      "Open terrace",
    );
    const area = pulseAreaKey(41.8, -87.6);
    await call("post_pulse", [
      JSON.stringify({ ...draft(area, { crowd: 1 }, "area"), note: undefined }),
    ]);
    const center = pulseAreaCenter(area);
    await actor(other);
    const sameArea = await call("post_pulse", [
      JSON.stringify({
        ...draft(area, { crowd: 2 }, "area"),
        lat: center.lat + 0.0002,
        lng: center.lng + 0.0002,
      }),
    ]);
    assert.equal(sameArea.lat, center.lat);
    assert.equal(sameArea.lng, center.lng);
    await actor(owner);
    await assert.rejects(
      call("post_pulse", [
        JSON.stringify(draft("area:invalid", { crowd: 1 }, "area")),
      ]),
      /invalid_area/,
    );
    await root();
    await db.exec(
      "update public.pulse_reports set created_at=now()-interval '7 hours 50 minutes',expires_at=now()+interval '10 minutes' where place_key='closed';delete from private.pulse_confirmations where place_key='closed'",
    );
    await actor(owner);
    await call("confirm_pulse", ["closed"]);
    await root();
    assert.ok(
      (
        await db.query<{ ok: boolean }>(
          "select bool_and(expires_at<=created_at+interval '8 hours') ok from public.pulse_reports where place_key='closed'",
        )
      ).rows[0].ok,
    );
    const fixed = Date.now();
    await db.query(
      "update public.pulse_reports set created_at=to_timestamp($1/1000.0)-interval '20 minutes',last_confirmed_at=null,expires_at=to_timestamp($1/1000.0)+interval '50 minutes' where place_key='cafe' and kind='crowd'",
      [fixed],
    );
    const raw = (
      await db.query<any>(
        "select id,place_key,lat,lng,category,kind,value,note,extract(epoch from created_at)*1000 created,extract(epoch from expires_at)*1000 expires,extract(epoch from last_confirmed_at)*1000 confirmed,confirm_count from public.pulse_reports where place_key='cafe'",
      )
    ).rows;
    const pure = aggregatePulse(
      raw.map((r): PulseReport => ({
        id: r.id,
        placeKey: r.place_key,
        lat: r.lat,
        lng: r.lng,
        category: r.category,
        kind: r.kind,
        value: r.value,
        note: r.note ?? undefined,
        createdAt: Number(r.created),
        expiresAt: Number(r.expires),
        lastConfirmedAt: r.confirmed ? Number(r.confirmed) : undefined,
        confirmCount: r.confirm_count,
      })),
      fixed,
    );
    const sql = (
      await db.query<any>(
        "select private.pulse_summary('cafe',to_timestamp($1/1000.0),$2::uuid) result",
        [fixed, owner],
      )
    ).rows[0].result;
    assert.equal(sql.crowd, pure.crowd);
    assert.equal(sql.wait, pure.wait);
    assert.equal(sql.recentCount, pure.recentCount);
    assert.ok(Math.abs(sql.freshness - pure.freshness) < 1e-8);
    assert.ok(
      Math.abs(
        sql.signals.crowd.totalWeight - pure.signals!.crowd!.totalWeight,
      ) < 1e-8,
    );
    await db.exec(
      "update public.pulse_reports set expires_at=now() where place_key='direct'",
    );
    await actor(owner);
    await assert.rejects(call("confirm_pulse", ["direct"]), /no_active/);
    await assert.rejects(
      call("cleanup_pulse_reports", []),
      /permission denied/,
    );
    await root();
    await db.exec("set role service_role");
    await call("cleanup_pulse_reports", []);
    await root();
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.pulse_reports where place_key='direct'",
        )
      ).rows[0].n,
      0,
    );
    await actor(owner);
    await db.exec("delete from public.pulse_reports");
    await root();
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.pulse_reports where reporter_id=$1",
          [owner],
        )
      ).rows[0].n,
      0,
    );
    assert.ok(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.pulse_reports where reporter_id=$1",
          [other],
        )
      ).rows[0].n > 0,
    );
  } finally {
    await db.close();
  }
});
