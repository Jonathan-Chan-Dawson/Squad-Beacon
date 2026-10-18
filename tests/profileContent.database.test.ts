import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  owner: "a1111111-1111-4111-8111-111111111111",
  member: "b2222222-2222-4222-8222-222222222222",
  stranger: "c3333333-3333-4333-8333-333333333333",
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

test("profile RPC preserves author, participation, media and profile permissions across pagination", async () => {
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
      "insert into public.profiles(id,username,name,profile_visibility) values($1,$2,$2,'friends')",
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
  const activityIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = crypto.randomUUID();
    activityIds.push(id);
    await db.query(
      `insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,timezone,status,audience,enable_experiences)
      values($1,$2,$3,'Study','squad',now()-interval '2 hours',now()-interval '1 hour','UTC','completed','friends',true)`,
      [id, ids.owner, "Experience " + i],
    );
  }
  const album = activityIds[0];
  await db.query(
    "insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,'going',true)",
    [album, ids.member],
  );
  for (const [author, type, name] of [
    [ids.owner, "image", "one"],
    [ids.owner, "image", "two"],
    [ids.member, "image", "other"],
    [ids.owner, "video", "clip"],
  ]) {
    await db.query(
      `insert into public.beacon_memories(activity_id,author_id,object_path,media_type,duration_seconds)
      values($1::uuid,$2::uuid,$1::uuid::text||'/'||$2::uuid::text||'/'||$3,$4,case when $4='video' then 10 end)`,
      [album, author, name + ".jpg", type],
    );
  }
  await actor("member");
  const callProfile = async (
    filter = "all",
    cursor: string | null = null,
    target = ids.owner,
  ) =>
    (
      await db.query<{ result: Record<string, any> }>(
        "select public.profile_content_page($1,$2,null,$3,2) result",
        [target, filter, cursor],
      )
    ).rows[0].result;
  const first = await callProfile();
  const second = await callProfile("all", first.nextCursor);
  assert.equal(first.beaconCount, 4);
  assert.equal(first.rows.length, 2);
  assert.equal(second.rows.length, 2);
  assert.equal(
    new Set([...first.rows, ...second.rows].map((r) => r.id)).size,
    4,
  );
  const albums = await callProfile("albums");
  assert.equal(albums.rows.length, 1);
  assert.equal(albums.rows[0].photoCount, 2);
  assert.equal(albums.rows[0].videoCount, 1);
  assert.equal(
    (await callProfile("past", null, ids.member)).rows[0].role,
    "attendee",
  );
  await assert.rejects(callProfile("albums", "bad"), /cursor is invalid/i);
  await root();
  await db.query("update public.profiles set hide_featured=true where id=$1", [
    ids.owner,
  ]);
  await actor("member");
  const profiles = (
    await db.query<{ p: { profiles: Record<string, any>[] } }>(
      "select private.profile_snapshot_data() p",
    )
  ).rows[0].p.profiles;
  assert.equal(
    profiles.find((p) => p.id === ids.owner)?.viewer_profile_feature_hidden,
    true,
  );
  await root();
  await db.query(
    "update public.profiles set profile_visibility='custom' where id=$1",
    [ids.owner],
  );
  await actor("member");
  assert.equal((await callProfile("albums")).rows.length, 0);
  await root();
  await db.query(
    "update public.profiles set profile_visibility='friends' where id=$1",
    [ids.owner],
  );
  await db.query(
    "delete from public.rsvps where activity_id=$1 and user_id=$2",
    [album, ids.member],
  );
  await actor("member");
  assert.equal(
    (await callProfile("past")).rows.length,
    2,
    "readable hosted experiences do not require viewer attendance",
  );
  assert.equal(
    (await callProfile("albums")).rows.length,
    0,
    "media requires participant access",
  );
  await root();
  await db.query(
    "insert into public.blocks(blocker_id,blocked_id) values($1,$2)",
    [ids.owner, ids.member],
  );
  await actor("member");
  assert.equal((await callProfile()).beaconCount, 0);
  await db.exec("reset role; set role anon;");
  await assert.rejects(callProfile(), /permission denied/i);
  await actor("member");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(callProfile(), /sign in/i);
  await root();
  await db.close();
});
