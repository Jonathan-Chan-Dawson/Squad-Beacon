import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const ids = {
  alice: "11111111-1111-4111-8111-111111111111",
  bob: "22222222-2222-4222-8222-222222222222",
  carol: "33333333-3333-4333-8333-333333333333",
  teen: "44444444-4444-4444-8444-444444444444",
};
async function actor(name: keyof typeof ids) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[name],
  ]);
}
async function root() {
  await db.exec("reset role");
}
async function action(
  name: string,
  payload: Record<string, unknown> = {},
  requestId?: string,
) {
  return (
    await db.query<{ result: Record<string, any> }>(
      "select public.beacon_action($1,$2::jsonb,coalesce($3::uuid,gen_random_uuid())) result",
      [name, JSON.stringify(payload), requestId ?? null],
    )
  ).rows[0].result;
}
async function snapshot() {
  return (await db.query<{ data: any }>("select public.beacon_snapshot() data"))
    .rows[0].data;
}
test("database migration and access-control acceptance scenarios", async (t) => {
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:1]$$;
 create publication supabase_realtime;
 `);
  for (const name of [
    "202609060001_beacon.sql",
    "202609060002_delivery.sql",
    "202609060003_profile_metrics.sql",
  ]) {
    const sql = readFileSync(
      new URL("../supabase/migrations/" + name, import.meta.url),
      "utf8",
    ).replace("create extension if not exists pgcrypto;", "");
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error("Migration " + name + ": " + (e as Error).message);
    }
  }
  for (const [name, id] of Object.entries(ids)) {
    await root();
    await db.query("insert into auth.users values($1,now())", [id]);
    await actor(name as keyof typeof ids);
    await action("onboard", {
      username: name,
      name,
      birth_date: name === "teen" ? "2010-01-01" : "2000-01-01",
      timezone: "America/Chicago",
    });
  }
  await t.test(
    "anonymous cannot read the API or invoke privileged functions",
    async () => {
      await db.exec("reset role; set role anon");
      await assert.rejects(() => db.query("select * from public.profiles"));
      await assert.rejects(() =>
        db.query("select public.beacon_action('create_squad','{}')"),
      );
      await assert.rejects(() =>
        db.query("select public.beacon_maintenance()"),
      );
    },
  );
  await t.test(
    "authenticated clients cannot bypass transactional writes or call mutation helpers",
    async () => {
      await actor("alice");
      await assert.rejects(() =>
        db.query(
          "insert into public.squads(owner_id,name) values(auth.uid(),'Unauthorized')",
        ),
      );
      await assert.rejects(() =>
        db.query("select private.notify(auth.uid(),null,'forged')"),
      );
      await assert.rejects(() => db.query("select public.beacon_claim_push()"));
    },
  );
  let friendship: string;
  await t.test("friendship acceptance is recipient-only", async () => {
    await actor("alice");
    await action("friend_request", { username: "bob" });
    friendship = (await snapshot()).friendships[0].id;
    assert.equal(
      (await snapshot()).profiles.some((p: any) => p.id === ids.bob),
      false,
    );
    await assert.rejects(() => action("accept_friend", { id: friendship }));
    await actor("bob");
    await action("accept_friend", { id: friendship });
    assert.equal((await snapshot()).friendships[0].status, "accepted");
  });
  let goal: string;
  await t.test(
    "private goals stay private; explicit sharing grants access only to accepted friends",
    async () => {
      await actor("alice");
      await action("save_goal", {
        title: "Private goal",
        description: "private",
        audience: "private",
      });
      goal = (await snapshot()).goals[0].id;
      await actor("bob");
      assert.equal((await snapshot()).goals.length, 0);
      await actor("alice");
      await action("save_goal", {
        id: goal,
        title: "Shared goal",
        audience: "friends",
      });
      await actor("bob");
      assert.equal((await snapshot()).goals.length, 1);
      await actor("carol");
      assert.equal((await snapshot()).goals.length, 0);
    },
  );
  let habit: string;
  await t.test(
    "habit check-ins and request retries are idempotent",
    async () => {
      await actor("alice");
      await action("save_habit", {
        title: "Train",
        schedule: "weekly",
        weekdays: [],
        weekly_target: 3,
        timezone: "America/Chicago",
        audience: "private",
      });
      habit = (await snapshot()).habits[0].id;
      await action("checkin", { id: habit });
      await action("checkin", { id: habit });
      assert.equal((await snapshot()).checkins.length, 1);
      const retry = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      await action("create_list", { name: "Boxing" }, retry);
      await action("create_list", { name: "Boxing" }, retry);
      assert.equal(
        (await snapshot()).lists.filter((x: any) => x.name === "Boxing").length,
        1,
      );
    },
  );
  const start = new Date(Date.now() + 3600000).toISOString(),
    end = new Date(Date.now() + 7200000).toISOString();
  const makeActivity = (extra: Record<string, unknown> = {}) =>
    action("create_activity", {
      title: "Boxing",
      category: "Fitness",
      mode: "squad",
      audience: "friends",
      starts_at: start,
      ends_at: end,
      timezone: "America/Chicago",
      label: "Private gym",
      latitude: 41.8,
      longitude: -87.6,
      ...extra,
    });
  let activity: string;
  await t.test(
    "approval protects meeting details and distinguishes Interested from Going",
    async () => {
      await actor("alice");
      activity = String((await makeActivity({ approval_required: true })).id);
      await actor("bob");
      assert.equal((await snapshot()).places.length, 0);
      await action("rsvp", { id: activity, status: "interested" });
      assert.equal((await snapshot()).rsvps[0].status, "interested");
      await action("rsvp", { id: activity, status: "going" });
      assert.equal((await snapshot()).rsvps[0].status, "requested");
      await assert.rejects(() =>
        action("approve_rsvp", { id: activity, user_id: ids.bob }),
      );
      await actor("alice");
      await action("approve_rsvp", { id: activity, user_id: ids.bob });
      await actor("bob");
      assert.equal((await snapshot()).places.length, 1);
      assert.equal((await snapshot()).rsvps[0].status, "going");
      await actor("carol");
      assert.equal((await snapshot()).activities.length, 0);
      await assert.rejects(() =>
        action("comment", { id: activity, body: "Intrusion" }),
      );
    },
  );
  await t.test(
    "removing an attendee revokes access even if the friend audience still matches",
    async () => {
      await actor("alice");
      await action("remove_rsvp", { id: activity, user_id: ids.bob });
      await actor("bob");
      assert.equal((await snapshot()).activities.length, 0);
    },
  );
  await t.test(
    "solo activities reject joining and bad time ranges roll back",
    async () => {
      await actor("alice");
      const solo = String((await makeActivity({ mode: "solo" })).id);
      await assert.rejects(() => makeActivity({ ends_at: start }));
      await actor("bob");
      await assert.rejects(() => action("rsvp", { id: solo, status: "going" }));
    },
  );
  let squad: string;
  await t.test(
    "squad membership requires an invitation and revocation removes shared access",
    async () => {
      await actor("alice");
      await action("create_squad", { name: "Training" });
      squad = (await snapshot()).squads[0].id;
      await makeActivity({ audience: "squad", audience_id: squad });
      await actor("carol");
      await assert.rejects(() =>
        action("invite_squad", { id: squad, user_id: ids.bob }),
      );
      await actor("alice");
      await action("invite_squad", { id: squad, user_id: ids.bob });
      await actor("bob");
      const invite = (await snapshot()).squad_invites[0].id;
      await action("accept_squad", { id: invite });
      assert.equal(
        (await snapshot()).activities.filter(
          (x: any) => x.audience_id === squad,
        ).length,
        1,
      );
      await actor("alice");
      await action("remove_member", { id: squad, user_id: ids.bob });
      await actor("bob");
      assert.equal(
        (await snapshot()).activities.filter(
          (x: any) => x.audience_id === squad,
        ).length,
        0,
      );
    },
  );
  await t.test(
    "location requires friendship, expires server-side, hides stale points, and stop removes coordinates",
    async () => {
      await actor("alice");
      const expiry = new Date(Date.now() + 3600000).toISOString();
      await assert.rejects(() =>
        action("start_location", {
          recipients: [ids.carol],
          expires_at: expiry,
        }),
      );
      let session = String(
        (
          await action("start_location", {
            recipients: [ids.bob],
            expires_at: expiry,
          })
        ).id,
      );
      await action("update_location", {
        id: session,
        latitude: 41.8,
        longitude: -87.6,
      });
      await actor("bob");
      assert.equal((await snapshot()).locations.length, 1);
      await actor("carol");
      assert.equal((await snapshot()).locations.length, 0);
      await root();
      await db.query(
        "update public.locations set updated_at=now()-interval '6 minutes' where id=$1",
        [session],
      );
      await actor("bob");
      assert.equal((await snapshot()).locations.length, 0);
      await actor("alice");
      await action("update_location", {
        id: session,
        latitude: 41.9,
        longitude: -87.7,
      });
      await root();
      await db.query(
        "update public.locations set expires_at=now()-interval '1 second' where id=$1",
        [session],
      );
      await actor("bob");
      assert.equal((await snapshot()).locations.length, 0);
      await actor("alice");
      await assert.rejects(() =>
        action("update_location", {
          id: session,
          latitude: 41.9,
          longitude: -87.7,
        }),
      );
      session = String(
        (
          await action("start_location", {
            recipients: [ids.bob],
            expires_at: expiry,
          })
        ).id,
      );
      await action("stop_location");
      await root();
      assert.equal(
        (await db.query("select * from public.locations")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "blocking removes profile, comments, activity and avatar access through direct API reads",
    async () => {
      await actor("alice");
      const open = String((await makeActivity()).id);
      await action("comment", { id: open, body: "Hello" });
      await db.query(
        "insert into storage.objects(bucket_id,name) values('avatars',$1)",
        [ids.alice + "/avatar.jpg"],
      );
      await actor("bob");
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        1,
      );
      await action("block", { id: ids.alice });
      assert.equal(
        (await snapshot()).profiles.some((p: any) => p.id === ids.alice),
        false,
      );
      assert.equal((await snapshot()).comments.length, 0);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "reports are moderator-only and cannot be self-escalated",
    async () => {
      await actor("bob");
      await action("report", {
        id: ids.alice,
        reason: "Please review this account.",
      });
      assert.equal((await snapshot()).reports.length, 0);
      await assert.rejects(() =>
        db.query(
          "update private.accounts set moderator=true where id=auth.uid()",
        ),
      );
      await root();
      await db.query("update private.accounts set moderator=true where id=$1", [
        ids.carol,
      ]);
      await actor("carol");
      const report = (await snapshot()).reports[0];
      assert.ok(report);
      await action("resolve_report", { id: report.id });
      assert.equal((await snapshot()).reports[0].resolved, true);
    },
  );
  await t.test(
    "maintenance deletes expired coordinates and old safety reports",
    async () => {
      await root();
      await db.query(
        "insert into public.locations(owner_id,expires_at,latitude,longitude) values($1,now()-interval '1 minute',41,-87)",
        [ids.alice],
      );
      await db.exec(
        "update public.reports set created_at=now()-interval '91 days'; set role service_role;",
      );
      await db.query("select public.beacon_maintenance()");
      await root();
      assert.equal(
        (await db.query("select * from public.locations")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.reports")).rows.length,
        0,
      );
    },
  );

  await t.test(
    "push jobs honor quiet hours, lease once, and remove invalid device tokens",
    async () => {
      await root();
      await db.query(
        "update public.profiles set quiet_start=0,quiet_end=0 where id=$1",
        [ids.teen],
      );
      await db.query("insert into public.push_tokens values($1,$2)", [
        "ExpoPushToken[test_token]",
        ids.teen,
      ]);
      await db.query("select private.notify($1,$2,'A generic update.')", [
        ids.teen,
        ids.carol,
      ]);
      await db.exec("set role service_role");
      const jobs = (
        await db.query<{ jobs: any[] }>(
          "select public.beacon_claim_push() jobs",
        )
      ).rows[0].jobs;
      assert.equal(jobs.length, 1);
      assert.equal(
        (
          await db.query<{ jobs: any[] }>(
            "select public.beacon_claim_push() jobs",
          )
        ).rows[0].jobs.length,
        0,
      );
      await db.query("select public.beacon_finish_push($1,null,true,false)", [
        jobs[0].id,
      ]);
      await root();
      assert.equal(
        (await db.query("select * from public.push_tokens")).rows.length,
        0,
      );
      await db.query("insert into public.push_tokens values($1,$2)", [
        "ExpoPushToken[quiet_token]",
        ids.teen,
      ]);
      await db.query(
        "update public.profiles set quiet_start=extract(hour from now() at time zone timezone)::int,quiet_end=(extract(hour from now() at time zone timezone)::int+1)%24 where id=$1",
        [ids.teen],
      );
      await db.query("select private.notify($1,$2,'A quiet update.')", [
        ids.teen,
        ids.carol,
      ]);
      await db.exec("set role service_role");
      assert.equal(
        (
          await db.query<{ jobs: any[] }>(
            "select public.beacon_claim_push() jobs",
          )
        ).rows[0].jobs.length,
        0,
      );
    },
  );
  await t.test(
    "notification retries use the same request identity without duplicate notices",
    async () => {
      await actor("carol");
      const request = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      await action("friend_request", { username: "teen" }, request);
      await action("friend_request", { username: "teen" }, request);
      await actor("teen");
      assert.equal(
        (await snapshot()).notices.filter(
          (n: any) => n.body === "You have a friend request.",
        ).length,
        1,
      );
    },
  );
  await t.test(
    "age eligibility is enforced on the server and cannot be changed through profile edits",
    async () => {
      const underage = "55555555-5555-4555-8555-555555555555";
      await root();
      await db.query("insert into auth.users values($1,now())", [underage]);
      await db.exec("set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        underage,
      ]);
      await assert.rejects(() =>
        action("onboard", {
          username: "young",
          name: "Young",
          birth_date: "2015-01-01",
          timezone: "America/Chicago",
        }),
      );
      await actor("teen");
      await assert.rejects(() =>
        db.query(
          "update private.accounts set birth_date='2000-01-01' where id=auth.uid()",
        ),
      );
    },
  );
  await t.test(
    "account deletion cascades personal data while unlinking retained reports",
    async () => {
      await actor("alice");
      await action("report", {
        id: ids.carol,
        reason: "Retained safety review.",
      });
      await root();
      await db.query("delete from auth.users where id=$1", [ids.alice]);
      assert.equal(
        (
          await db.query("select * from public.goals where owner_id=$1", [
            ids.alice,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query("select * from public.activities where owner_id=$1", [
            ids.alice,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query<{ reporter_id: string | null }>(
            "select reporter_id from public.reports where reason='Retained safety review.'",
          )
        ).rows[0].reporter_id,
        null,
      );
    },
  );

  await t.test(
    "moderator removal is authorized and deletes reported activity content",
    async () => {
      await actor("carol");
      const created = await action("create_activity", {
        title: "For moderation",
        category: "Social",
        mode: "solo",
        audience: "private",
        starts_at: start,
        ends_at: end,
        timezone: "America/Chicago",
      });
      await actor("teen");
      await assert.rejects(
        () => action("moderate_remove_activity", { id: created.id }),
        /Moderator access required/,
      );
      await actor("carol");
      await action("moderate_remove_activity", { id: created.id });
      assert.equal(
        (await snapshot()).activities.some((a: any) => a.id === created.id),
        false,
      );
    },
  );
  await t.test(
    "unknown usernames consume invitation limits without exposing account existence",
    async () => {
      await actor("teen");
      for (let i = 0; i < 20; i++) {
        const result = await action("friend_request", {
          username: "unknown_" + i,
        });
        assert.match(String(result.message), /If that account/);
      }
      await assert.rejects(
        () => action("friend_request", { username: "carol" }),
        /Too many requests/,
      );
    },
  );

  await db.close();
});
