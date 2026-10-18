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
test("smart RSVP preserves resolved invitations, legacy reads, capacity and privacy", async () => {
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
  for (const person of [ids.invitee, ids.member, ids.stranger])
    await db.query(
      "insert into public.friendships(id,sender_id,recipient_id,status) values(gen_random_uuid(),$1,$2,'accepted')",
      [ids.owner, person],
    );
  const invited = crypto.randomUUID(),
    open = crypto.randomUUID();
  for (const [id, approval] of [
    [invited, true],
    [open, false],
  ])
    await db.query(
      "insert into public.activities(id,owner_id,title,description,category,mode,starts_at,ends_at,audience,timezone,approval_required,capacity_limit,capacity_policy) values($1,$2,'Smart RSVP','Test','Study','squad',now()+interval '1 hour',now()+interval '2 hours','friends','UTC',$3,2,'strict')",
      [id, ids.owner, approval],
    );
  await actor("owner");
  await action("invite_activity", { id: invited, user_id: ids.invitee });
  await actor("invitee");
  const declineId = crypto.randomUUID();
  await action("rsvp", { id: invited, status: "declined" }, declineId);
  await action("rsvp", { id: invited, status: "declined" }, declineId);
  let snap = (
    await db.query<{ result: any }>("select public.beacon_snapshot() result")
  ).rows[0].result;
  assert.equal(snap.capabilities.rsvp_decline, true);
  assert.ok(!snap.rsvps.some((r: any) => r.activity_id === invited));
  assert.equal(
    snap.resolved_beacon_responses.find((r: any) => r.activity_id === invited)
      .status,
    "declined",
  );
  assert.ok(snap.activities.some((r: any) => r.id === invited));
  await action("rsvp", { id: invited, status: "withdraw" });
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.rsvps where activity_id=$1",
        [invited],
      )
    ).rows[0].status,
    "declined",
  );
  await actor("member");
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.rsvps where activity_id=$1 and status='declined'",
        [invited],
      )
    ).rows[0].n,
    0,
  );
  snap = (
    await db.query<{ result: any }>("select public.beacon_snapshot() result")
  ).rows[0].result;
  assert.equal(snap.resolved_beacon_responses.length, 0);
  await actor("owner");
  await action("invite_activity", { id: invited, user_id: ids.invitee });
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.rsvps where activity_id=$1",
        [invited],
      )
    ).rows[0].status,
    "declined",
  );
  await action("invite_activity", {
    id: invited,
    user_id: ids.invitee,
    reinvite: true,
  });
  await actor("invitee");
  await action("rsvp", { id: invited, status: "interested" });
  await action("rsvp", { id: invited, status: "declined" });
  await action("rsvp", { id: invited, status: "going" });
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select private.beacon_seat_count($1)::int n",
        [invited],
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.beacon_attendance where activity_id=$1",
        [invited],
      )
    ).rows[0].n,
    0,
  );
  await action("rsvp", { id: invited, status: "withdraw", intent: "leave" });
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.rsvps where activity_id=$1",
        [invited],
      )
    ).rows[0].status,
    "declined",
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select private.beacon_seat_count($1)::int n",
        [invited],
      )
    ).rows[0].n,
    1,
  );
  await action("rsvp", { id: open, status: "interested" });
  await assert.rejects(
    () => action("rsvp", { id: open, status: "declined" }),
    /invitation/i,
  );
  await action("rsvp", {
    id: open,
    status: "withdraw",
    intent: "remove_maybe",
  });
  await action("rsvp", { id: open, status: "going" });
  await actor("member");
  await assert.rejects(
    () => action("rsvp", { id: open, status: "going" }),
    /full/i,
  );
  await actor("invitee");
  await action("rsvp", { id: open, status: "withdraw", intent: "leave" });
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.rsvps where activity_id=$1 and user_id=$2",
        [open, ids.invitee],
      )
    ).rows[0].n,
    0,
  );
  await actor("member");
  await action("rsvp", { id: open, status: "going" });
  await actor("stranger");
  await action("rsvp", { id: invited, status: "going" });
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.rsvps where activity_id=$1 and user_id=$2",
        [invited, ids.stranger],
      )
    ).rows[0].status,
    "requested",
  );
  await action("rsvp", {
    id: invited,
    status: "withdraw",
    intent: "cancel_request",
  });
  await assert.rejects(
    () => action("rsvp", { id: invited, status: "withdraw", intent: "leave" }),
    /response changed/i,
  );
  await db.close();
});
