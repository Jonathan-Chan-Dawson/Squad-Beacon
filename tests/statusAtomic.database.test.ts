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
  await assert.rejects(action("save_status_note",{title:'x'.repeat(121),source_id:current}),/title|characters/i);
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

  // Raw-table reads must not disclose retained Activity Only text or private IDs.
  await root();
  const secret=crypto.randomUUID();
  await db.query("insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,audience,timezone) values($1,$2,'Private basketball','Fitness','invite',now(),now()+interval '3 hours','private','UTC')",[secret,ids.owner]);
  await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted') on conflict do nothing",[ids.owner,ids.member]);
  await actor('owner');
  let feature=await action('save_status_note',{source_id:fresh.id,title:'Retained note',description:'Retained detail',status_attachment:{type:'beacon',id:secret},status_presentation:'activity_only'});
  const snapshot=async()=>((await db.query<{result:any}>('select public.beacon_snapshot() result')).rows[0].result);
  assert.equal((await snapshot()).activities.find((a:any)=>a.id===feature.id).title,'Retained note');
  await actor('member');
  let projected=(await snapshot()).activities.find((a:any)=>a.id===feature.id);
  assert.equal(projected.title,''); assert.equal(projected.description,''); assert.equal(projected.status_attachment,null);
  assert.equal((await db.query('select title from public.activities where id=$1',[feature.id])).rows[0].title,'');
  await assert.rejects(db.query('select * from private.status_config'),/permission denied/i);
  await assert.rejects(action('save_status_note',{title:'Invalid',status_attachment:{type:'beacon',id:secret}}),/eligible/i);
  await actor('owner'); feature=await action('save_status_note',{source_id:feature.id,status_presentation:'text_activity',title:'Anyone down?'});
  await actor('member'); projected=(await snapshot()).activities.find((a:any)=>a.id===feature.id);
  assert.equal(projected.title,'Anyone down?'); assert.equal(projected.status_attachment,null);
  await root(); await db.query("update public.activities set audience='friends' where id=$1",[secret]);
  await actor('member'); assert.equal((await snapshot()).activities.find((a:any)=>a.id===feature.id).status_attachment.id,secret);
  await actor('owner'); feature=await action('save_status_note',{source_id:feature.id,status_note_hidden:true});
  await actor('member'); projected=(await snapshot()).activities.find((a:any)=>a.id===feature.id);
  assert.equal(projected.title,''); assert.equal(projected.status_attachment,null);
  await assert.rejects(action('react_status',{id:feature.id,emoji:String.fromCodePoint(0x1f64c)}),/hidden/i);
  await actor('owner'); feature=await action('save_status_note',{source_id:feature.id,status_note_hidden:false,status_sharing:false});
  await actor('member'); assert.ok(!(await snapshot()).activities.some((a:any)=>a.id===feature.id));
  assert.equal((await db.query('select id from public.activities where id=$1',[feature.id])).rows.length,0);
  await actor('owner');
  const scheduledFeature=await action('save_status_note',{title:'Future retained',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString(),status_presentation:'activity_only',status_attachment:{type:'beacon',id:secret}});
  await action('save_status_note',{source_id:feature.id,available:false});
  assert.equal((await snapshot()).activities.find((a:any)=>a.id===scheduledFeature.id).status_attachment.id,secret);
  await root(); await db.query("update public.activities set status='cancelled' where id=$1",[secret]);
  await actor('owner'); const replacement=await action('save_status_note',{source_id:scheduledFeature.id,title:'Still scheduled'});
  assert.equal(replacement.replaced_scheduled,true);
  assert.equal((await snapshot()).activities.find((a:any)=>a.id===replacement.id).status_presentation,'activity_only');
  await root(); await db.query("update public.activities set starts_at=now()-interval '1 minute',ends_at=now()+interval '1 hour' where id=$1",[replacement.id]);
  await actor('member'); assert.ok(!(await snapshot()).activities.some((a:any)=>a.id===replacement.id),'global pause also suppresses a scheduled note when it becomes active');
  await actor('owner'); await action('update_presence',{sharing:true});
  await actor('member'); projected=(await snapshot()).activities.find((a:any)=>a.id===replacement.id);
  assert.equal(projected.title,''); assert.equal(projected.status_attachment,null);
  await root(); await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)',[ids.owner,ids.member]);
  await actor('member'); assert.ok(!(await snapshot()).activities.some((a:any)=>a.id===replacement.id));
  // Living Status: blank text and current opt-in are independent of notes/features.
  await root(); await db.query('delete from public.blocks where blocker_id=$1 and blocked_id=$2',[ids.owner,ids.member]);
  await db.query("update public.activities set status='scheduled',audience='private',starts_at=now()-interval '1 minute',ends_at=now()+interval '3 hours' where id=$1",[secret]);
  await actor('owner');
  let living=await action('save_status_note',{source_id:feature.id,title:'',description:'',status_note_hidden:false,status_sharing:true,status_attachment:null,status_presentation:'text_only'});
  let own=(await snapshot()).activities.find((a:any)=>a.id===living.id);
  assert.equal(own.title,''); assert.equal(own.status_show_current_beacon,false); assert.equal(own.status_current_beacon,null);
  assert.equal((await db.query('select title from public.activities where id=$1',[living.id])).rows[0].title,'');
  living=await action('save_status_note',{source_id:living.id,status_show_current_beacon:true});
  own=(await snapshot()).activities.find((a:any)=>a.id===living.id);
  assert.deepEqual(own.status_current_beacon,{id:secret,role:'hosting'});
  await actor('member');
  let currentView=(await snapshot()).activities.find((a:any)=>a.id===living.id);
  assert.equal(currentView.status_current_beacon,null,'private chosen Beacon has no viewer-specific fallback');
  assert.equal('status_current_beacon_id' in currentView,false); assert.equal('status_show_current_beacon' in currentView,false);
  await root(); await db.query("update public.activities set audience='friends' where id=$1",[secret]);
  await actor('owner'); living=await action('save_status_note',{source_id:living.id,status_note_hidden:true});
  await actor('member'); currentView=(await snapshot()).activities.find((a:any)=>a.id===living.id);
  assert.equal(currentView.title,''); assert.equal(currentView.status_attachment,null); assert.equal(currentView.status_current_beacon.id,secret,'Hide Note does not hide independently enabled Current');
  await actor('owner'); living=await action('save_status_note',{source_id:living.id,status_current_beacon_id:group});
  assert.equal((await snapshot()).activities.find((a:any)=>a.id===living.id).status_current_beacon.id,group);
  living=await action('save_status_note',{source_id:living.id,status_show_current_beacon:false});
  own=(await snapshot()).activities.find((a:any)=>a.id===living.id);
  assert.equal(own.status_current_beacon,null); assert.equal(own.status_current_beacon_id,group,'turning sharing off retains Specific configuration');
  living=await action('save_status_note',{source_id:living.id,status_show_current_beacon:true});
  await root(); await db.query("update public.activities set ends_at=now()-interval '1 second' where id=$1",[group]);
  await actor('owner'); own=(await snapshot()).activities.find((a:any)=>a.id===living.id);
  assert.equal(own.status_current_beacon,null,'expired Specific never falls back'); assert.equal(own.status_current_beacon_id,group);
  await assert.rejects(action('save_status_note',{source_id:living.id,status_current_beacon_id:foreign}),/eligible current/i);
  living=await action('save_status_note',{source_id:living.id,status_current_beacon_id:null,status_note_hidden:false,status_sharing:false});
  await actor('member'); assert.ok(!(await snapshot()).activities.some((a:any)=>a.id===living.id));
  await actor('owner');
  const renewed=await action('save_status_note',{source_id:living.id,available:false,ends_at:new Date(Date.now()+7200000).toISOString()});
  own=(await snapshot()).activities.find((a:any)=>a.id===renewed.id);
  assert.equal(own.status_show_current_beacon,true); assert.equal(own.status_sharing,false); assert.equal(own.status_current_beacon,null); assert.equal(own.title,'');
  const futureFromSource=await action('save_status_note',{source_id:renewed.id,title:'',starts_at:new Date(Date.now()+172800000).toISOString(),ends_at:new Date(Date.now()+176400000).toISOString()});
  assert.equal((await snapshot()).activities.find((a:any)=>a.id===futureFromSource.id).status_show_current_beacon,false,'new future Status never inherits opt-in through a current source');
  const independent=await action('save_status_note',{title:'',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString()});
  const scheduledOwn=(await snapshot()).activities.find((a:any)=>a.id===independent.id);
  assert.equal(scheduledOwn.status_show_current_beacon,false,'independent schedules default off'); assert.equal(scheduledOwn.title,'');
  await action('save_status_note',{source_id:renewed.id,available:true});
  assert.equal((await snapshot()).activities.find((a:any)=>a.id===independent.id).status_show_current_beacon,false);
  await assert.rejects(action('create_activity',{title:'',category:'Social',mode:'invite',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),timezone:'UTC',audience:'friends'}),/title|check constraint/i);
  // Approved Going and eligible cohosts qualify; pending requests do not.
  await root(); const attended=crypto.randomUUID();
  await db.query("insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,audience,timezone,approval_required) values($1,$2,'Study together','Study','invite',now()-interval '1 minute',now()+interval '1 hour','private','UTC',true)",[attended,ids.admin]);
  await db.query("insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,'requested',false)",[attended,ids.member]);
  await actor('member'); let memberStatus=await action('save_status_note',{title:'',status_show_current_beacon:true});
  assert.equal((await snapshot()).activities.find((a:any)=>a.id===memberStatus.id).status_current_beacon,null);
  await root(); await db.query("update public.rsvps set status='going',approved=true where activity_id=$1 and user_id=$2",[attended,ids.member]);
  await actor('member'); assert.deepEqual((await snapshot()).activities.find((a:any)=>a.id===memberStatus.id).status_current_beacon,{id:attended,role:'going'});
  await root(); await db.query("insert into public.beacon_roles(activity_id,user_id,role,assigned_by) values($1,$2,'coowner',$3)",[attended,ids.member,ids.admin]);
  await actor('member'); assert.equal((await snapshot()).activities.find((a:any)=>a.id===memberStatus.id).status_current_beacon.role,'cohosting');
  await root(); await db.query("update public.rsvps set approved=false where activity_id=$1 and user_id=$2",[attended,ids.member]);
  await actor('member'); assert.equal((await snapshot()).activities.find((a:any)=>a.id===memberStatus.id).status_current_beacon,null);
  await assert.rejects(db.query('select * from private.status_config'),/permission denied/i);
  await db.close();
});
