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
test("atomic creation/invitations commit once and roll back all writes on eligibility or quota failures",async()=>{
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
  for (const [name,id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())",[id]);
    await db.query("insert into public.profiles(id,username,name) values($1,$2,$2)",[id,name]);
    await db.query("insert into private.accounts(id,birth_date) values($1,'1990-01-01')",[id]);
  }
  for(const friend of [ids.admin,ids.member,ids.invitee]) await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')",[ids.owner,friend]);
  const payload={title:'Atomic Beacon',description:'Draft details',category:'Social',mode:'squad',starts_at:new Date(Date.now()+3*3600000).toISOString(),ends_at:new Date(Date.now()+4*3600000).toISOString(),timezone:'UTC',audience:'friends',audience_id:null,invitee_ids:[ids.admin,ids.member]};
  const count=async()=>{await root(); return (await db.query("select (select count(*)::int from public.activities) activities,(select count(*)::int from public.notices) notices,(select count(*)::int from public.rsvps) rsvps,(select count(*)::int from public.beacon_invitation_grants) grants")).rows[0];};
  const before=await count();
  await actor('owner');
  await assert.rejects(action('create_activity_with_invitees',{...payload,expected_actor_id:ids.member}),/account changed/);
  assert.deepEqual(await count(),before,"wrong token actor cannot commit a frozen draft");
  await actor('owner');
  await assert.rejects(action('create_activity_with_invitees',{...payload,invitee_ids:[ids.member,ids.stranger]}),/eligible/);
  assert.deepEqual(await count(),before);
  await actor('owner'); await assert.rejects(action('create_activity_with_invitees',{...payload,mode:'solo'}),/shared Beacon/);
  await assert.rejects(action('create_activity_with_invitees',{...payload,invitee_ids:[ids.member,ids.member]}),/only once/);
  await assert.rejects(action('create_activity_with_invitees',{...payload,invitee_ids:[ids.admin,ids.admin.toUpperCase()]}),/only once/);
  await assert.rejects(action('create_activity_with_invitees',{...payload,invitee_ids:Array(21).fill(ids.admin)}),/1 to 20/);
  await assert.rejects(action('create_activity_with_invitees',{...payload,invitee_ids:[]}),/1 to 20/);
  await assert.rejects(action('create_activity_with_invitees',{...payload,invitee_ids:[null]}),/valid selected/);
  await root(); await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)",[ids.member,ids.owner]);
  await actor('owner'); await assert.rejects(action('create_activity_with_invitees',payload),/eligible/);
  assert.deepEqual(await count(),before);
  await db.exec('delete from public.blocks');
  await db.query("insert into private.action_limits(user_id,bucket,kind,count) values($1,date_trunc('hour',now()),'invitations',19)",[ids.owner]);
  const rejected=crypto.randomUUID();
  await actor('owner'); await assert.rejects(action('create_activity_with_invitees',payload,rejected),/Too many requests/);
  assert.deepEqual(await count(),before,"failure after first invitation rolls back Beacon, recipients, grants and notices");
  assert.equal((await db.query("select count from private.action_limits where user_id=$1 and kind='invitations'",[ids.owner])).rows[0].count,19);
  assert.equal((await db.query("select count(*)::int n from private.requests where request_id=$1",[rejected])).rows[0].n,0);
  await db.exec("delete from private.action_limits where kind='invitations'");
  const request=crypto.randomUUID(); await actor('owner');
  const created=await action('create_activity_with_invitees',payload,request);
  assert.equal(created.committed,true); assert.equal(created.event,'create_activity_with_invitees'); assert.deepEqual(created.invited_ids,payload.invitee_ids);
  const saved=await count(); assert.equal(saved.activities,before.activities+1); assert.equal(saved.notices,before.notices+2);
  const selected=(await db.query("select user_id,status,approved from public.rsvps where activity_id=$1 and user_id=any($2::uuid[]) order by user_id",[created.id,payload.invitee_ids])).rows;
  assert.equal(selected.length,2); assert.ok(selected.every((row)=>row.status==='invited' && row.approved===true));
  await db.query("update public.rsvps set status='going' where activity_id=$1 and user_id=$2",[created.id,ids.admin]);
  await actor('owner'); assert.deepEqual(await action('create_activity_with_invitees',{...payload,title:'Must not recreate'},request),created);
  assert.deepEqual(await count(),saved,"same UUID does not create again or duplicate notices");
  assert.equal((await db.query("select status from public.rsvps where activity_id=$1 and user_id=$2",[created.id,ids.admin])).rows[0].status,'going');
  const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
  await actor('owner');
  const plan=await action('create_plan',{title:'Private Plan',description:'',timezone:'UTC',start_date:date,steps:[{title:'First',description:'',category:'Social',day_offset:0,start_time:'18:00',duration_minutes:60,location_name:'',lat:null,lng:null,aspiration_ids:[]}]});
  const planPayload={...payload,plan_id:plan.id,position:1,audience:'private',starts_at:date+'T20:00:00Z',ends_at:date+'T21:00:00Z',invitee_ids:[ids.invitee]};
  await root(); await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')",[ids.member,ids.invitee]);
  await actor('member'); await assert.rejects(action('create_plan_beacon_with_invitees',planPayload),/Plan unavailable/);
  await actor('owner'); await assert.rejects(action('create_plan_beacon_with_invitees',{...planPayload,audience:'friends'}),/Plan audience/);
  const linked=await action('create_plan_beacon_with_invitees',planPayload);
  assert.equal(linked.plan_id,plan.id); assert.equal(linked.committed,true);
  assert.equal((await db.query("select status from public.rsvps where activity_id=$1 and user_id=$2",[linked.id,ids.invitee])).rows[0].status,'invited');
  await root(); await db.exec("set role anon"); await assert.rejects(action('create_activity_with_invitees',payload),/permission denied/);
  await actor('owner'); await db.query("select set_config('request.jwt.claim.sub','',false)"); await assert.rejects(action('create_activity_with_invitees',payload),/Sign in/);
  await db.close();
});
