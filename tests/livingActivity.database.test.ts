import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  owner: "a1111111-1111-4111-8111-111111111111",
  admin: "b2222222-2222-4222-8222-222222222222",
  member: "c3333333-3333-4333-8333-333333333333",
  invitee: "d4444444-4444-4444-8444-444444444444",
  stranger: "e5555555-5555-4555-8555-555555555555",
};
const db = new PGlite();

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
  requestId = crypto.randomUUID(),
) {
  return (
    await db.query<{ result: Record<string, any> }>(
      "select public.beacon_action($1,$2::jsonb,$3::uuid) result",
      [name, JSON.stringify(payload), requestId],
    )
  ).rows[0].result;
}
async function migration(name: string) {
  const sql = readFileSync(
    new URL("../supabase/migrations/" + name, import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(sql);
  } catch (error) {
    throw new Error(`Migration ${name}: ${(error as Error).message}`);
  }
}
test("living activity isolation, replay, authorization, pause and takeover", async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb not null default '{}'::jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql as $$
      select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]
    $$;
    create publication supabase_realtime;
  `);
  for (const file of readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  )
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await migration(file);

  await root();
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query(
      "insert into public.profiles(id,username,name) values($1,$2,$2)",
      [id, name],
    );
    await db.query(
      "insert into private.accounts(id,birth_date) values($1,'1990-01-01')",
      [id],
    );
  }
  await db.query(
    "insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')",
    [ids.owner, ids.member],
  );
  await actor("owner");
  const status = await action("save_status_note", {
    title: "Personal message",
    available: true,
  });
  const payload = {
    title: "Shooting hoops",
    category: "Fitness",
    description: "Practicing",
    audience: "friends",
    audience_id: null,
    timezone: "UTC",
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    label: "Campus Courts",
  };
  const req = crypto.randomUUID();
  const note = await action("save_activity_note", payload, req);
  assert.deepEqual(await action("save_activity_note", payload, req), note);
  assert.ok(note.id);
  await assert.rejects(action("save_activity_note", payload), /Edit or end/);
  const edited = await action("save_activity_note", {
    ...payload,
    id: note.id,
    title: "Practice",
  });
  assert.equal(edited.id, note.id);
  await action("update_presence", { availability: null });
  assert.equal(
    (
      await db.query("select title from public.activities where id=$1", [
        status.id,
      ])
    ).rows[0].title,
    "Personal message",
  );
  await action("clear_status_notes");
  assert.equal(
    (
      await db.query("select status from public.activities where id=$1", [
        note.id,
      ])
    ).rows[0].status,
    "scheduled",
  );
  await actor("member");
  await assert.rejects(
    action("save_activity_note", { ...payload, id: note.id }),
    /ended/,
  );
  let snap = (await db.query<any>("select public.beacon_snapshot() data"))
    .rows[0].data;
  assert.ok(snap.activities.some((a: any) => a.id === note.id));
  assert.equal(
    snap.presence.find((p: any) => p.owner_id === ids.owner).current_activity
      .id,
    note.id,
  );
  await actor("owner");
  await action("update_presence", { sharing: false });
  await actor("member");
  snap = (await db.query<any>("select public.beacon_snapshot() data")).rows[0]
    .data;
  assert.ok(
    !snap.activities.some((a: any) => a.id === note.id),
    "pause hides the note at RLS boundary",
  );
  assert.equal(
    snap.presence.find((p: any) => p.owner_id === ids.owner).current_activity,
    null,
  );
  await actor("owner");
  await action("update_presence", { sharing: true });
  const live = await action("create_activity", {
    ...payload,
    mode: "squad",
    starts_at: new Date(Date.now() - 60000).toISOString(),
    approval_required: false,
    target_count: null,
  });
  await action("update_presence", {
    show_current_beacon: true,
    current_beacon_id: live.id,
  });
  assert.equal(
    (
      await db.query("select status from public.activities where id=$1", [
        note.id,
      ])
    ).rows[0].status,
    "completed",
  );
  await action("update_presence", { show_current_beacon: false });
  snap = (await db.query<any>("select public.beacon_snapshot() data")).rows[0]
    .data;
  assert.equal(
    snap.presence.find((p: any) => p.owner_id === ids.owner).current_activity,
    null,
    "superseded note never returns",
  );

  // An existing explicit Auto preference only takes over when the Beacon becomes live.
  await root();
  await db.query(
    "update public.activities set status='completed' where id=$1",
    [live.id],
  );
  await actor("owner");
  await action("update_presence", {
    show_current_beacon: true,
    current_beacon_id: null,
  });
  const future = await action("create_activity", {
    ...payload,
    mode: "squad",
    starts_at: new Date(Date.now() + 600000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    approval_required: false,
    target_count: null,
  });
  const solo = await action("save_activity_note", {
    ...payload,
    title: "Still practicing",
  });
  await actor("member");
  snap = (await db.query<any>("select public.beacon_snapshot() data")).rows[0]
    .data;
  assert.equal(
    snap.presence.find((p: any) => p.owner_id === ids.owner).current_activity
      .id,
    solo.id,
  );
  await root();
  await db.query(
    "update public.activities set starts_at=now()-interval '1 minute' where id=$1",
    [future.id],
  );
  await actor("member");
  snap = (await db.query<any>("select public.beacon_snapshot() data")).rows[0]
    .data;
  assert.equal(
    snap.presence.find((p: any) => p.owner_id === ids.owner).current_activity
      .id,
    future.id,
  );
  assert.ok(
    !snap.activities.some((a: any) => a.id === solo.id),
    "raw reads suppress the note before owner reconciliation",
  );
  assert.ok(
    !Object.hasOwn(
      snap.presence.find((p: any) => p.owner_id === ids.owner),
      "current_beacon_id",
    ),
    "owner preferences stay private",
  );
  await actor("owner");
  await action("reconcile_current_activity");
  assert.equal(
    (
      await db.query("select status from public.activities where id=$1", [
        solo.id,
      ])
    ).rows[0].status,
    "completed",
  );
  await action("update_presence", { show_current_beacon: false });
  const race = await Promise.allSettled([
    action("save_activity_note", payload),
    action("save_activity_note", payload),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  const history = (
    await db.query<any>(
      "select public.activity_history_page(null,null,20) data",
    )
  ).rows[0].data;
  assert.ok(
    history.rows.some((r: any) => r.id === solo.id),
    "the owner retains Activity Note history",
  );
  await actor("member");
  const foreignHistory = (
    await db.query<any>(
      "select public.activity_history_page(null,null,20) data",
    )
  ).rows[0].data;
  assert.ok(!foreignHistory.rows.some((r: any) => r.id === solo.id));
  await assert.rejects(db.query("select * from private.presence_config"));
  await db.close();
});
