import test from "node:test";
import assert from "node:assert/strict";
import { guestDatabase,guestIds as ids } from "./guestDatabase";

test("Phase 5.2 canonical external planning, privacy, results and claiming", async t => {
  const f=await guestDatabase(); const {db,role,rpc,share}=f;
  const after=(hours:number)=>new Date(Date.now()+hours*3600000).toISOString();
  const draft=(title="Option")=>({title,description:"PRIVATE option details",category:"Social",mode:"squad",starts_at:after(48),ends_at:after(49),timezone:"UTC",approval_required:false,audience:"friends",audience_id:null,target_count:null,label:"PRIVATE meeting place",latitude:40,longitude:-90,online_url:null,aspiration_ids:[]});
  const action=async(name:string,payload:any,actor=ids.host)=>{await role("authenticated",actor);return (await db.query<{result:any}>("select public.beacon_action($1,$2,gen_random_uuid()) result",[name,JSON.stringify(payload)])).rows[0].result;};
  const slots=[48,72].map(h=>({id:crypto.randomUUID(),starts_at:after(h),ends_at:after(h+1),timezone:"UTC"}));
  const thread=async(kind:string,vote_method="pick_one")=>String((await action("create_planning_thread",{kind,title:`External ${kind}`,body:"PRIVATE body",audience:"friends",audience_id:null,deadline_at:after(2),vote_method,...(kind==="ping"||kind==="time"?{payload:draft()}:{}),...(kind==="time"?{slots}:{})})).id);
  const option=async(tid:string,title:string,approved=true)=>{const id=String((await action("add_council_proposal",{thread_id:tid,payload:draft(title)})).id);if(approved)await action("approve_council_proposal",{thread_id:tid,proposal_id:id,approved:true});return id;};
  const respond=async(hash:string,command:string,payload:any,actor=ids.guest,target:string|null=null)=>{await role("service_role");return rpc("guest_respond",[hash,actor,command,payload,crypto.randomUUID(),target]);};
  try {
    await role("service_role");for(const actor of [ids.guest,ids.other])await rpc("guest_identity",[actor,"Outside Guest","1990-01-01"]);
    const ping=await thread("ping"),pingHash="1".repeat(64);await share(ping,pingHash,"participate","decision");
    await t.test("Ping responses preserve availability and never implicitly RSVP",async()=>{
      await respond(pingHash,"ping",{response:"interested",available_after:after(5)});
      await role("service_role");const page=await rpc("guest_preview",[pingHash,ids.guest]);
      assert.equal(page.kind,"ping");assert.equal(page.saved.response,"interested");assert.ok(!JSON.stringify(page).includes("PRIVATE"));
      await assert.rejects(respond(pingHash,"ping",{response:"maybe",available_after:after(5)}),/Interested/);
      await assert.rejects(respond(pingHash,"ping",{response:"interested",auto_rsvp:true}),/automatically RSVP/);
      await respond(pingHash,"ping",{response:"maybe",available_after:null});
      await role("root");assert.equal((await db.query("select * from public.rsvps where user_id=$1",[ids.guest])).rows.length,0);
    });
    const vote=await thread("vote"),voteHash="2".repeat(64);
    const first=await option(vote,"First approved"),second=await option(vote,"Second approved"),pending=await option(vote,"SECRET pending",false);
    await share(vote,voteHash,"participate","decision");
    await t.test("Pick One changes one effective canonical vote and feeds existing tallies",async()=>{
      await respond(voteHash,"vote",{proposal_id:first});await respond(voteHash,"vote",{proposal_id:second});
      await assert.rejects(respond(voteHash,"vote",{proposal_id:pending}),/eligible approved/);
      await role("root");
      assert.equal((await db.query("select * from public.planning_votes where thread_id=$1 and user_id=$2",[vote,ids.guest])).rows.length,1);
      assert.equal(Number((await db.query<{total:number}>("select total from private.planning_vote_counts($1) where id=$2",[vote,second])).rows[0].total),1);
      await role("service_role");assert.ok(!JSON.stringify(await rpc("guest_preview",[voteHash,ids.guest])).includes("SECRET pending"));
      await role("authenticated",ids.guest);assert.equal((await db.query("select * from public.planning_threads")).rows.length,0);
    });
    await t.test("organizers can remove guest access before deadlines without rewriting outcomes",async()=>{
      await respond(voteHash,"vote",{proposal_id:first},ids.other);
      await role("service_role");assert.equal((await rpc("guest_decision_responses",[ids.host,vote,null,"read"])).guests.length,2);
      await assert.rejects(rpc("guest_decision_responses",[ids.member,vote,ids.other,"remove"]),/Organizer/);
      await rpc("guest_decision_responses",[ids.host,vote,ids.other,"remove"]);
      await assert.rejects(respond(voteHash,"vote",{proposal_id:first},ids.other),/unavailable/);
      await role("root");assert.equal((await db.query("select * from public.planning_votes where thread_id=$1",[vote])).rows.length,1);
    });
    const approval=await thread("vote","approval"),approvalHash="3".repeat(64);
    const approvedA=await option(approval,"Approved A"),approvedB=await option(approval,"Approved B");await share(approval,approvalHash,"participate","decision");
    await t.test("Approval ballots are a single changing set, with explicit None work",async()=>{
      await respond(approvalHash,"vote",{proposal_ids:[approvedA,approvedB],none_work:false});
      await assert.rejects(respond(approvalHash,"vote",{proposal_ids:[approvedA,approvedA],none_work:false}),/None work/);
      await respond(approvalHash,"vote",{proposal_ids:[],none_work:true});
      await role("root");const row=(await db.query<any>("select * from public.planning_approval_ballots where thread_id=$1",[approval])).rows[0];assert.equal(row.none_work,true);assert.deepEqual(row.proposal_ids,[]);
    });
    const time=await thread("time"),timeHash="4".repeat(64);await share(time,timeHash,"participate","decision");
    await t.test("Find a Time uses canonical revisioned slots, recommendations and finalization",async()=>{
      await respond(timeHash,"availability",{slots_revision:1,answers:{[slots[0].id]:"yes",[slots[1].id]:"maybe"},none_work:false});
      await assert.rejects(respond(timeHash,"availability",{slots_revision:0,answers:{},none_work:false}),/changed/);
      await assert.rejects(respond(timeHash,"availability",{slots_revision:1,answers:{[crypto.randomUUID()]:"yes"},none_work:false}),/changed/);
      await action("finalize_planning_time",{thread_id:time,slot_id:slots[0].id,slots_revision:1,confirmed:true});
      await assert.rejects(respond(timeHash,"availability",{slots_revision:1,answers:{},none_work:false}),/closed/);
    });
    const draw=await thread("draw"),drawHash="5".repeat(64);const drawA=await option(draw,"Draw A"),drawB=await option(draw,"Draw B");await share(draw,drawHash,"participate","decision");
    await t.test("Draw guests only read approved options and actual canonical outcomes",async()=>{
      await role("service_role");const before=await rpc("guest_preview",[drawHash,ids.guest]);assert.equal(before.winner_proposal_id,null);assert.equal(before.options.length,2);
      await assert.rejects(respond(drawHash,"draw",{}),/not supported/);
      await role("root");await db.query("update public.planning_threads set deadline_at=now()-interval '1 second' where id=$1",[draw]);
      const result=await action("resolve_planning_thread",{thread_id:draw,confirmed:true});
      assert.equal((await action("resolve_planning_thread",{thread_id:draw,confirmed:true})).activity_id,result.activity_id);
      await role("service_role");const after=await rpc("guest_preview",[drawHash,ids.guest]);assert.ok([drawA,drawB].includes(after.winner_proposal_id));assert.equal(after.result_target,null);
    });
    await t.test("guest ties require canonical host selection and legacy resolution counts guests",async()=>{
      const tie=await thread("vote"),tieHash="c".repeat(64);const a=await option(tie,"Tie A"),b=await option(tie,"Tie B");await share(tie,tieHash,"participate","decision");
      await respond(tieHash,"vote",{proposal_id:a});await respond(tieHash,"vote",{proposal_id:b},ids.other);
      await role("root");await db.query("update public.planning_threads set deadline_at=now()-interval '1 second' where id=$1",[tie]);
      await assert.rejects(action("resolve_planning_thread",{thread_id:tie,confirmed:true}),/Explicitly choose/);
      await action("resolve_planning_thread",{thread_id:tie,proposal_id:b,confirmed:true});
      await role("root");assert.equal((await db.query<any>("select result_summary from public.planning_threads where id=$1",[tie])).rows[0].result_summary.tie_count,2);
      const legacy=await thread("vote"),legacyHash="d".repeat(64);await option(legacy,"Earlier zero votes");const supported=await option(legacy,"Later guest-supported option");await share(legacy,legacyHash,"participate","decision");
      await respond(legacyHash,"vote",{proposal_id:supported});
      await role("root");await db.query("update public.planning_threads set resolution_policy='legacy',deadline_at=now()-interval '1 second' where id=$1",[legacy]);
      await action("resolve_planning_thread",{thread_id:legacy});await role("root");assert.equal((await db.query<any>("select winner_proposal_id from public.planning_threads where id=$1",[legacy])).rows[0].winner_proposal_id,supported);
    });
    await t.test("decision deadlines and resolution use guest votes without granting guest publication",async()=>{
      await role("root");await db.query("update public.planning_threads set deadline_at=now()-interval '1 second' where id=$1",[vote]);
      await assert.rejects(respond(voteHash,"vote",{proposal_id:first}),/closed/);
      const result=await action("resolve_planning_thread",{thread_id:vote,proposal_id:second,confirmed:true});
      await role("service_role");assert.equal((await rpc("guest_preview",[voteHash,ids.guest])).result_target,null);
      const beaconHash="6".repeat(64);await share(result.activity_id,beaconHash);
      assert.equal((await rpc("guest_preview",[voteHash,ids.guest])).result_target,result.activity_id);
      const resultPage=await rpc("guest_preview",[voteHash,ids.guest,result.activity_id]);assert.equal(resultPage.kind,"beacon");assert.equal(resultPage.response,null);
      await respond(voteHash,"rsvp",{status:"going"},ids.guest,result.activity_id);
      await assert.rejects(respond(voteHash,"publish_planning_beacon",{}),/closed|not supported/);
    });
    const plan=String((await action("create_living_plan",{title:"Plan",description:"PRIVATE plan",timezone:"UTC",stops:[{title:"Selected idea",details:"PRIVATE idea details"},{title:"SECRET unselected"}]})).id);
    const privateBeacon=await f.beacon();
    const linked=String((await action("add_plan_stop",{plan_id:plan,activity_id:privateBeacon})).id);
    await role("root");const idea=String((await db.query<any>("select id from public.plan_stops where plan_id=$1 and title='Selected idea'",[plan])).rows[0].id);
    const planHash="7".repeat(64);await share(plan,planHash,"preview","plan",{stop_ids:[idea,linked]});
    await t.test("Plan previews show selected approved stops and independently authorized child links",async()=>{
      await role("service_role");const page=await rpc("guest_preview",[planHash,ids.guest]);
      assert.equal(page.stops.length,1);assert.ok(!JSON.stringify(page).includes("PRIVATE"));assert.ok(!JSON.stringify(page).includes("SECRET"));
      assert.equal(page.stops.find((s:any)=>s.id===linked),undefined);
      assert.equal((await rpc("guest_preview",[planHash,ids.guest,privateBeacon])).state,"unavailable");
      await share(privateBeacon,"8".repeat(64));assert.equal((await rpc("guest_preview",[planHash,ids.guest,privateBeacon])).kind,"beacon");
      const unrelated=await f.beacon();await share(unrelated,"9".repeat(64));assert.equal((await rpc("guest_preview",[planHash,ids.guest,unrelated])).state,"unavailable");
    });
    await t.test("Status cards are expiring snapshots without presence, attachments or live location",async()=>{
      await role("root");const status=crypto.randomUUID();
      await db.query("insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,audience,timezone) values($1,$2,'Selected Status text','Other','solo',now()-interval '1 hour',now()+interval '3 hours','private','UTC')",[status,ids.host]);
      await share(status,"a".repeat(64),"preview","status",{expires_at:after(1),status_text:"Selected Status text"});
      const page=await rpc("guest_preview",["a".repeat(64),ids.guest]);assert.equal(page.note,"Selected Status text");assert.equal(page.latitude,undefined);assert.equal(page.status_attachment,undefined);
      await role("root");await db.query("update public.activities set title='New unpublished text' where id=$1",[status]);
      await role("service_role");assert.equal((await rpc("guest_preview",["a".repeat(64),null])).note,"Selected Status text");
      await role("root");await db.query("insert into private.status_config(activity_id,owner_id,note_title) values($1,$2,'')",[status,ids.host]);
      await role("service_role");assert.equal((await rpc("guest_preview",["a".repeat(64),null])).state,"unavailable","removing source text disables the snapshot");
      await role("root");await db.query("update private.status_config set note_title='Replacement private note' where activity_id=$1",[status]);
      await role("service_role");assert.equal((await rpc("guest_preview",["a".repeat(64),null])).note,"Selected Status text","editing the source never publishes new text");
      await role("root");await db.query("update public.activities set status='completed' where id=$1",[status]);
      await role("service_role");assert.equal((await rpc("guest_preview",["a".repeat(64),null])).state,"unavailable");
    });
    const claimBeacon=await f.beacon(false,5);await share(claimBeacon,"b".repeat(64));
    await respond("b".repeat(64),"rsvp",{status:"going"});
    await action("rsvp",{id:claimBeacon,status:"interested"},ids.member);
    await action("save_council_approval_ballot",{thread_id:approval,proposal_ids:[approvedA],none_work:false},ids.member);
    await t.test("explicit dual-proof claim keeps member conflicts and preserves finalized history",async()=>{
      await role("service_role");const preview=await rpc("guest_claim",[ids.guest,ids.member,"preview"]);assert.ok(preview.eligible>=2);assert.equal(preview.conflicts,2);
      const claimed=await rpc("guest_claim",[ids.guest,ids.member,"confirm"]);assert.equal(claimed.claimed,true);
      assert.equal((await rpc("guest_claim",[ids.guest,ids.member,"confirm"])).claimed,true);
      await role("root");const rows=(await db.query<any>("select * from public.rsvps where activity_id=$1",[claimBeacon])).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,ids.member);assert.equal(rows[0].status,"interested");
      assert.equal((await db.query("select * from public.planning_ping_responses where thread_id=$1 and user_id=$2",[ping,ids.member])).rows.length,1);
      assert.equal((await db.query("select * from public.planning_votes where thread_id=$1 and user_id=$2",[vote,ids.guest])).rows.length,1,"resolved vote retains historical attribution");
      assert.deepEqual((await db.query<any>("select proposal_ids from public.planning_approval_ballots where thread_id=$1 and user_id=$2",[approval,ids.member])).rows[0].proposal_ids,[approvedA]);
      assert.equal((await db.query("select * from public.squad_members where user_id=$1",[ids.member])).rows.length,0);
      await role("service_role");await assert.rejects(rpc("guest_claim",[ids.guest,ids.host,"confirm"]),/already claimed/);
      await assert.rejects(respond(pingHash,"ping",{response:"pass"}),/Verify/);
      await role("authenticated",ids.member);await assert.rejects(rpc("guest_claim",[ids.other,ids.member,"confirm"]),/permission denied/);
    });
    await t.test("claims preserve revoked-link ownership, nonfriend ballots and organizer exclusions",async()=>{
      const destination=crypto.randomUUID();
      const event=await f.beacon(false,5),eventHash="e".repeat(64);await share(event,eventHash);
      await respond(eventHash,"rsvp",{status:"going"},ids.other);
      const live=await thread("vote"),liveHash="f".repeat(64),choice=await option(live,"Guest choice");await share(live,liveHash,"participate","decision");
      await respond(liveHash,"vote",{proposal_id:choice},ids.other);
      await rpc("guest_share_manage",[ids.host,"revoke","beacon",event,{},null]);
      await role("root");await db.query("insert into auth.users values($1,now())",[destination]);await db.query("insert into public.profiles(id,username,name) values($1,'claimedoutsider','Claimed outsider')",[destination]);await db.query("insert into private.accounts(id,birth_date) values($1,'1990-01-01')",[destination]);
      await role("service_role");const result=await rpc("guest_claim",[ids.other,destination,"confirm"]);assert.ok(result.eligible>=2);
      assert.equal((await rpc("guest_preview",[eventHash,destination])).state,"unavailable","claim does not reactivate revoked links");
      await role("root");const rows=(await db.query<any>("select * from public.rsvps where activity_id=$1",[event])).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,destination);assert.equal(rows[0].status,"going");
      assert.equal(Number((await db.query<any>("select total from private.planning_vote_counts($1) where id=$2",[live,choice])).rows[0].total),1,"nonfriend claim retains authorized canonical tally");
      assert.equal((await db.query("select * from private.guest_exclusions where target_id=$1 and user_id=$2",[vote,destination])).rows.length,1,"organizer removal follows claimed identity");
      assert.equal((await db.query("select * from public.squad_members where user_id=$1",[destination])).rows.length,0);
      await share(event,"0".repeat(64));await respond("0".repeat(64),"rsvp",{status:"interested"},destination);
      await role("root");assert.equal((await db.query("select * from public.rsvps where activity_id=$1",[event])).rows.length,1);
    });
    await t.test("same Auth identity can explicitly claim after onboarding without duplicating participation",async()=>{
      const actor=crypto.randomUUID();await role("root");await db.query("insert into auth.users values($1,now())",[actor]);
      await role("service_role");await rpc("guest_identity",[actor,"Later member","1990-01-01"]);
      const event=await f.beacon(true,5);await share(event,"ab".repeat(32));await respond("ab".repeat(32),"rsvp",{status:"going"},actor);
      await role("root");await db.query("insert into public.profiles(id,username,name) values($1,'samemember','Same member')",[actor]);await db.query("insert into private.accounts(id,birth_date) values($1,'1990-01-01')",[actor]);
      await role("service_role");assert.equal((await rpc("guest_claim",[actor,actor,"confirm"])).claimed,true);
      await role("root");const rows=(await db.query<any>("select * from public.rsvps where activity_id=$1",[event])).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,"requested","claim preserves pending approval");
    });
  } finally {await db.close();}
});
