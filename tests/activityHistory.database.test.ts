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
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[name]]);
}
async function root() { await db.exec("reset role"); }
async function call(query: string | null = null, cursor: string | null = null, pageSize: number | null = null) {
  return (await db.query<{ result: Record<string, any> }>(
    "select public.activity_history_page($1,$2,$3) result",
    [query, cursor, pageSize],
  )).rows[0].result;
}
async function migration(name: string) {
  const sql = readFileSync(new URL("../supabase/migrations/" + name, import.meta.url), "utf8")
    .replace("create extension if not exists pgcrypto;", "");
  try { await db.exec(sql); }
  catch (error) { throw new Error(`Migration ${name}: ${(error as Error).message}`); }
}

test("history RPC enforces read, RSVP, exclusion and profile gates with stable bounded cursors", async () => {
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
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query("insert into public.profiles(id,username,name,profile_visibility) values($1,$2,$3,'custom')", [id,name, name === "owner" ? "Owner Name Secret" : name]);
    await db.query("insert into private.accounts(id,birth_date) values($1,'1990-01-01')", [id]);
  }
  await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')", [ids.owner,ids.member]);

  async function beacon(values: {
    owner?: string; title: string; mode?: "solo" | "squad" | "invite"; status?: "scheduled" | "completed" | "cancelled";
    audience?: "private" | "friends"; approval?: boolean; startsAt?: string; endsAt?: string; planId?: string;
  }) {
    const id=crypto.randomUUID();
    await db.query(`insert into public.activities(
      id,owner_id,title,description,category,mode,starts_at,ends_at,timezone,approval_required,status,audience,plan_id,plan_step_index,plan_step
    ) values($1,$2,$3,'Description Only','Study',$4,$5,$6,'UTC',$7,$8,$9,$10,case when $10::uuid is null then null else 0 end,
      case when $10::uuid is null then null else '{"start_mode":"manual","end_mode":"duration","duration_minutes":60}'::jsonb end)`,
      [id,values.owner ?? ids.owner,values.title,values.mode ?? "squad",values.startsAt ?? new Date(Date.now()-7200000).toISOString(),values.endsAt ?? new Date(Date.now()-3600000).toISOString(),values.approval ?? false,values.status ?? "completed",values.audience ?? "private",values.planId ?? null]);
    return id;
  }
  const ownerHosted=await beacon({owner:ids.member,title:"Host private history",audience:"private"});
  const visibleGoing=await beacon({title:"Visible attendee history",audience:"friends",status:"completed"});
  const strictGoing=await beacon({title:"Approved restricted history",audience:"friends",mode:"invite",approval:true,status:"cancelled"});
  const pendingGoing=await beacon({title:"Pending restricted history",audience:"friends",mode:"invite",approval:true});
  const inviteOnly=await beacon({title:"Invited restricted history",audience:"friends",mode:"invite",approval:true});
  const excluded=await beacon({title:"Excluded history",audience:"friends"});
  const solo=await beacon({owner:ids.member,title:"Solo status history",mode:"solo",audience:"private"});
  const hidden=await beacon({owner:ids.stranger,title:"Secret inaccessible title",audience:"private"});
  const elapsed=await beacon({owner:ids.member,title:"Elapsed hosted history",audience:"private",status:"scheduled"});
  const future=await beacon({owner:ids.member,title:"Future hosted history",audience:"private",status:"scheduled",startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+90000000).toISOString()});
  for (const [activityId,status,approved] of [
    [visibleGoing,"going",false],
    [strictGoing,"going",true],
    [pendingGoing,"going",false],
    [inviteOnly,"invited",true],
    [excluded,"going",true],
  ] as const) await db.query("insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,$3,$4)",[activityId,ids.member,status,approved]);
  await db.query("insert into private.activity_exclusions(activity_id,user_id) values($1,$2)",[excluded,ids.member]);
  await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)",[ids.stranger,ids.member]);

  const plan=crypto.randomUUID();
  await db.query("insert into public.plans(id,owner_id,title,description,timezone,start_date) values($1,$2,'Deferred plan','','UTC',current_date)",[plan,ids.member]);
  const placeholder=await beacon({owner:ids.member,title:"Unstarted Plan placeholder",audience:"private",status:"scheduled",planId:plan});
  await db.query("update public.activities set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day',plan_started_at=null where id=$1",[placeholder]);
  const legacyPlan=crypto.randomUUID();
  await db.query("insert into public.plans(id,owner_id,title,description,timezone,start_date) values($1,$2,'Legacy plan','','UTC',current_date)",[legacyPlan,ids.member]);
  const legacyPlanChild=await beacon({owner:ids.member,title:"Legacy scheduled Plan history",audience:"private",status:"scheduled",planId:legacyPlan});
  await db.query("update public.activities set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day',plan_step=null,plan_started_at=null where id=$1",[legacyPlanChild]);
  await db.query("insert into public.beacon_notes(activity_id,author_id,section_heading,body,visibility) values($1,$2,'Secret','Private note body','private')",[ownerHosted,ids.member]);

  const pageStart=new Date(Date.now()-5*86400000).toISOString();
  const pageIds: string[]=[];
  for(let index=0;index<22;index++) pageIds.push(await beacon({owner:ids.member,title:`PageOnly ${String(index).padStart(2,"0")}`,audience:"private",startsAt:pageStart,endsAt:new Date(Date.parse(pageStart)+3600000).toISOString()}));
  assert.equal((await db.query("select count(*)::int n from public.activities where title like 'PageOnly%'" )).rows[0].n,22);

  await actor("member");
  const rows=async (query:string)=>(await call(query)).rows as Record<string,any>[];
  assert.deepEqual((await rows("Host private history")).map((row)=>row.id),[ownerHosted]);
  assert.deepEqual((await rows("Visible attendee history")).map((row)=>row.id),[visibleGoing]);
  assert.equal((await rows("Approved restricted history"))[0]?.viewer_rsvp_status,"going");
  assert.equal((await rows("Pending restricted history")).length,0,"a Going RSVP awaiting host approval stays out of history");
  assert.equal((await rows("Invited restricted history")).length,0,"an invitation alone does not grant attendee history");
  assert.equal((await rows("Excluded history")).length,0);
  assert.equal((await rows("Solo status history")).length,0);
  assert.equal((await rows("Secret inaccessible title")).length,0);
  assert.equal((await rows("Future hosted history")).length,0);
  assert.equal((await rows("Unstarted Plan placeholder")).length,0);
  assert.equal((await rows("Legacy scheduled Plan history")).length,1,"pre-step Plan children retain their real scheduled history");
  assert.equal((await rows("Private note body")).length,0);
  const elapsedRow=(await rows("Elapsed hosted history"))[0];
  assert.equal(elapsedRow.history_label,"ended");
  const privateHost=await rows("Visible attendee history");
  assert.equal(privateHost[0].owner_name,null,"attending does not bypass the host's custom profile visibility");
  assert.equal((await rows("Owner Name Secret")).length,0,"host-name search observes profile visibility");

  let cursor:string|null=null; const collected:string[]=[]; let pages=0;
  do {
    const result=await call("PageOnly",cursor,3);
    assert.equal(result.rows.length,result.has_more?3:1,JSON.stringify(result));
    collected.push(...result.rows.map((row:Record<string,any>)=>row.id));
    cursor=result.next_cursor;
    pages++;
  } while(cursor && pages<10);
  assert.equal(pages,8);
  assert.equal(collected.length,22);
  assert.equal(new Set(collected).size,22,"equal start dates use a deterministic UUID tie-breaker");
  assert.deepEqual(new Set(collected),new Set(pageIds));
  const oversized=await call("PageOnly",null,200);
  assert.equal(oversized.rows.length,20,"the server caps page size at twenty");
  await assert.rejects(call("PageOnly","|"),/cursor is invalid/i);
  await assert.rejects(call("PageOnly","not-a-cursor"),/cursor is invalid/i);
  await assert.rejects(call("x".repeat(81)),/80 characters/i);

  await root();
  await db.query("update public.rsvps set status='interested' where activity_id=$1 and user_id=$2",[strictGoing,ids.member]);
  await actor("member");
  assert.equal((await rows("Approved restricted history")).length,0,"a changed RSVP status revokes approved attendee history");
  await root();
  await db.query("update public.rsvps set status='going' where activity_id=$1 and user_id=$2",[strictGoing,ids.member]);
  await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)",[ids.owner,ids.member]);
  await actor("member");
  assert.equal((await rows("Visible attendee history")).length,0,"a new block immediately revokes shared history access");
  await root();
  await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2",[ids.owner,ids.member]);

  await db.exec("reset role; set role anon;");
  await assert.rejects(call(),/permission denied/i);
  await actor("member");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(call(),/sign in/i);
  await root();
  await db.close();
});
