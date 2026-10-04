import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { canUseBeaconModules } from "../src/features/beacons/beaconModules";
import { normalizeData } from "../src/shared/types";
const db = new PGlite();
const ids = {
  alice: "11111111-1111-4111-8111-111111111111",
  bob: "22222222-2222-4222-8222-222222222222",
  carol: "33333333-3333-4333-8333-333333333333",
  teen: "44444444-4444-4444-8444-444444444444",
};
async function actor(name: keyof typeof ids) {
  await actorId(ids[name]);
}
async function actorId(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id,
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
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb not null default '{}'::jsonb);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 create publication supabase_realtime;
 `);
  for (const name of [
    "202609060001_beacon.sql",
    "202609060002_delivery.sql",
    "202609060003_profile_metrics.sql",
    "202609290001_simple_beacons.sql",
    "202609290002_map_workspace.sql",
    "202609290003_mini_avatars.sql",
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
  const legacyId = "66666666-6666-4666-8666-666666666666";
  const legacyActivityId = "77777777-7777-4777-8777-777777777779";
  const legacyNoteId = "77777777-7777-4777-8777-777777777778";
  const legacyInvitedUserId = "88888888-8888-4888-8888-888888888888";
  const legacyGoingUserId = "99999999-9999-4999-8999-999999999999";
  await root();
  await db.query("insert into auth.users values($1,now())", [legacyId]);
  await db.query(
    "insert into public.profiles(id,username,name) values($1,'legacy_user','Legacy user')",
    [legacyId],
  );
  await db.query("insert into auth.users values($1,now()),($2,now())", [
    legacyInvitedUserId,
    legacyGoingUserId,
  ]);
  await db.query(
    "insert into public.profiles(id,username,name) values($1,'legacy_invited','Legacy invited'),($2,'legacy_going','Legacy going')",
    [legacyInvitedUserId, legacyGoingUserId],
  );
  for (const name of [
    "202610010001_plans_profile_survey.sql",
    "202610010002_beacon_modules.sql",
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
  await root();
  await db.query(
    "insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,timezone,audience) values($1,$2,'Legacy journal','Social','solo',now()+interval '1 day',now()+interval '2 days','UTC','private')",
    [legacyActivityId, legacyId],
  );
  await db.query(
    "insert into public.beacon_notes(id,activity_id,author_id,body,created_at) values($1,$2,$3,'Legacy memory','2026-09-01T12:00:00Z')",
    [legacyNoteId, legacyActivityId, legacyId],
  );
  await db.query(
    "insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,'invited',true),($1,$3,'going',true)",
    [legacyActivityId, legacyInvitedUserId, legacyGoingUserId],
  );
  const libraryMigration = readFileSync(
    new URL("../supabase/migrations/202610010003_shared_libraries.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(libraryMigration);
  } catch (e) {
    throw new Error("Migration 202610010003_shared_libraries.sql: " + (e as Error).message);
  }
  const planningMigration = readFileSync(
    new URL("../supabase/migrations/202610010004_planning_threads.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(planningMigration);
  } catch (e) {
    throw new Error("Migration 202610010004_planning_threads.sql: " + (e as Error).message);
  }
  const controlsMigration = readFileSync(
    new URL("../supabase/migrations/202610010005_beacon_controls.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(controlsMigration);
  } catch (e) {
    throw new Error("Migration 202610010005_beacon_controls.sql: " + (e as Error).message);
  }
  const profilePrivacyMigration = readFileSync(
    new URL("../supabase/migrations/202610030001_profile_privacy.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(profilePrivacyMigration);
  } catch (e) {
    throw new Error("Migration 202610030001_profile_privacy.sql: " + (e as Error).message);
  }
  const moduleCollectionsMigration = readFileSync(
    new URL("../supabase/migrations/202610030002_beacon_module_collections.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(moduleCollectionsMigration);
  } catch (e) {
    throw new Error("Migration 202610030002_beacon_module_collections.sql: " + (e as Error).message);
  }
  const mediaTeamsMigration = readFileSync(
    new URL("../supabase/migrations/202610030003_beacon_media_teams.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(mediaTeamsMigration);
  } catch (e) {
    throw new Error("Migration 202610030003_beacon_media_teams.sql: " + (e as Error).message);
  }
  await root();
  const invitationBackfill = await db.query<{ user_id: string; invited_by: string }>(
    "select user_id,invited_by from public.beacon_invitation_grants where activity_id=$1",
    [legacyActivityId],
  );
  assert.deepEqual(invitationBackfill.rows, [
    { user_id: legacyInvitedUserId, invited_by: legacyId },
  ]);
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
    "old profiles skip the new survey while newly onboarded accounts start pending",
    async () => {
      await root();
      const old = await db.query<{ onboarding_survey_status: string }>(
        "select onboarding_survey_status from public.profiles where id=$1",
        [legacyId],
      );
      assert.equal(old.rows[0].onboarding_survey_status, "skipped");
      const oldNote = await db.query<{
        body: string;
        revision: number;
        created_at: string;
        updated_at: string;
      }>(
        "select body,revision,created_at,updated_at from public.beacon_notes where id=$1",
        [legacyNoteId],
      );
      assert.equal(oldNote.rows[0].body, "Legacy memory");
      assert.equal(oldNote.rows[0].revision, 0);
      assert.equal(
        new Date(oldNote.rows[0].updated_at).getTime(),
        new Date(oldNote.rows[0].created_at).getTime(),
      );
      await actor("alice");
      const fresh = (await snapshot()).profiles.find(
        (profile: any) => profile.id === ids.alice,
      );
      assert.equal(fresh.onboarding_survey_status, "pending");
      assert.deepEqual(fresh.identity_tags, []);
      assert.deepEqual(fresh.aspiration_goals, []);
    },
  );
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
  await t.test(
    "mini avatar settings persist and reject invalid seeds",
    async () => {
      await actor("alice");
      const profile = (await snapshot()).profiles.find(
        (p: any) => p.id === ids.alice,
      );
      await action("save_profile", {
        ...profile,
        avatar_seed: 37,
        avatar_style: "illustrated",
      });
      const saved = (await snapshot()).profiles.find(
        (p: any) => p.id === ids.alice,
      );
      assert.equal(saved.avatar_seed, 37);
      assert.equal(saved.avatar_style, "illustrated");
      await assert.rejects(() =>
        action("save_profile", { ...profile, avatar_seed: 216 }),
      );
      await assert.rejects(() =>
        action("save_profile", { ...profile, avatar_style: "unknown" }),
      );
      assert.equal(
        (await snapshot()).profiles.find((p: any) => p.id === ids.alice)
          .avatar_seed,
        37,
      );
    },
  );
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
      // Most historical module acceptance cases model Beacons created before
      // optional tools defaulted off; opt in explicitly for those fixtures.
      enable_checklist: true,
      enable_journal: true,
      enable_experiences: true,
      enable_comments: true,
      enable_focus: true,
      starts_at: start,
      ends_at: end,
      timezone: "America/Chicago",
      label: "Private gym",
      latitude: 41.8,
      longitude: -87.6,
      ...extra,
    });
  await t.test(
    "new Beacons default optional modules off without changing legacy flags",
    async () => {
      await actor("alice");
      const created = await action("create_activity", {
        title: "Fresh defaults",
        category: "Social",
        mode: "solo",
        audience: "private",
        starts_at: start,
        ends_at: end,
        timezone: "America/Chicago",
      });
      const saved = (await snapshot()).activities.find(
        (activity: any) => activity.id === created.id,
      );
      assert.equal(saved.enable_chat, true);
      assert.equal(saved.enable_reactions, true);
      assert.equal(saved.enable_comments, true);
      assert.equal(saved.enable_scoreboard, false);
      assert.equal(saved.enable_music, false);
      assert.equal(saved.enable_checklist, false);
      assert.equal(saved.enable_journal, false);
      assert.equal(saved.enable_experiences, false);
      assert.equal(saved.enable_focus, false);
      await root();
      await db.query("delete from public.activities where id=$1", [created.id]);
    },
  );
  await t.test(
    "templates and favorites are private; chat requires participation",
    async () => {
      await actor("alice");
      await action("save_template", {
        name: "Coffee",
        title: "Coffee together",
        category: "Social",
        minutes: 30,
      });
      const template = (await snapshot()).templates[0];
      await action("favorite", { kind: "friend", id: ids.bob, add: true });
      assert.equal((await snapshot()).favorites.length, 1);
      await assert.rejects(() =>
        action("favorite", { kind: "friend", id: ids.carol, add: true }),
      );
      const aid = String(
        (
          await makeActivity({
            approval_required: true,
            description: "Bring water",
          })
        ).id,
      );
      await action("send_message", { activity_id: aid, body: "Hello crew" });
      await actor("bob");
      assert.equal((await snapshot()).templates.length, 0);
      assert.equal((await snapshot()).favorites.length, 0);
      await assert.rejects(() =>
        action("save_template", { ...template, name: "Stolen" }),
      );
      assert.equal((await snapshot()).messages.length, 0);
      await assert.rejects(() =>
        action("send_message", { activity_id: aid, body: "Before joining" }),
      );
      await action("rsvp", { id: aid, status: "going" });
      await assert.rejects(() =>
        action("send_message", { activity_id: aid, body: "Pending" }),
      );
      await actor("alice");
      await action("approve_rsvp", { id: aid, user_id: ids.bob });
      await actor("bob");
      assert.equal((await snapshot()).messages.length, 1);
      await action("send_message", { activity_id: aid, body: "On my way" });
      await action("rsvp", { id: aid, status: "withdraw" });
      assert.equal((await snapshot()).messages.length, 0);
      await action("send_message", {
        recipient_id: ids.alice,
        body: "Direct hello",
      });
      await assert.rejects(() =>
        action("send_message", { recipient_id: ids.carol, body: "Stranger" }),
      );
      await actor("carol");
      assert.equal((await snapshot()).messages.length, 0);
      await root();
      await db.query("delete from public.activities where id=$1", [aid]);
      await db.exec(
        "delete from public.messages; delete from public.templates; delete from public.favorites;",
      );
    },
  );
  await t.test(
    "profile survey data is validated, retained on partial saves, and linked to beacons",
    async () => {
      await actor("alice");
      const profile = (await snapshot()).profiles.find(
        (item: any) => item.id === ids.alice,
      );
      await action("save_profile", {
        ...profile,
        identity_tags: ["Runner", "Spanish speaker"],
        aspiration_goals: [
          {
            id: "run-weekly",
            title: "Run together",
            category: "Fitness",
            target_per_week: 3,
          },
        ],
        onboarding_survey_status: "completed",
      });
      const saved = (await snapshot()).profiles.find(
        (item: any) => item.id === ids.alice,
      );
      assert.deepEqual(saved.identity_tags, ["Runner", "Spanish speaker"]);
      assert.equal(saved.aspiration_goals[0].id, "run-weekly");
      assert.equal(saved.onboarding_survey_status, "completed");
      const {
        identity_tags: _identity,
        aspiration_goals: _goals,
        onboarding_survey_status: _status,
        ...legacyFields
      } = saved;
      await action("save_profile", {
        ...legacyFields,
        onboarding_survey_status: "skipped",
      });
      const afterPartial = (await snapshot()).profiles.find(
        (item: any) => item.id === ids.alice,
      );
      assert.deepEqual(afterPartial.identity_tags, ["Runner", "Spanish speaker"]);
      assert.equal(afterPartial.aspiration_goals[0].id, "run-weekly");
      assert.equal(afterPartial.onboarding_survey_status, "skipped");
      await assert.rejects(() =>
        action("save_profile", {
          ...afterPartial,
          aspiration_goals: [
            {
              id: "bad-target",
              title: "Impossible",
              category: "Fitness",
              target_per_week: 8,
            },
          ],
        }),
      );
      const activity = String(
        (
          await makeActivity({
            aspiration_ids: ["run-weekly"],
          })
        ).id,
      );
      assert.deepEqual(
        (await snapshot()).activities.find((item: any) => item.id === activity)
          .aspiration_ids,
        ["run-weekly"],
      );
      await assert.rejects(() =>
        makeActivity({ aspiration_ids: ["someone-elses-goal"] }),
      );
    },
  );
  await t.test(
    "profile privacy gates full snapshots, GPS, avatars, custom grants, and private attendee identity",
    async () => {
      const strangerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        strangerUsername = "privacy_stranger";
      await root();
      await db.query("insert into auth.users values($1,now())", [strangerId]);
      await db.query(
        "insert into public.profiles(id,username,name,bio) values($1,$2,'Privacy stranger','Do not disclose')",
        [strangerId, strangerUsername],
      );
      const squad = (await db.query<{ id: string }>(
        "insert into public.squads(owner_id,name) values($1,'Privacy crew') returning id",
        [ids.alice],
      )).rows[0].id,
        foreignSquad = (await db.query<{ id: string }>(
          "insert into public.squads(owner_id,name) values($1,'Foreign privacy crew') returning id",
          [ids.bob],
        )).rows[0].id,
        list = (await db.query<{ id: string }>(
          "insert into public.lists(owner_id,name) values($1,'Privacy audience') returning id",
          [ids.alice],
        )).rows[0].id,
        foreignList = (await db.query<{ id: string }>(
          "insert into public.lists(owner_id,name) values($1,'Foreign privacy list') returning id",
          [ids.bob],
        )).rows[0].id;
      await db.query(
        "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner'),($1,$3,'member'),($4,$3,'owner')",
        [squad, ids.alice, ids.bob, foreignSquad],
      );
      await db.query(
        "insert into public.list_members(list_id,user_id) values($1,$2)",
        [list, strangerId],
      );

      await actor("bob");
      let aliceProfile = (await snapshot()).profiles.find(
        (profile: any) => profile.id === ids.alice,
      );
      assert.equal(aliceProfile.viewer_can_view_full_profile, true);
      assert.equal(aliceProfile.bio, "");
      for (const key of [
        "profile_visibility",
        "default_audience",
        "timezone",
        "quiet_start",
        "quiet_end",
        "onboarding_survey_status",
        "featured_activity_id",
        "hide_featured",
      ]) assert.equal(Object.hasOwn(aliceProfile, key), false, `${key} leaked`);
      assert.deepEqual((await snapshot()).profile_visibility_grants, []);
      assert.equal(
        (await db.query("select id,username,name from public.profiles where id=$1", [ids.alice])).rows.length,
        1,
      );
      await assert.rejects(() => db.query("select bio from public.profiles where id=$1", [ids.alice]));

      await actorId(strangerId);
      assert.equal(
        (await snapshot()).profiles.some((profile: any) => profile.id === ids.alice),
        false,
      );
      assert.equal(
        (await db.query("select id,username,name from public.profiles where id=$1", [ids.alice])).rows.length,
        0,
      );

      await actor("alice");
      await action("save_profile_privacy", {
        profile_visibility: "friends",
        person_ids: [],
        squad_ids: [],
        list_ids: [],
      });
      await actor("bob");
      aliceProfile = (await snapshot()).profiles.find(
        (profile: any) => profile.id === ids.alice,
      );
      assert.equal(aliceProfile.viewer_can_view_full_profile, true);
      assert.equal(aliceProfile.profile_visibility, undefined);
      await actor("carol");
      assert.equal(
        (await snapshot()).profiles.some((profile: any) => profile.id === ids.alice),
        false,
      );

      await actor("alice");
      await action("save_profile_privacy", {
        profile_visibility: "custom",
        person_ids: [ids.carol],
        squad_ids: [squad],
        list_ids: [list],
      });
      await assert.rejects(() => db.query(
        "insert into private.profile_visibility_people(owner_id,person_id) values($1,$2)",
        [ids.alice, ids.teen],
      ));
      await assert.rejects(() => db.query("select * from private.profile_visibility_people"));
      await assert.rejects(() => action("save_profile_privacy", {
        profile_visibility: "custom", person_ids: [], squad_ids: [foreignSquad], list_ids: [],
      }));
      await assert.rejects(() => action("save_profile_privacy", {
        profile_visibility: "custom", person_ids: [], squad_ids: [], list_ids: [foreignList],
      }));

      for (const [viewer, expected] of [
        ["bob", true],
        ["carol", true],
      ] as const) {
        await actor(viewer);
        const projection = (await snapshot()).profiles.find(
          (profile: any) => profile.id === ids.alice,
        );
        assert.equal(projection?.viewer_can_view_full_profile, expected);
      }
      await actorId(strangerId);
      assert.equal(
        (await snapshot()).profiles.find((profile: any) => profile.id === ids.alice)
          ?.viewer_can_view_full_profile,
        true,
      );
      assert.deepEqual((await snapshot()).profile_visibility_grants, []);

      await root();
      await db.query("delete from public.squad_members where squad_id=$1 and user_id=$2", [squad, ids.alice]);
      await actor("bob");
      aliceProfile = (await snapshot()).profiles.find(
        (profile: any) => profile.id === ids.alice,
      );
      assert.equal(aliceProfile?.viewer_can_view_full_profile, false, "owner leaving selected squad must revoke access");
      assert.equal(aliceProfile?.bio, undefined);
      await root();
      await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner')", [squad, ids.alice]);
      await db.query("delete from public.list_members where list_id=$1 and user_id=$2", [list, strangerId]);
      await actorId(strangerId);
      assert.equal(
        (await snapshot()).profiles.some((profile: any) => profile.id === ids.alice),
        false,
        "selected list access must end immediately when membership is revoked",
      );

      await root();
      await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.alice, ids.carol]);
      await actor("carol");
      assert.equal((await snapshot()).profiles.some((profile: any) => profile.id === ids.alice), false);
      await root();
      await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [ids.alice, ids.carol]);
      await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.carol, ids.alice]);
      await actor("carol");
      assert.equal((await snapshot()).profiles.some((profile: any) => profile.id === ids.alice), false);
      await root();
      await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [ids.carol, ids.alice]);

      await actor("alice");
      await action("save_profile_privacy", {
        profile_visibility: "friends", person_ids: [], squad_ids: [], list_ids: [],
      });
      await root();
      const locationId = (await db.query<{ id: string }>(
        "insert into public.locations(owner_id,expires_at,latitude,longitude,updated_at) values($1,now()+interval '1 hour',41.8,-87.6,now()) returning id",
        [ids.alice],
      )).rows[0].id;
      await db.query("insert into private.location_recipients(session_id,user_id) values($1,$2)", [locationId, ids.bob]);
      await actor("bob");
      assert.equal((await snapshot()).locations.length, 1);
      await actor("alice");
      await action("save_profile_privacy", {
        profile_visibility: "custom", person_ids: [ids.carol], squad_ids: [], list_ids: [],
      });
      await actor("bob");
      assert.equal((await snapshot()).locations.length, 0, "profile restriction must immediately hide explicitly shared GPS");

      await root();
      await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [ids.alice + "/avatar.jpg"]);
      await actor("bob");
      assert.equal((await db.query("select * from storage.objects where bucket_id='avatars'")).rows.length, 0);
      await root();
      const privateActivity = (await db.query<{ id: string }>(
        "insert into public.activities(owner_id,title,category,mode,starts_at,ends_at,timezone,audience,approval_required) values($1,'Private attendee identity','Social','invite',now()+interval '1 day',now()+interval '2 days','UTC','private',true) returning id",
        [ids.alice],
      )).rows[0].id;
      await db.query("insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,'going',true)", [privateActivity, ids.bob]);
      await actorId(strangerId);
      assert.equal(
        (await snapshot()).profiles.some((profile: any) => profile.id === ids.bob),
        false,
        "private beacon attendee identity must not be visible to an outsider",
      );

      await root();
      await db.query("delete from public.activities where id=$1", [privateActivity]);
      await db.query("delete from public.locations where id=$1", [locationId]);
      await db.query("delete from storage.objects where bucket_id='avatars' and name=$1", [ids.alice + "/avatar.jpg"]);
      await db.query("delete from public.squads where id in($1,$2)", [squad, foreignSquad]);
      await db.query("delete from public.lists where id in($1,$2)", [list, foreignList]);
      await db.query("update public.profiles set profile_visibility='public' where id=$1", [ids.alice]);
      await db.query("delete from private.profile_visibility_people where owner_id=$1", [ids.alice]);
      await db.query("delete from private.profile_visibility_squads where owner_id=$1", [ids.alice]);
      await db.query("delete from private.profile_visibility_lists where owner_id=$1", [ids.alice]);
      await db.query("delete from public.profiles where id=$1", [strangerId]);
    },
  );
  await t.test(
    "plans create ordered beacons atomically and preserve edited template steps",
    async () => {
      await actor("alice");
      const profile = (await snapshot()).profiles.find(
          (item: any) => item.id === ids.alice,
        ),
        localDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Chicago",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .format(new Date())
          .replaceAll("/", "-"),
        tomorrow = new Date(Date.parse(localDate + "T12:00:00Z") + 86400000)
          .toISOString()
          .slice(0, 10),
        step = (extra: Record<string, unknown> = {}) => ({
          title: "Run together",
          description: "Easy pace",
          category: "Fitness",
          location_name: "Lakefront",
          lat: 41.8,
          lng: -87.6,
          day_offset: 0,
          start_time: "09:00",
          duration_minutes: 60,
          aspiration_ids: ["run-weekly"],
          ...extra,
        }),
        steps = [step(), step({ title: "Coffee", day_offset: 2, start_time: "10:00", duration_minutes: 30, aspiration_ids: [] })];
      assert.ok(profile);
      const plan = await action("create_plan", {
        title: "Weekend rhythm",
        description: "Move, then refuel.",
        timezone: "America/Chicago",
        start_date: tomorrow,
        steps,
      });
      const planId = String(plan.id),
        generated = plan.activity_ids as string[];
      assert.equal(generated.length, 2);
      let aliceSnapshot = await snapshot();
      const activities = aliceSnapshot.activities.filter(
        (item: any) => item.plan_id === planId,
      );
      assert.deepEqual(
        activities.map((item: any) => item.plan_step_index),
        [0, 1],
      );
      assert.deepEqual(activities[0].aspiration_ids, ["run-weekly"]);
      await actor("bob");
      assert.equal(
        (await snapshot()).plans.some((item: any) => item.id === planId),
        false,
      );
      await assert.rejects(() => action("cancel_plan", { id: planId }));
      await actor("alice");

      const templateResult = await action("save_plan_template", {
          title: "Easy morning",
          description: "Personal plan template.",
          timezone: "America/Chicago",
          steps: [step({ title: "Template title" })],
        }),
        templateId = String(templateResult.id),
        editedSteps = [
          step({ title: "Edited preview title", start_time: "11:00" }),
          step({ title: "Added preview beacon", day_offset: 1, aspiration_ids: [] }),
        ];
      const fromTemplate = await action("create_plan", {
        title: "Edited template plan",
        description: "Uses the preview changes.",
        timezone: "America/Chicago",
        start_date: tomorrow,
        template_id: templateId,
        steps: editedSteps,
      });
      aliceSnapshot = await snapshot();
      const edited = aliceSnapshot.activities.filter(
        (item: any) => item.plan_id === fromTemplate.id,
      );
      assert.equal(edited.length, 2);
      assert.equal(edited[0].title, "Edited preview title");
      assert.equal(edited[1].title, "Added preview beacon");

      const beforeRollback = await db.query<{ plans: number; activities: number }>(
        "select (select count(*)::int from public.plans) plans,(select count(*)::int from public.activities) activities",
      );
      await assert.rejects(() =>
        action("create_plan", {
          title: "Bad overlap",
          timezone: "America/Chicago",
          start_date: tomorrow,
          steps: [step({ aspiration_ids: [] }), step({ start_time: "09:30", aspiration_ids: [] })],
        }),
      );
      await assert.rejects(() =>
        action("create_plan", {
          title: "Missing steps",
          timezone: "America/Chicago",
          start_date: tomorrow,
        }),
      );
      const afterRollback = await db.query<{ plans: number; activities: number }>(
        "select (select count(*)::int from public.plans) plans,(select count(*)::int from public.activities) activities",
      );
      assert.deepEqual(afterRollback.rows[0], beforeRollback.rows[0]);
      assert.equal((await db.query("select * from public.plan_templates")).rows.length, 1);

      await action("activity_status", { id: generated[0], status: "completed" });
      await action("cancel_plan", { id: planId });
      const cancelled = await snapshot();
      assert.equal(cancelled.plans.find((item: any) => item.id === planId).status, "cancelled");
      assert.equal(cancelled.activities.find((item: any) => item.id === generated[0]).status, "completed");
      assert.equal(cancelled.activities.find((item: any) => item.id === generated[1]).status, "cancelled");
      await action("cancel_plan", { id: planId });
      assert.equal(
        (await snapshot()).activities.find((item: any) => item.id === generated[1])
          .status,
        "cancelled",
      );
    },
  );
  await t.test(
    "squad plans inherit member visibility and squad templates are admin-write only",
    async () => {
      await actor("alice");
      const created = await action("create_squad", { name: "Plan crew" }),
        squadId = String(created.squad_id);
      await action("invite_squad", { id: squadId, user_id: ids.bob });
      await actor("bob");
      const invite = (await snapshot()).squad_invites.find(
        (item: any) => item.squad_id === squadId,
      );
      await action("accept_squad", { id: invite.id });
      await actor("alice");
      const step = {
          title: "Crew walk",
          description: "",
          category: "Social",
          location_name: "The park",
          lat: null,
          lng: null,
          day_offset: 0,
          start_time: "10:00",
          duration_minutes: 45,
          aspiration_ids: ["run-weekly"],
        },
        savedTemplate = await action("save_plan_template", {
          squad_id: squadId,
          title: "Crew Saturday",
          description: "A reusable squad plan.",
          timezone: "America/Chicago",
          steps: [step],
        }),
        templateId = String(savedTemplate.id),
        squadLocalToday = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Chicago",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .format(new Date())
          .replaceAll("/", "-"),
        squadTomorrow = new Date(
          Date.parse(squadLocalToday + "T12:00:00Z") + 86400000,
        )
          .toISOString()
          .slice(0, 10);
      await actor("bob");
      assert.equal(
        (await snapshot()).plan_templates.find((item: any) => item.id === templateId)
          .steps[0].aspiration_ids.length,
        0,
      );
      await assert.rejects(() =>
        action("save_plan_template", {
          id: templateId,
          squad_id: squadId,
          title: "Attempted overwrite",
          timezone: "America/Chicago",
          steps: [step],
        }),
      );
      const sharedPlan = await action("create_plan", {
        title: "Crew Saturday",
        description: "Together.",
        timezone: "America/Chicago",
        start_date: squadTomorrow,
        squad_id: squadId,
        template_id: templateId,
        steps: [{ ...step, aspiration_ids: [] }],
      });
      assert.equal((await snapshot()).rsvps.some(
        (item: any) => item.activity_id === sharedPlan.activity_ids[0],
      ), false);
      await actor("carol");
      const hidden = await snapshot();
      assert.equal(hidden.plans.some((item: any) => item.id === sharedPlan.id), false);
      assert.equal(hidden.plan_templates.some((item: any) => item.id === templateId), false);
      await assert.rejects(() =>
        action("create_plan", {
          title: "Not a member",
          timezone: "America/Chicago",
          start_date: squadTomorrow,
          squad_id: squadId,
          steps: [step],
        }),
      );
      await actor("alice");
      assert.equal(
        (await snapshot()).plans.some((item: any) => item.id === sharedPlan.id),
        true,
      );
    },
  );
  const controlActivityIds: string[] = [],
    controlSquadIds: string[] = [],
    controlListIds: string[] = [],
    controlFriendshipIds: string[] = [],
    controlNoticeIds: string[] = [];
  let activity: string;
  await t.test(
    "beacon controls use canonical activity IDs and preserve active role access",
    async () => {
      await actor("alice");
      await action("friend_request", { username: "carol" });
      const carolRequest = (await snapshot()).friendships.find(
        (item: any) => item.sender_id === ids.alice && item.recipient_id === ids.carol,
      );
      controlFriendshipIds.push(carolRequest.id);
      await actor("carol");
      await action("accept_friend", { id: carolRequest.id });
      await actor("alice");
      await action("friend_request", { username: "teen" });
      const teenRequest = (await snapshot()).friendships.find(
        (item: any) => item.sender_id === ids.alice && item.recipient_id === ids.teen,
      );
      controlFriendshipIds.push(teenRequest.id);
      await actor("teen");
      await action("accept_friend", { id: teenRequest.id });

      await actor("alice");
      const fullBeacon = String(
          (await makeActivity({
            capacity_limit: 2,
            capacity_policy: "strict",
            enable_reactions: false,
          })).activity_id,
        ),
        decoyBeacon = String((await makeActivity()).activity_id);
      controlActivityIds.push(fullBeacon, decoyBeacon);
      await actor("carol");
      await action("rsvp", { id: fullBeacon, status: "going" });
      await actor("bob");
      await assert.rejects(() =>
        action("rsvp", {
          id: fullBeacon,
          activity_id: decoyBeacon,
          status: "going",
        }),
      );
      await assert.rejects(() =>
        action("react", { id: fullBeacon, activity_id: decoyBeacon }),
      );
      await actor("alice");
      await root();
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int count from public.rsvps where activity_id=$1 and user_id=$2",
            [fullBeacon, ids.bob],
          )
        ).rows[0].count,
        0,
      );

      await actor("alice");
      const roleBeacon = String((await makeActivity()).activity_id);
      controlActivityIds.push(roleBeacon);
      await actor("bob");
      await action("rsvp", { id: roleBeacon, status: "going" });
      await actor("carol");
      await action("rsvp", { id: roleBeacon, status: "going" });
      await actor("teen");
      await action("rsvp", { id: roleBeacon, status: "going" });
      await actor("alice");
      await action("assign_beacon_role", {
        id: roleBeacon,
        user_id: ids.bob,
        role: "coowner",
      });
      await action("assign_beacon_role", {
        id: roleBeacon,
        user_id: ids.carol,
        role: "coowner",
      });
      await action("assign_beacon_role", {
        id: roleBeacon,
        user_id: ids.teen,
        role: "admin",
      });
      await actor("bob");
      await assert.rejects(() =>
        action("assign_beacon_role", {
          id: roleBeacon,
          user_id: ids.carol,
          role: "admin",
        }),
      );
      await assert.rejects(() =>
        action("remove_rsvp", { id: roleBeacon, user_id: ids.carol }),
      );
      await actor("teen");
      await assert.rejects(() =>
        action("set_beacon_controls", { id: roleBeacon, manual_closed: true }),
      );
      await assert.rejects(() =>
        action("remove_rsvp", { id: roleBeacon, user_id: ids.bob }),
      );
      await actor("bob");
      await actor("carol");
      await action("set_beacon_attendance", {
        id: roleBeacon,
        state: "arriving",
      });
      await actor("alice");
      await action("invite_activity", {
        id: roleBeacon,
        user_id: ids.carol,
      });
      const afterInvite = await snapshot();
      assert.equal(
        afterInvite.rsvps.find(
          (item: any) => item.activity_id === roleBeacon && item.user_id === ids.carol,
        ).status,
        "going",
      );
      assert.equal(
        afterInvite.beacon_roles.find(
          (item: any) => item.activity_id === roleBeacon && item.user_id === ids.carol,
        ).role,
        "coowner",
      );
      assert.equal(
        afterInvite.beacon_attendance.find(
          (item: any) => item.activity_id === roleBeacon && item.user_id === ids.carol,
        ).state,
        "arriving",
      );

      await action("create_list", { name: "Controls access" });
      const listId = String(
        (await snapshot()).lists.find((item: any) => item.name === "Controls access").id,
      );
      controlListIds.push(listId);
      await action("list_member", {
        id: listId,
        user_id: ids.bob,
        add: true,
      });
      const listBeacon = String(
        (await makeActivity({ audience: "list", audience_id: listId })).activity_id,
      );
      controlActivityIds.push(listBeacon);
      await actor("bob");
      await action("rsvp", { id: listBeacon, status: "going" });
      const bobListSnapshot = normalizeData({
        ...(await snapshot()),
        viewer_id: ids.bob,
      });
      const bobListActivity = bobListSnapshot.activities.find(
        (item) => item.id === listBeacon,
      );
      assert.equal(bobListActivity?.viewer_can_access, true);
      assert.equal(bobListActivity?.accepted_seat_count, 2);
      assert.equal(
        bobListActivity &&
          canUseBeaconModules(bobListSnapshot, bobListActivity, ids.bob),
        true,
      );
      await actor("alice");
      await action("assign_beacon_role", {
        id: listBeacon,
        user_id: ids.bob,
        role: "coowner",
      });
      await action("list_member", {
        id: listId,
        user_id: ids.bob,
        add: false,
      });
      await actor("bob");
      await assert.rejects(() =>
        action("set_beacon_controls", {
          id: listBeacon,
          manual_closed: true,
        }),
      );
      await assert.rejects(() =>
        action("set_beacon_attendance", {
          id: listBeacon,
          state: "arriving",
        }),
      );
      await actor("alice");
      await action("list_member", {
        id: listId,
        user_id: ids.bob,
        add: true,
      });
      await actor("bob");
      await action("set_beacon_controls", {
        id: listBeacon,
        manual_closed: true,
      });
    },
  );
  await t.test(
    "strict capacity counts accepted seats, keeps retries harmless, and checks approvals",
    async () => {
      await actor("alice");
      const softBeacon = String(
          (await makeActivity({ capacity_limit: 2, capacity_policy: "strict" })).activity_id,
        ),
        approvalBeacon = String(
          (
            await makeActivity({
              approval_required: true,
              capacity_limit: 2,
              capacity_policy: "strict",
            })
          ).activity_id,
        );
      controlActivityIds.push(softBeacon, approvalBeacon);

      await actor("bob");
      await action("rsvp", { id: softBeacon, status: "going" });
      await action("rsvp", { id: softBeacon, status: "going" });
      await actor("alice");
      await action("set_beacon_controls", {
        id: softBeacon,
        manual_closed: true,
      });
      await actor("bob");
      await action("rsvp", { id: softBeacon, status: "going" });
      await actor("carol");
      await assert.rejects(() =>
        action("rsvp", { id: softBeacon, status: "going" }),
      );
      await actor("alice");
      await action("set_beacon_controls", {
        id: softBeacon,
        manual_closed: false,
        capacity_policy: "soft",
      });
      await actor("carol");
      await action("rsvp", { id: softBeacon, status: "going" });
      await actor("alice");
      await assert.rejects(() =>
        action("set_beacon_controls", {
          id: softBeacon,
          capacity_limit: 2,
          capacity_policy: "strict",
        }),
      );
      await assert.rejects(() =>
        action("set_beacon_controls", {
          id: softBeacon,
          music_url: "https://open.spotify.com.evil.example/playlist/x",
        }),
      );
      await action("set_beacon_controls", {
        id: softBeacon,
        capacity_limit: 2,
        capacity_policy: "soft",
        music_url: "https://open.spotify.com/playlist/abc",
        decoration_emoji: "✨",
        decoration_accent: "ocean",
      });
      const configured = (await snapshot()).activities.find(
        (item: any) => item.id === softBeacon,
      );
      assert.equal(configured.capacity_policy, "soft");
      assert.equal(configured.music_url, "https://open.spotify.com/playlist/abc");
      assert.equal(configured.decoration_emoji, "✨");

      await actor("bob");
      await action("rsvp", { id: approvalBeacon, status: "going" });
      await actor("carol");
      await action("rsvp", { id: approvalBeacon, status: "going" });
      assert.equal(
        (await snapshot()).rsvps.find(
          (item: any) => item.activity_id === approvalBeacon,
        ).status,
        "requested",
      );
      await actor("alice");
      await action("approve_rsvp", { id: approvalBeacon, user_id: ids.bob });
      await assert.rejects(() =>
        action("approve_rsvp", { id: approvalBeacon, user_id: ids.carol }),
      );
      await actor("carol");
      await action("rsvp", { id: approvalBeacon, status: "going" });
      await actor("alice");
      await action("invite_activity", {
        id: approvalBeacon,
        user_id: ids.teen,
      });
      await actor("teen");
      await assert.rejects(() =>
        action("rsvp", { id: approvalBeacon, status: "going" }),
      );
      assert.equal(
        (await snapshot()).rsvps.find(
          (item: any) => item.activity_id === approvalBeacon && item.user_id === ids.teen,
        ).status,
        "invited",
      );
    },
  );
  await t.test(
    "invites survive I'm Out, release capacity, and cannot be restored after removal",
    async () => {
      await actor("alice");
      const carolFriendship = (await snapshot()).friendships.find(
        (item: any) => item.status === "accepted" &&
          ((item.sender_id === ids.alice && item.recipient_id === ids.carol) ||
            (item.sender_id === ids.carol && item.recipient_id === ids.alice)),
      );
      assert.ok(carolFriendship, "the control fixture has an accepted Alice/Carol friendship");
      await actor("alice");
      const inviteBeacon = String((await makeActivity({
        audience: "private",
        approval_required: true,
        capacity_limit: 2,
        capacity_policy: "strict",
      })).activity_id);
      controlActivityIds.push(inviteBeacon);
      await action("invite_activity", { id: inviteBeacon, user_id: ids.bob });
      await actor("bob");
      let bobSnapshot = await snapshot();
      assert.equal(bobSnapshot.activities.some((item: any) => item.id === inviteBeacon), true);
      assert.equal(bobSnapshot.beacon_invitation_grants.some(
        (item: any) => item.activity_id === inviteBeacon && item.user_id === ids.bob,
      ), true);
      await action("rsvp", { id: inviteBeacon, status: "going" });
      await actor("alice");
      await action("assign_beacon_role", {
        id: inviteBeacon,
        user_id: ids.bob,
        role: "admin",
      });
      await actor("bob");
      await action("rsvp", { id: inviteBeacon, status: "withdraw" });
      bobSnapshot = await snapshot();
      assert.equal(bobSnapshot.rsvps.find(
        (item: any) => item.activity_id === inviteBeacon && item.user_id === ids.bob,
      ).status, "invited");
      assert.equal(bobSnapshot.beacon_roles.some(
        (item: any) => item.activity_id === inviteBeacon && item.user_id === ids.bob,
      ), true);
      assert.equal(bobSnapshot.activities.find((item: any) => item.id === inviteBeacon).accepted_seat_count, 1);
      await assert.rejects(() => action("approve_rsvp", { id: inviteBeacon, user_id: ids.bob }));
      await assert.rejects(() => action("send_message", {
        activity_id: inviteBeacon,
        body: "An invite alone is not chat access.",
      }));
      await actor("alice");
      await action("invite_activity", { id: inviteBeacon, user_id: ids.carol });
      await actor("carol");
      await action("rsvp", { id: inviteBeacon, status: "going" });
      await actor("bob");
      await assert.rejects(() => action("rsvp", { id: inviteBeacon, status: "going" }));
      bobSnapshot = await snapshot();
      assert.equal(bobSnapshot.activities.find((item: any) => item.id === inviteBeacon).accepted_seat_count, 2);
      await actor("carol");
      await action("rsvp", { id: inviteBeacon, status: "withdraw" });
      await actor("bob");
      await action("rsvp", { id: inviteBeacon, status: "going" });
      await action("send_message", {
        activity_id: inviteBeacon,
        body: "I am back in.",
      });
      await actor("alice");
      await action("remove_rsvp", { id: inviteBeacon, user_id: ids.bob });
      await actor("bob");
      bobSnapshot = await snapshot();
      assert.equal(bobSnapshot.activities.some((item: any) => item.id === inviteBeacon), false);
      assert.equal(bobSnapshot.beacon_invitation_grants.some(
        (item: any) => item.activity_id === inviteBeacon && item.user_id === ids.bob,
      ), false);
      await assert.rejects(() => action("rsvp", { id: inviteBeacon, status: "going" }));

      await actor("alice");
      const pendingBeacon = String((await makeActivity({ approval_required: true })).activity_id);
      controlActivityIds.push(pendingBeacon);
      await actor("bob");
      await action("rsvp", { id: pendingBeacon, status: "going" });
      await assert.rejects(() => action("approve_rsvp", {
        id: pendingBeacon,
        user_id: ids.bob,
      }));
      assert.equal((await snapshot()).rsvps.find(
        (item: any) => item.activity_id === pendingBeacon && item.user_id === ids.bob,
      ).status, "requested");
    },
  );
  await t.test(
    "manual arrival is self-only and retained read-only after completion",
    async () => {
      await actor("alice");
      const arrivalBeacon = String((await makeActivity()).activity_id);
      controlActivityIds.push(arrivalBeacon);
      await actor("bob");
      await action("rsvp", { id: arrivalBeacon, status: "going" });
      await action("set_beacon_attendance", {
        id: arrivalBeacon,
        state: "arriving",
      });
      await assert.rejects(() =>
        action("set_beacon_attendance", {
          id: arrivalBeacon,
          state: "present",
        }),
      );
      await assert.rejects(() =>
        action("set_beacon_attendance", {
          id: arrivalBeacon,
          user_id: ids.carol,
          state: "arriving",
        }),
      );
      await root();
      await db.query(
        "update public.activities set starts_at=now()-interval '1 minute',ends_at=now()+interval '1 hour' where id=$1",
        [arrivalBeacon],
      );
      await actor("bob");
      await action("set_beacon_attendance", {
        id: arrivalBeacon,
        state: "present",
      });
      await actor("alice");
      await action("activity_status", {
        id: arrivalBeacon,
        status: "completed",
      });
      await actor("bob");
      await action("set_beacon_attendance", {
        id: arrivalBeacon,
        state: "present",
      });
      await assert.rejects(() =>
        action("set_beacon_attendance", {
          id: arrivalBeacon,
          state: "none",
        }),
      );
      assert.equal(
        (await snapshot()).beacon_attendance.find(
          (item: any) => item.activity_id === arrivalBeacon && item.user_id === ids.bob,
        ).state,
        "present",
      );
      await actor("alice");
      await action("activity_status", {
        id: arrivalBeacon,
        status: "cancelled",
      });
      await actor("bob");
      await assert.rejects(() =>
        action("set_beacon_attendance", {
          id: arrivalBeacon,
          state: "none",
        }),
      );
    },
  );
  await t.test(
    "team snapshots count private-profile members without leaking identities or Memory storage",
    async () => {
      await actor("alice");
      const created = await makeActivity({ enable_experiences: true });
      const activityId = String(created.id);
      await action("save_beacon_scoreboard", {
        activity_id: activityId,
        enabled: true,
        max_team_size: 4,
      });
      const team = await action("create_beacon_team", {
        activity_id: activityId,
        name: "Blue",
      });
      const teamId = String(team.id);

      await actor("bob");
      await action("save_profile_privacy", {
        profile_visibility: "custom",
        person_ids: [],
        squad_ids: [],
        list_ids: [],
      });
      await action("rsvp", { id: activityId, status: "going" });
      await action("join_beacon_team", { team_id: teamId });
      const objectPath = `${activityId}/${ids.bob}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab.jpg`;
      await db.query(
        "insert into storage.objects(bucket_id,name,metadata) values('beacon-memories',$1,$2::jsonb)",
        [objectPath, JSON.stringify({ mimetype: "image/jpeg", size: 4096 })],
      );
      const memory = await action("create_beacon_memory", {
        activity_id: activityId,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        object_path: objectPath,
        media_type: "image",
        caption: "A private-author test image",
      });

      await actor("alice");
      const ownerSnapshot = await snapshot();
      const projectedTeam = ownerSnapshot.beacon_teams.find(
        (item: any) => item.id === teamId,
      );
      assert.equal(projectedTeam?.member_count, 1);
      assert.equal(
        ownerSnapshot.beacon_team_members.some(
          (item: any) => item.team_id === teamId && item.user_id === ids.bob,
        ),
        false,
        "RLS hides the private member row while the aggregate remains accurate",
      );
      assert.equal(
        ownerSnapshot.beacon_memories.some((item: any) => item.id === memory.id),
        false,
      );
      assert.deepEqual(
        (await db.query(
          "select name from storage.objects where bucket_id='beacon-memories' and name=$1",
          [objectPath],
        )).rows,
        [],
        "a Beacon host cannot read a hidden author's private media object",
      );

      await actor("bob");
      const deletion = await action("delete_beacon_memory", {
        id: memory.id,
      });
      assert.equal(deletion.object_path, objectPath);
      assert.equal(
        (await db.query(
          "select count(*)::int count from storage.objects where bucket_id='beacon-memories' and name=$1",
          [objectPath],
        )).rows[0].count,
        1,
        "the database removes the media record but leaves blob cleanup to the Storage client",
      );
      // Simulate the separately-authorized Storage API DELETE after the
      // database action has tombstoned/removed the metadata row.
      await db.query(
        "delete from storage.objects where bucket_id='beacon-memories' and name=$1",
        [objectPath],
      );
      // Restore the demo account's privacy context and remove the activity; the
      // orphaned test object is isolated to this disposable PGlite database.
      await action("save_profile_privacy", {
        profile_visibility: "public",
        person_ids: [],
        squad_ids: [],
        list_ids: [],
      });
      await root();
      await db.query("delete from public.activities where id=$1", [activityId]);
    },
  );
  await t.test(
    "paused tools keep history readable but reject new writes independently",
    async () => {
      await actor("alice");
      const moduleBeacon = String((await makeActivity()).activity_id),
        checklist = await action("add_checklist_item", {
          activity_id: moduleBeacon,
          text: "Bring water",
        }),
        hostNote = await action("add_beacon_note", {
          activity_id: moduleBeacon,
          body: "Meet outside.",
          visibility: "shared",
        });
      controlActivityIds.push(moduleBeacon);
      await actor("bob");
      await action("rsvp", { id: moduleBeacon, status: "going" });
      await actor("alice");
      await action("set_beacon_controls", {
        id: moduleBeacon,
        enable_chat: false,
        enable_checklist: false,
      });
      await actor("bob");
      const pausedSnapshot = await snapshot();
      assert.equal(
        pausedSnapshot.beacon_checklist_items.some(
          (item: any) => item.id === checklist.id,
        ),
        true,
      );
      assert.equal(
        pausedSnapshot.beacon_notes.some((item: any) => item.id === hostNote.id),
        true,
      );
      await assert.rejects(() =>
        action("send_message", {
          activity_id: moduleBeacon,
          body: "Chat should be paused.",
        }),
      );
      await assert.rejects(() =>
        action("add_checklist_item", {
          activity_id: moduleBeacon,
          text: "Paused item",
        }),
      );
      await assert.rejects(() =>
        action("toggle_checklist_item", {
          id: checklist.id,
          completed: true,
        }),
      );
      const bobNote = await action("add_beacon_note", {
        activity_id: moduleBeacon,
        body: "Journal stays open while chat is paused.",
      });
      await actor("alice");
      await action("set_beacon_controls", {
        id: moduleBeacon,
        enable_journal: false,
        enable_experiences: false,
        enable_comments: false,
        enable_reactions: false,
        enable_focus: false,
      });
      assert.equal(
        (await snapshot()).activities.find((item: any) => item.id === moduleBeacon)
          .enable_journal,
        false,
      );
      await actor("bob");
      await assert.rejects(() =>
        action("edit_beacon_note", {
          id: bobNote.id,
          body: "Edit after pause.",
          expected_revision: 0,
        }),
      );
      await assert.rejects(() =>
        action("delete_beacon_note", { id: bobNote.id }),
      );
      await assert.rejects(() =>
        action("comment", { id: moduleBeacon, body: "Paused experience." }),
      );
      await assert.rejects(() => action("react", { id: moduleBeacon }));
      const history = await snapshot();
      assert.equal(
        history.beacon_notes.some((item: any) => item.id === bobNote.id),
        true,
      );
    },
  );
  await t.test(
    "squad creation from a beacon sends invites without enrolling attendees",
    async () => {
      await root();
      const existingInviteNotices = (
        await db.query<{ id: string }>(
          "select id from public.notices where actor_id=$1 and recipient_id=$2 and body='You have a squad invitation.' and activity_id is null",
          [ids.alice, ids.bob],
        )
      ).rows.map((notice) => notice.id);
      await actor("alice");
      const squadBeacon = String((await makeActivity()).activity_id);
      controlActivityIds.push(squadBeacon);
      await actor("bob");
      await action("rsvp", { id: squadBeacon, status: "going" });
      await actor("alice");
      const requestId = "55555555-5555-4555-8555-555555555555",
        created = await action(
          "create_squad_from_beacon",
          {
            activity_id: squadBeacon,
            name: "Walk crew",
            description: "Only invited people may join.",
            invite_user_ids: [ids.bob],
          },
          requestId,
        );
      controlSquadIds.push(String(created.squad_id));
      await root();
      controlNoticeIds.push(
        ...(
          await db.query<{ id: string }>(
            "select id from public.notices where actor_id=$1 and recipient_id=$2 and body='You have a squad invitation.' and activity_id is null",
            [ids.alice, ids.bob],
          )
        ).rows
          .map((notice) => notice.id)
          .filter((noticeId) => !existingInviteNotices.includes(noticeId)),
      );
      await actor("alice");
      await action(
        "create_squad_from_beacon",
        {
          activity_id: squadBeacon,
          name: "Walk crew",
          description: "Only invited people may join.",
          invite_user_ids: [ids.bob],
        },
        requestId,
      );
      await actor("bob");
      const bobData = await snapshot();
      assert.equal(
        bobData.squad_invites.filter(
          (invite: any) => invite.squad_id === created.squad_id,
        ).length,
        1,
      );
      assert.equal(
        bobData.squad_members.some(
          (member: any) => member.squad_id === created.squad_id,
        ),
        false,
      );
    },
  );
  await t.test("remove beacon control fixtures and temporary friendship grants", async () => {
    await root();
    await db.query("delete from public.activities where id=any($1::uuid[])", [controlActivityIds]);
    await db.query("delete from public.squads where id=any($1::uuid[])", [controlSquadIds]);
    await db.query("delete from public.lists where id=any($1::uuid[])", [controlListIds]);
    await db.query("delete from public.friendships where id=any($1::uuid[])", [controlFriendshipIds]);
    await db.query("delete from public.notices where id=any($1::uuid[])", [controlNoticeIds]);
    await db.query(
      "delete from public.notices where actor_id=$1 and recipient_id=any($2::uuid[]) and body='You have a friend request.'",
      [ids.alice, [ids.carol, ids.teen]],
    );
  });
  await t.test(
    "approval protects meeting details and distinguishes Interested from Going",
    async () => {
      await actor("alice");
      activity = String((await makeActivity({ approval_required: true })).id);
      await actor("bob");
      assert.equal(
        (await snapshot()).places.some((place: any) => place.activity_id === activity),
        false,
      );
      await action("rsvp", { id: activity, status: "interested" });
      assert.equal(
        (await snapshot()).rsvps.find((item: any) => item.activity_id === activity)
          .status,
        "interested",
      );
      await action("rsvp", { id: activity, status: "going" });
      assert.equal(
        (await snapshot()).rsvps.find((item: any) => item.activity_id === activity)
          .status,
        "requested",
      );
      await assert.rejects(() =>
        action("approve_rsvp", { id: activity, user_id: ids.bob }),
      );
      await actor("alice");
      await action("approve_rsvp", { id: activity, user_id: ids.bob });
      await actor("bob");
      assert.equal(
        (await snapshot()).places.filter((place: any) => place.activity_id === activity)
          .length,
        1,
      );
      assert.equal(
        (await snapshot()).rsvps.find((item: any) => item.activity_id === activity)
          .status,
        "going",
      );
      await actor("carol");
      assert.equal(
        (await snapshot()).activities.some((item: any) => item.id === activity),
        false,
      );
      await assert.rejects(() =>
        action("comment", { id: activity, body: "Intrusion" }),
      );
    },
  );
  await t.test(
    "beacon modules require approved participants and stay read-only after cancellation",
    async () => {
      await actor("alice");
      const moduleActivity = String(
        (await makeActivity({ approval_required: true })).id,
      );
      const hostItem = await action("add_checklist_item", {
        activity_id: moduleActivity,
        text: "Bring water",
      });
      await action("add_beacon_note", {
        activity_id: moduleActivity,
        body: "Meet near the front entrance.",
      });
      const hostItemId = String(hostItem.id);

      await actor("bob");
      await action("rsvp", { id: moduleActivity, status: "interested" });
      await assert.rejects(() =>
        action("add_beacon_note", {
          activity_id: moduleActivity,
          body: "I should not have access yet.",
        }),
      );
      await action("rsvp", { id: moduleActivity, status: "going" });
      assert.equal(
        (await snapshot()).rsvps.find(
          (item: any) => item.activity_id === moduleActivity,
        ).status,
        "requested",
      );
      await assert.rejects(() =>
        action("add_checklist_item", {
          activity_id: moduleActivity,
          text: "Not approved yet",
        }),
      );
      await assert.rejects(() =>
        db.query(
          "insert into public.beacon_notes(activity_id,author_id,body) values($1,auth.uid(),'Direct write')",
          [moduleActivity],
        ),
      );

      await actor("carol");
      assert.equal(
        (await snapshot()).beacon_checklist_items.some(
          (item: any) => item.activity_id === moduleActivity,
        ),
        false,
      );
      await assert.rejects(() =>
        action("toggle_checklist_item", {
          id: hostItemId,
          completed: true,
        }),
      );
      await assert.rejects(() =>
        action("add_beacon_note", {
          activity_id: moduleActivity,
          body: "A viewer cannot write.",
        }),
      );

      await actor("alice");
      await action("approve_rsvp", { id: moduleActivity, user_id: ids.bob });
      await actor("bob");
      const retry = "77777777-7777-4777-8777-777777777771";
      const bobItem = {
        activity_id: moduleActivity,
        text: "Check with the host",
        id: "77777777-7777-4777-8777-777777777770",
      };
      const first = await action("add_checklist_item", bobItem, retry);
      const again = await action("add_checklist_item", bobItem, retry);
      assert.equal(first.id, again.id);
      assert.equal(
        (await snapshot()).beacon_checklist_items.filter(
          (item: any) => item.id === bobItem.id,
        ).length,
        1,
      );
      const bobNote = await action("add_beacon_note", {
        activity_id: moduleActivity,
        body: "The entrance is on the west side.",
      });
      const bobNoteId = String(bobNote.id);
      await assert.rejects(() =>
        action("add_checklist_item", {
          activity_id: moduleActivity,
          text: " ",
        }),
      );
      await assert.rejects(() =>
        action("add_checklist_item", {
          activity_id: moduleActivity,
          text: "x".repeat(161),
        }),
      );
      await assert.rejects(() =>
        action("add_beacon_note", {
          activity_id: moduleActivity,
          body: "x".repeat(1001),
        }),
      );
      await action("toggle_checklist_item", {
        id: hostItemId,
        completed: true,
      });
      await action("toggle_checklist_item", {
        id: bobItem.id,
        completed: true,
      });
      await action(
        "add_checklist_item",
        bobItem,
        "77777777-7777-4777-8777-777777777772",
      );
      assert.equal(
        (await snapshot()).beacon_checklist_items.find(
          (item: any) => item.id === bobItem.id,
        ).completed,
        true,
      );
      await action("delete_checklist_item", { id: hostItemId });
      assert.equal(
        (await snapshot()).beacon_checklist_items.some(
          (item: any) => item.id === hostItemId,
        ),
        false,
      );
      // Keep Bob's item to verify cancelled Beacons retain checklist history.

      await actor("alice");
      await action("remove_rsvp", {
        id: moduleActivity,
        user_id: ids.bob,
      });
      await actor("bob");
      const afterRemoval = await snapshot();
      assert.equal(
        afterRemoval.beacon_notes.some((item: any) => item.id === bobNoteId),
        true,
        "a private Journal entry remains in its author's library after Beacon access is revoked",
      );
      await assert.rejects(() =>
        action("edit_beacon_note", {
          id: bobNoteId,
          body: "Cannot write to a revoked Beacon.",
          expected_revision: 0,
        }),
      );
      await assert.rejects(() =>
        action("add_beacon_note", {
          activity_id: moduleActivity,
          body: "Access was revoked.",
        }),
      );
      await actor("alice");
      await action("invite_activity", {
        id: moduleActivity,
        user_id: ids.bob,
      });
      await actor("bob");
      await action("rsvp", { id: moduleActivity, status: "going" });

      await actor("alice");
      await action("activity_status", {
        id: moduleActivity,
        status: "completed",
      });
      await actor("bob");
      assert.equal(
        (await snapshot()).beacon_notes.some((item: any) => item.id === bobNoteId),
        true,
      );
      await action("add_beacon_note", {
        activity_id: moduleActivity,
        body: "A memory added after the beacon.",
      });
      await assert.rejects(() =>
        action("add_checklist_item", {
          activity_id: moduleActivity,
          text: "The checklist is closed",
        }),
      );
      await assert.rejects(() =>
        action("toggle_checklist_item", {
          id: hostItemId,
          completed: false,
        }),
      );
      await action("delete_beacon_note", { id: bobNoteId });

      await actor("alice");
      await action("activity_status", {
        id: moduleActivity,
        status: "cancelled",
      });
      await actor("bob");
      assert.equal(
        (await snapshot()).beacon_checklist_items.some(
          (item: any) => item.activity_id === moduleActivity,
        ),
        true,
      );
      await assert.rejects(() =>
        action("add_beacon_note", {
          activity_id: moduleActivity,
          body: "Cancelled beacons are immutable.",
        }),
      );
      const cancelledNote = (await snapshot()).beacon_notes.find(
        (item: any) => item.activity_id === moduleActivity,
      );
      await assert.rejects(() =>
        action("delete_beacon_note", { id: cancelledNote.id }),
      );
    },
  );
  await t.test(
    "beacon module validation and per-beacon item limits are transactional",
    async () => {
      await actor("alice");
      const capActivity = String(
        (await makeActivity({
          mode: "solo",
          audience: "private",
          audience_id: null,
        })).id,
      );
      for (let index = 0; index < 50; index++) {
        await action("add_checklist_item", {
          activity_id: capActivity,
          text: `Item ${index + 1}`,
        });
        await action("add_beacon_note", {
          activity_id: capActivity,
          body: `Note ${index + 1}`,
        });
      }
      await assert.rejects(() =>
        action("add_checklist_item", {
          activity_id: capActivity,
          text: "Item 51",
        }),
      );
      await assert.rejects(() =>
        action("add_beacon_note", {
          activity_id: capActivity,
          body: "Note 51",
        }),
      );
      await root();
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int count from public.beacon_checklist_items where activity_id=$1",
            [capActivity],
          )
        ).rows[0].count,
        50,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int count from public.beacon_notes where activity_id=$1",
            [capActivity],
          )
        ).rows[0].count,
        50,
      );
    },
  );
  await t.test(
    "shared journal edits are revision-safe and private folders never grant beacon access",
    async () => {
      await actor("alice");
      const sharedActivity = String(
        (await makeActivity({
          title: "Shared library beacon",
          mode: "squad",
          audience: "friends",
        })).id,
      );
      const privateActivity = String(
        (await makeActivity({
          title: "Private library beacon",
          mode: "solo",
          audience: "private",
          audience_id: null,
        })).id,
      );
      const emptyActivity = String(
        (await makeActivity({
          title: "Empty journal resource",
          mode: "squad",
          audience: "friends",
        })).id,
      );
      const sharedNote = await action("add_beacon_note", {
        activity_id: sharedActivity,
        body: "Meet at the west entrance.",
        visibility: "shared",
      });
      const sharedNoteId = String(sharedNote.id);
      await action("add_checklist_item", {
        activity_id: sharedActivity,
        text: "Bring water",
      });
      await action("add_beacon_note", {
        activity_id: privateActivity,
        body: "Private note",
      });

      const journalFolderId = "88888888-8888-4888-8888-888888888881",
        checklistFolderId = "88888888-8888-4888-8888-888888888882",
        secondJournalFolderId = "88888888-8888-4888-8888-888888888883";
      const folderPayload = {
        id: journalFolderId,
        kind: "journal",
        name: "Routes",
      };
      const createdFolder = await action(
        "create_library_folder",
        folderPayload,
        "88888888-8888-4888-8888-888888888884",
      );
      const folderRetry = await action(
        "create_library_folder",
        folderPayload,
        "88888888-8888-4888-8888-888888888885",
      );
      assert.equal(createdFolder.id, folderRetry.id);
      await action("create_library_folder", {
        id: checklistFolderId,
        kind: "checklist",
        name: "Packing list",
      });
      await action("create_library_folder", {
        id: secondJournalFolderId,
        kind: "journal",
        name: "Memories",
      });
      await action("move_library_item", {
        kind: "journal",
        activity_id: sharedActivity,
        folder_id: journalFolderId,
      });
      await action("move_library_item", {
        kind: "checklist",
        activity_id: sharedActivity,
        folder_id: checklistFolderId,
      });
      await assert.rejects(() =>
        action("move_library_item", {
          kind: "journal",
          activity_id: sharedActivity,
          folder_id: checklistFolderId,
        }),
      );
      await action("move_library_item", {
        kind: "journal",
        activity_id: sharedActivity,
        folder_id: secondJournalFolderId,
      });
      await action("move_library_item", {
        kind: "journal",
        activity_id: emptyActivity,
        folder_id: journalFolderId,
      });
      assert.equal(
        (await snapshot()).library_folder_items.some(
          (item: any) => item.owner_id === ids.alice && item.kind === "journal" && item.activity_id === emptyActivity,
        ),
        true,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int count from public.beacon_notes where activity_id=$1",
            [emptyActivity],
          )
        ).rows[0].count,
        0,
      );
      let ownSnapshot = await snapshot();
      assert.equal(
        ownSnapshot.library_folder_items.filter(
          (item: any) => item.owner_id === ids.alice && item.kind === "journal" && item.activity_id === sharedActivity,
        ).length,
        1,
      );
      assert.equal(
        ownSnapshot.library_folder_items.find(
          (item: any) => item.owner_id === ids.alice && item.kind === "journal" && item.activity_id === sharedActivity,
        ).folder_id,
        secondJournalFolderId,
      );

      const edited = await action("edit_beacon_note", {
        id: sharedNoteId,
        body: "Meet at the west entrance by the mural.",
        expected_revision: 0,
      });
      assert.equal(edited.revision, 1);
      const editRetry = await action(
        "edit_beacon_note",
        {
          id: sharedNoteId,
          body: "Meet at the west entrance by the mural.",
          expected_revision: 0,
        },
        "88888888-8888-4888-8888-888888888886",
      );
      assert.equal(editRetry.revision, 1);
      await assert.rejects(() =>
        action("edit_beacon_note", {
          id: sharedNoteId,
          body: "A stale edit must not win.",
          expected_revision: 0,
        }),
      );
      ownSnapshot = await snapshot();
      assert.equal(
        ownSnapshot.beacon_notes.find((note: any) => note.id === sharedNoteId).body,
        "Meet at the west entrance by the mural.",
      );

      await actor("bob");
      assert.deepEqual((await snapshot()).library_folders, []);
      await assert.rejects(() =>
        action("move_library_item", {
          kind: "journal",
          activity_id: privateActivity,
          folder_id: "88888888-8888-4888-8888-888888888887",
        }),
      );
      await action("rsvp", { id: sharedActivity, status: "going" });
      const bobVisible = await snapshot();
      assert.equal(
        bobVisible.activities.some((activity: any) => activity.id === sharedActivity),
        true,
      );
      assert.equal(
        bobVisible.beacon_notes.some((note: any) => note.id === sharedNoteId),
        true,
      );
      assert.deepEqual(bobVisible.library_folders, []);
      await assert.rejects(() =>
        action("edit_beacon_note", {
          id: sharedNoteId,
          body: "Only the author edits.",
          expected_revision: 1,
        }),
      );
      const bobFolderId = "88888888-8888-4888-8888-888888888888";
      await action("create_library_folder", {
        id: bobFolderId,
        kind: "journal",
        name: "My notes",
      });
      await action("move_library_item", {
        kind: "journal",
        activity_id: sharedActivity,
        folder_id: bobFolderId,
      });
      const bobSnapshot = await snapshot();
      assert.deepEqual(
        bobSnapshot.library_folders.map((folder: any) => folder.id),
        [bobFolderId],
      );
      assert.equal(
        bobSnapshot.library_folder_items.filter(
          (item: any) => item.kind === "journal" && item.activity_id === sharedActivity,
        ).length,
        1,
      );
      await assert.rejects(() =>
        db.query(
          "insert into public.library_folder_items(owner_id,kind,activity_id,folder_id) values(auth.uid(),'journal',$1,$2)",
          [sharedActivity, bobFolderId],
        ),
      );

      await actor("alice");
      await action("rename_library_folder", {
        id: secondJournalFolderId,
        kind: "journal",
        name: "Memories",
      });
      await assert.rejects(() =>
        action("rename_library_folder", {
          id: bobFolderId,
          kind: "journal",
          name: "Not mine",
        }),
      );
      await action("remove_rsvp", { id: sharedActivity, user_id: ids.bob });
      await actor("bob");
      const afterAccessRevoked = await snapshot();
      assert.equal(
        afterAccessRevoked.activities.some((activity: any) => activity.id === sharedActivity),
        false,
      );
      assert.equal(
        afterAccessRevoked.beacon_notes.some((note: any) => note.id === sharedNoteId),
        false,
      );
      assert.equal(
        afterAccessRevoked.library_folder_items.some(
          (item: any) => item.activity_id === sharedActivity,
        ),
        false,
      );
      await root();
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int count from public.library_folder_items where owner_id=$1 and kind='journal' and activity_id=$2",
            [ids.bob, sharedActivity],
          )
        ).rows[0].count,
        1,
      );
      await actor("alice");
      await action("activity_status", { id: sharedActivity, status: "completed" });
      const completedEdit = await action("edit_beacon_note", {
        id: sharedNoteId,
        body: "Final memory after the beacon.",
        expected_revision: 1,
      });
      assert.equal(completedEdit.revision, 2);
      await action("activity_status", { id: sharedActivity, status: "cancelled" });
      await assert.rejects(() =>
        action("edit_beacon_note", {
          id: sharedNoteId,
          body: "Cancelled means immutable.",
          expected_revision: 2,
        }),
      );
      await action("delete_library_folder", { id: secondJournalFolderId });
      const contentAfterDelete = await snapshot();
      assert.equal(
        contentAfterDelete.beacon_notes.some((note: any) => note.id === sharedNoteId),
        true,
      );
      assert.equal(
        contentAfterDelete.library_folder_items.some(
          (item: any) => item.owner_id === ids.alice && item.kind === "journal" && item.activity_id === sharedActivity,
        ),
        false,
      );
      const duplicateFolderName = await action("create_library_folder", {
        kind: "journal",
        name: "routes",
      });
      assert.equal(duplicateFolderName.id, journalFolderId);
      await assert.rejects(() =>
        action("create_library_folder", {
          kind: "journal",
          name: "x".repeat(41),
        }),
      );
      for (let index = 0; index < 29; index++) {
        await action("create_library_folder", {
          id: `99999999-9999-4999-8999-${String(index).padStart(12, "0")}`,
          kind: "checklist",
          name: `Extra ${index + 1}`,
        });
      }
      await assert.rejects(() =>
        action("create_library_folder", {
          kind: "checklist",
          name: "Folder 31",
        }),
      );
    },
  );
  await t.test(
    "removing an attendee revokes access even if the friend audience still matches",
    async () => {
      await actor("alice");
      await action("remove_rsvp", { id: activity, user_id: ids.bob });
      await actor("bob");
      assert.equal(
        (await snapshot()).activities.some((item: any) => item.id === activity),
        false,
      );
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
  await t.test(
    "status conversion stays owner-only and crew targets persist",
    async () => {
      await actor("alice");
      const id = String(
        (await makeActivity({ mode: "solo", target_count: 4 })).id,
      );
      await assert.rejects(() => makeActivity({ target_count: 1 }));
      await actor("bob");
      await assert.rejects(() => action("open_status", { id }));
      await actor("alice");
      await action("open_status", { id });
      const beacon = (await snapshot()).activities.find(
        (a: any) => a.id === id,
      );
      assert.equal(beacon.mode, "squad");
      assert.equal(beacon.target_count, 4);
      await actor("bob");
      await action("rsvp", { id, status: "going" });
      assert.equal(
        (await snapshot()).rsvps.find((r: any) => r.activity_id === id).status,
        "going",
      );
      await action("rsvp", { id, status: "interested" });
      await action("rsvp", { id, status: "withdraw" });
      assert.equal(
        (await snapshot()).rsvps.some((r: any) => r.activity_id === id),
        false,
      );
    },
  );
  let squad: string;
  await t.test(
    "squad membership requires an invitation and revocation removes shared access",
    async () => {
      await actor("alice");
      squad = String(
        (await action("create_squad", { name: "Training" })).squad_id,
      );
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

  await t.test(
    "peer blocks preserve third-party invitations while owner blocks revoke them",
    async () => {
      await actor("carol");
      await action("friend_request", { username: "bob" });
      await actor("bob");
      const friendshipId = String((await snapshot()).friendships.find(
        (item: any) => item.sender_id === ids.carol && item.recipient_id === ids.bob,
      )?.id);
      await action("accept_friend", { id: friendshipId });
      await actor("carol");
      const privateBeacon = String((await makeActivity({ audience: "private" })).activity_id);
      await action("invite_activity", { id: privateBeacon, user_id: ids.bob });
      await actor("teen");
      await action("block", { id: ids.bob });
      await actor("bob");
      assert.equal((await snapshot()).activities.some((item: any) => item.id === privateBeacon), true);
      await actor("carol");
      await action("block", { id: ids.bob });
      await actor("bob");
      assert.equal((await snapshot()).activities.some((item: any) => item.id === privateBeacon), false);
      await root();
      await db.query("delete from public.blocks where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)", [ids.teen, ids.bob]);
      await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [ids.carol, ids.bob]);
      await db.query("delete from public.activities where id=$1", [privateBeacon]);
      await db.query("delete from public.friendships where id=$1", [friendshipId]);
      await db.query("delete from public.notices where actor_id=any($1::uuid[]) and recipient_id=any($2::uuid[])", [
        [ids.carol, ids.bob],
        [ids.carol, ids.bob],
      ]);
    },
  );

  await db.close();
});
