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
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[name]]);
}
async function root() { await db.exec("reset role"); }
async function action(name: string, payload: Record<string, unknown> = {}, requestId = crypto.randomUUID()) {
  return (await db.query<{ result: Record<string, any> }>(
    "select public.beacon_action($1,$2::jsonb,$3::uuid) result",
    [name, JSON.stringify(payload), requestId],
  )).rows[0].result;
}
async function migration(name: string) {
  const sql = readFileSync(new URL("../supabase/migrations/" + name, import.meta.url), "utf8")
    .replace("create extension if not exists pgcrypto;", "");
  try { await db.exec(sql); }
  catch (error) { throw new Error(`Migration ${name}: ${(error as Error).message}`); }
}
import { STATUS_REACTIONS } from "../src/features/beacons/statusReactions";
test("status emoji full migration chain preserves permission gates and request idempotency", async () => {
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
  for (const file of readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((file) => file.endsWith(".sql")).sort()) await migration(file);

  await root();
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query("insert into public.profiles(id,username,name) values($1,$2,$2)", [id, name]);
  }
  await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')", [ids.owner, ids.member]);
  const statusId = crypto.randomUUID();
  await db.query("insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,audience,timezone) values($1,$2,'Current status','Social','solo',now()-interval '5 minutes',now()+interval '1 hour','friends','UTC')", [statusId, ids.owner]);
  const before = (await db.query("select count(*)::int n from public.activities")).rows[0].n;
  await actor("member");
  await action("react", { id: statusId });
  const emoji = async () => (await db.query<{emoji: string}>("select emoji from public.reactions where activity_id=$1 and user_id=$2", [statusId, ids.member])).rows[0]?.emoji;
  assert.equal(await emoji(), "🙌");
  for (const item of STATUS_REACTIONS) { await action("react_status", { id: statusId, emoji: item.emoji }); assert.equal(await emoji(), item.emoji); }
  const request = crypto.randomUUID();
  await action("react", { id: statusId, emoji: "❤️" }, request);
  await action("react", { id: statusId, emoji: "🔥" }, request);
  assert.equal(await emoji(), "❤️", "same request cannot replace twice");
  await assert.rejects(action("react_status", { id: statusId, emoji: "💩" }), /supported status reaction/i);
  assert.equal(await emoji(), "❤️");
  await assert.rejects(db.query("insert into public.reactions(activity_id,user_id,emoji) values($1,$2,'👍')", [statusId, ids.member]), /permission denied/i);
  await action("react", { id: statusId, remove: true });
  assert.equal(await emoji(), undefined);
  await action("react", { id: statusId, remove: true });
  assert.equal((await db.query("select count(*)::int n from public.rsvps where activity_id=$1", [statusId])).rows[0].n, 0);
  await actor("stranger");
  await assert.rejects(action("react_status", { id: statusId, emoji: "👍" }), /unavailable/i);
  await root(); await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.owner, ids.member]);
  await actor("member"); await assert.rejects(action("react_status", { id: statusId }), /unavailable/i);
  await root(); await db.query("delete from public.blocks");
  await db.query("update public.activities set enable_reactions=false where id=$1", [statusId]);
  await actor("member"); await assert.rejects(action("react_status", { id: statusId }), /unavailable/i);
  await root(); await db.query("update public.activities set enable_reactions=true,starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1", [statusId]);
  await actor("member"); await assert.rejects(action("react_status", { id: statusId }), /unavailable/i);
  await root(); await db.query("update public.activities set starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hours' where id=$1", [statusId]);
  await actor("member"); await assert.rejects(action("react_status", { id: statusId }), /unavailable/i);
  await root(); await db.query("update public.activities set status='cancelled',starts_at=now()-interval '5 minutes',ends_at=now()+interval '1 hour' where id=$1", [statusId]);
  await actor("member"); await assert.rejects(action("react_status", { id: statusId }), /unavailable/i);
  await root(); await db.query("update public.activities set starts_at=now()-interval '5 minutes',ends_at=now()+interval '1 hour',mode='invite',status='scheduled' where id=$1", [statusId]);
  await actor("owner"); await assert.rejects(action("react_status", { id: statusId }), /solo status/i); await action("react", { id: statusId, emoji: "🔥" });
  assert.equal((await db.query("select emoji from public.reactions where activity_id=$1 and user_id=$2", [statusId, ids.owner])).rows[0].emoji, "🙌", "ordinary Beacon dispatch ignores emoji");
  assert.equal((await db.query("select count(*)::int n from public.activities")).rows[0].n, before);
  await db.close();
});
