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
test("bounded Routine RPC preserves private visibility and skipped/materialized linkage without writes", async () => {
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
  }
  const squad=crypto.randomUUID(), plan=crypto.randomUUID(), personal=crypto.randomUUID(), routine=crypto.randomUUID(), privateRoutine=crypto.randomUUID();
  await db.query("insert into public.squads(id,owner_id,name) values($1,$2,'Calendar crew')",[squad,ids.owner]);
  await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')",[squad,ids.owner,ids.member]);
  const startOn=new Date(Date.now()+86400000).toISOString().slice(0,10), endOn=new Date(Date.now()+42*86400000).toISOString().slice(0,10);
  await db.query("insert into public.plans(id,owner_id,squad_id,title,description,timezone,start_date) values($1,$2,$3,'Crew Routine','','America/New_York',$4),($5,$2,null,'Private Routine','','UTC',$4)",[plan,ids.owner,squad,startOn,personal]);
  const next=(await db.query("select private.next_plan_routine_date($1::date,array[1,3,5]::smallint[],2,$1::date-1,null)::text next",[startOn])).rows[0].next;
  for (const [id,pid] of [[routine,plan],[privateRoutine,personal]]) await db.query("insert into public.plan_routines(id,plan_id,owner_id,weekdays,interval_weeks,anchor_date,next_occurrence_on) values($1,$2,$3,array[1,3,5]::smallint[],2,$4,$5)",[id,pid,ids.owner,startOn,next]);
  await db.query("insert into public.plan_members(plan_id,user_id) values($1,$2),($3,$2)",[plan,ids.member,personal]);
  const before=(await db.query("select count(*)::int n from public.activities")).rows[0].n;
  const call=async (start=startOn,end=endOn)=>(await db.query<{result:any}>("select public.calendar_routine_occurrences($1::date,$2::date) result",[start,end])).rows[0].result;
  await actor("member");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(call(),/Sign in/i);
  await actor("member");
  let result=await call();
  assert.equal(result.viewer_id,ids.member); assert.equal(result.truncated,false);
  assert.ok(result.rows.length>3,"full visible-range dates, not just next occurrence");
  assert.ok(result.rows.every((row:any)=>row.routine_id===routine),"Plan-member row alone never grants private personal Routine visibility");
  assert.deepEqual(Object.keys(result.rows[0]).sort(),['occurrence_on','plan_id','routine_id','state']);
  const dates=result.rows.map((row:any)=>row.occurrence_on);
  const anchorMonday=Date.parse(startOn)-(new Date(startOn+"T00:00:00Z").getUTCDay()+6)%7*86400000;
  for (const date of dates) assert.equal(Math.floor((Date.parse(date)-anchorMonday)/86400000/7)%2,0,"anchored alternate weeks remain unchanged");
  for (const date of dates) assert.ok([1,3,5].includes(new Date(date+'T00:00:00Z').getUTCDay()||7));
  assert.equal(dates.some((date:string)=>new Date(date+'T00:00:00Z').getUTCDay()===2),false);
  const child=crypto.randomUUID(), hidden=crypto.randomUUID(), cancelled=crypto.randomUUID();
  await root();
  await db.query("insert into public.plans(id,owner_id,squad_id,title,description,timezone,start_date,status) values($1,$2,$3,'Published child','','America/New_York',$4,'scheduled'),($5,$6,null,'Hidden child','','UTC',$7,'scheduled'),($8,$2,$3,'Cancelled child','','UTC',$9,'cancelled')",[child,ids.owner,squad,dates[1],hidden,ids.stranger,dates[2],cancelled,dates[3]]);
  await db.query("insert into private.plan_routine_occurrences(routine_id,occurrence_on,status,occurrence_plan_id) values($1,$2,'skipped',null),($1,$3,'created',$4),($1,$5,'created',$6),($1,$7,'created',$8)",[routine,dates[0],dates[1],child,dates[2],hidden,dates[3],cancelled]);
  await actor("member"); result=await call();
  assert.ok(!result.rows.some((row:any)=>[dates[0],dates[2],dates[3]].includes(row.occurrence_on)));
  assert.deepEqual(result.rows.find((row:any)=>row.occurrence_on===dates[1]),{routine_id:routine,plan_id:plan,occurrence_on:dates[1],state:'materialized',occurrence_plan_id:child});
  assert.ok(!JSON.stringify(result).includes(hidden));
  await assert.rejects(call(endOn,startOn),/1 to 62 days/);
  await assert.rejects(call(startOn,new Date(Date.parse(startOn)+62*86400000).toISOString().slice(0,10)),/1 to 62 days/);
  await root(); await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')",[ids.owner,ids.stranger]);
  await actor("stranger"); assert.deepEqual((await call()).rows,[],"friendship alone does not reveal private Routine schedules");
  await root(); await db.query("delete from public.friendships");
  await actor("stranger"); assert.deepEqual((await call()).rows,[]);
  await root(); await db.exec("set role anon"); await assert.rejects(call(),/permission denied/);
  await root(); await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)",[ids.member,ids.owner]);
  await actor("member"); assert.deepEqual((await call()).rows,[]);
  await root(); await db.query("delete from public.blocks"); await db.query("delete from public.squad_members where squad_id=$1 and user_id=$2",[squad,ids.member]);
  await actor("member"); assert.deepEqual((await call()).rows,[]);
  await root(); await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'member')",[squad,ids.member]); await db.query("delete from public.plan_members where plan_id=$1 and user_id=$2",[plan,ids.member]);
  await actor("member"); assert.deepEqual((await call()).rows,[]);
  await root(); await db.query("update public.plan_routines set status='paused' where id=$1",[routine]);
  await actor("owner"); assert.ok(!(await call()).rows.some((row:any)=>row.routine_id===routine));
  await root(); await db.query("update public.plan_routines set status='active',run_mode='manual' where id=$1",[routine]);
  await actor("owner"); assert.ok(!(await call()).rows.some((row:any)=>row.routine_id===routine));
  await root(); assert.equal((await db.query("select count(*)::int n from public.activities")).rows[0].n,before,"projection never creates activity records");
  assert.equal((await db.query("select count(*)::int n from private.plan_routine_occurrences")).rows[0].n,4,"projection never records future occurrences");
  await db.query("update public.plan_routines set status='ended',run_mode='scheduled' where id=$1",[routine]);
  await actor("owner"); assert.ok(!(await call()).rows.some((row:any)=>row.routine_id===routine));
  await root(); await db.query("update public.plan_routines set status='active' where id=$1",[routine]); await db.query("update public.plans set status='cancelled' where id=$1",[plan]);
  await actor("owner"); assert.ok(!(await call()).rows.some((row:any)=>row.routine_id===routine));
  await root(); await db.query("update public.plans set status='scheduled' where id=$1",[plan]);
  for(let index=0;index<12;index++) await db.query("insert into public.plan_routines(plan_id,owner_id,weekdays,interval_weeks,anchor_date,next_occurrence_on) values($1,$2,array[1,2,3,4,5,6,7]::smallint[],1,$3,$3)",[plan,ids.owner,startOn]);
  await actor("owner");
  const bounded=await call(startOn,new Date(Date.parse(startOn)+61*86400000).toISOString().slice(0,10));
  assert.equal(bounded.rows.length,500); assert.equal(bounded.truncated,true); assert.equal(bounded.limit,500);
  await db.close();
});
