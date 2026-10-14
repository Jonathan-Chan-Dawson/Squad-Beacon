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
test("atomic own status save/clear preserve history, scope, rollback and request replay", async () => {
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
  const current=crypto.randomUUID(), older=crypto.randomUUID(), future=crypto.randomUUID(), foreign=crypto.randomUUID(), group=crypto.randomUUID();
  for (const [id,owner,mode,start] of [[current,ids.owner,'solo',-5],[older,ids.owner,'solo',-10],[future,ids.owner,'solo',60],[foreign,ids.member,'solo',-5],[group,ids.owner,'invite',-5]]) {
    await db.query("insert into public.activities(id,owner_id,title,description,category,mode,starts_at,ends_at,audience,timezone,available,enable_reactions) values($1,$2,'Study note','Book practice','Study',$3,now()+$4::int*interval '1 minute',now()+interval '2 hours','friends','UTC',true,false)",[id,owner,mode,start]);
  }
  await actor("owner");
  await assert.rejects(action("save_status_note",{source_id:foreign,title:'wrong'}),/your own status/i);
  await assert.rejects(action("save_status_note",{source_id:group,title:'wrong'}),/your own status/i);
  await assert.rejects(action("save_status_note",{title:'',source_id:current}),/title|characters/i);
  await assert.rejects(action("save_status_note",{source_id:current,audience:'list',audience_id:crypto.randomUUID()}),/audience|list|access|share/i);
  await root();
  await db.exec("create function public.reject_status_cancel() returns trigger language plpgsql as $$begin if new.status='cancelled' and old.title='Study note' then raise exception 'Injected cancellation failure'; end if; return new; end$$; create trigger reject_status_cancel before update on public.activities for each row execute function public.reject_status_cancel();");
  const sourceExpiry=(await db.query("select ends_at from public.activities where id=$1",[current])).rows[0].ends_at;
  const before=(await db.query("select count(*)::int n from public.activities")).rows[0].n;
  const request=crypto.randomUUID();
  await actor("owner");
  await assert.rejects(action("save_status_note",{source_id:current,available:false},request),/Injected cancellation failure/);
  await root();
  assert.equal((await db.query("select count(*)::int n from public.activities")).rows[0].n,before,"failed cleanup rolls back new status");
  await root(); assert.equal((await db.query("select count(*)::int n from private.requests where request_id=$1",[request])).rows[0].n,0);
  assert.equal((await db.query("select status from public.activities where id=$1",[current])).rows[0].status,'scheduled');
  await db.exec("drop trigger reject_status_cancel on public.activities; drop function public.reject_status_cancel();");
  await actor("owner");
  const saved=await action("save_status_note",{source_id:current,available:false},request);
  assert.equal(saved.cleared_count,2);
  assert.deepEqual(await action("save_status_note",{source_id:current,title:'Must not duplicate'},request),saved);
  const note=(await db.query("select * from public.activities where id=$1",[saved.id])).rows[0];
  assert.equal(note.title,'Study note'); assert.equal(note.description,'Book practice'); assert.equal(note.category,'Study'); assert.equal(note.audience,'friends'); assert.equal(note.available,false); assert.equal(note.enable_reactions,false);
  assert.equal(Date.parse(note.ends_at),Date.parse(sourceExpiry),"omitted expiry preserves current status timing");
  assert.equal((await db.query("select status from public.activities where id=$1",[older])).rows[0].status,'cancelled');
  await root(); await db.query("update public.places set label='My desk',latitude=40,longitude=-90,online_url='https://example.com/room' where activity_id=$1",[saved.id]);
  await db.query("insert into public.reactions(activity_id,user_id,emoji) values($1,$2,$3)",[saved.id,ids.owner,String.fromCodePoint(0x1f64c)]);
  await actor("owner");
  const edited=await action("save_status_note",{source_id:saved.id,title:'Edited title',ends_at:new Date(Date.now()+5400000).toISOString()});
  assert.equal(edited.id,saved.id,"title/expiry edit preserves status ID");
  assert.equal((await db.query("select count(*)::int n from public.reactions where activity_id=$1",[saved.id])).rows[0].n,1,"reaction history stays on current status");
  const place=(await db.query("select * from public.places where activity_id=$1",[saved.id])).rows[0];
  assert.equal(place.label,'My desk'); assert.equal(place.latitude,40); assert.equal(place.online_url,'https://example.com/room');
  const scheduled=await action("save_status_note",{title:'Tomorrow note',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString()});
  assert.equal(scheduled.cleared_count,0);
  assert.equal((await db.query("select status from public.activities where id=$1",[saved.id])).rows[0].status,'scheduled');
  const clearRequest=crypto.randomUUID(); const cleared=await action("clear_status_notes",{},clearRequest);
  assert.equal(cleared.cleared_count,1); assert.deepEqual(await action("clear_status_notes",{},clearRequest),cleared);
  assert.equal((await db.query("select status from public.activities where id=$1",[future])).rows[0].status,'scheduled');
  assert.equal((await db.query("select status from public.activities where id=$1",[scheduled.id])).rows[0].status,'scheduled');
  assert.equal((await db.query("select status from public.activities where id=$1",[group])).rows[0].status,'scheduled');
  assert.equal((await db.query("select count(*)::int n from public.rsvps where activity_id=$1",[saved.id])).rows[0].n,0);
  const fresh=await action("save_status_note",{title:'New default status'});
  const defaults=(await db.query("select * from public.activities where id=$1",[fresh.id])).rows[0];
  assert.equal(defaults.audience,'friends'); assert.equal(defaults.available,true); assert.equal(defaults.enable_reactions,true);
  await db.close();
});
