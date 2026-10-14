import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, makeDemo, demoAction } from "../src/shared/demo";
import { atomicCreateAndInvite, createAndInvite, creationHandoffParams, creationStatusSeed, mergeCreationStatusSeed, newCreationInviteSession, parseCreationInvitees, validateCreationInvitees } from "../src/features/beacons/createHandoff";
import type { Payload } from "../src/shared/types";

test("invitee parsing preserves stale IDs for review and malformed input blocks until explicitly cleared", () => {
  assert.deepEqual(parseCreationInvitees('["jordan","stale","jordan"]'), { ids: ["jordan", "stale"], error: "" });
  assert.notEqual(parseCreationInvitees('{"id":"jordan"}').error, "");
  assert.notEqual(parseCreationInvitees('[null]').error, "");
  assert.deepEqual(parseCreationInvitees("[]"), { ids: [], error: "" });
});

test("permission changes before publishing prevent any Beacon creation", async () => {
  const data = makeDemo();
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "jordan" });
  const session = newCreationInviteSession();
  await assert.rejects(() => createAndInvite(session, ["jordan"], () => data, DEMO_ID,
    async () => { assert.fail("Must not create"); }, async () => { assert.fail("Must not invite"); }), /no longer eligible/);
  assert.equal(session.createdId, null);
  assert.throws(() => validateCreationInvitees(data, "wrong-viewer", []), /Refresh/);
});

test("partial invitation retry keeps one created Beacon and never repeats successful invitations", async () => {
  const data = makeDemo();
  const friends = data.friendships.filter((row) => row.status === "accepted" && [row.sender_id, row.recipient_id].includes(DEMO_ID))
    .map((row) => row.sender_id === DEMO_ID ? row.recipient_id : row.sender_id).slice(0, 2);
  assert.equal(friends.length, 2);
  const session = newCreationInviteSession();
  let creates = 0, fail = true;
  const invited: string[] = [];
  const create = async () => { creates++; return { id: "created-beacon" }; };
  const act = async (_: string, payload?: Payload) => {
    const id = String(payload?.user_id); invited.push(id);
    if (id === friends[1] && fail) throw new Error("Temporary failure");
    return {};
  };
  const first = await createAndInvite(session, friends, () => data, DEMO_ID, create, act);
  assert.equal(first.createdId, "created-beacon");
  assert.deepEqual(first.invitedIds, [friends[0]]);
  assert.deepEqual(first.pendingIds, [friends[1]]);
  assert.match(first.errors[friends[1]], /Temporary failure/);
  fail = false;
  const retried = await createAndInvite(session, friends, () => data, DEMO_ID, create, act);
  assert.equal(creates, 1);
  assert.deepEqual(invited, [friends[0], friends[1], friends[1]]);
  assert.deepEqual(retried.pendingIds, []);
  assert.deepEqual(retried.errors, {});
});

test("existing going/requested/invited attendance is preserved without another invitation action", async () => {
  const data = makeDemo();
  const session = newCreationInviteSession();
  session.createdId = "beacon"; session.viewerId = DEMO_ID; session.pendingIds = ["jordan"];
  for (const status of ["going", "requested", "invited"] as const) {
    session.pendingIds = ["jordan"]; session.invitedIds = [];
    data.rsvps = [{ activity_id: "beacon", user_id: "jordan", status, approved: false }];
    await createAndInvite(session, ["jordan"], () => data, DEMO_ID,
      async () => { assert.fail("Must not recreate"); }, async () => { assert.fail("Must not reinvite"); });
    assert.equal(data.rsvps[0].status, status);
    assert.deepEqual(session.pendingIds, []);
  }
});

test("lost eligibility after creating remains a visible pending failure and does not recreate", async () => {
  const data = makeDemo();
  const session = newCreationInviteSession();
  session.createdId = "beacon"; session.viewerId = DEMO_ID; session.pendingIds = ["jordan"];
  data.friendships = [];
  const result = await createAndInvite(session, ["jordan"], () => data, DEMO_ID,
    async () => { assert.fail("Must not recreate"); }, async () => { assert.fail("Must not invite"); });
  assert.deepEqual(result.pendingIds, ["jordan"]);
  assert.match(result.errors.jordan, /no longer eligible/);
});

test("status conversion seeds text/category only and leaves source history/settings untouched", () => {
  const data = makeDemo();
  const now = Date.parse("2026-10-13T16:00:00Z");
  const source = { ...data.activities[0], id: "status", owner_id: DEMO_ID, mode: "solo" as const, status: "scheduled" as const,
    title: "Painting", description: "Working on a portrait", category: "Creative" as const, audience: "private" as const,
    starts_at: "2026-10-13T15:00:00Z", ends_at: "2026-10-13T17:00:00Z", enable_checklist: false };
  data.activities = [source];
  assert.deepEqual(creationStatusSeed(data, DEMO_ID, "status", now), { title: "Painting", description: "Working on a portrait", category: "Creative" });
  assert.equal(source.status, "scheduled");
  assert.equal(creationStatusSeed(data, "jordan", "status", now), undefined);
  assert.equal(creationStatusSeed(data, DEMO_ID, "status", Date.parse(source.ends_at)), undefined);
});

test("creation handoff retains selection, source, scheduling and only confirmed finite coordinates", () => {
  const context = { inviteeIds: '["jordan"]', statusSourceId: "status", startsAt: "2026-10-14T16:00:00Z", timezone: "America/Chicago", fromMap: "yes", latitude: "41.8", longitude: "-87.6", placeLabel: "Park", secret: "ignore" };
  const handoff = creationHandoffParams(context);
  assert.equal(handoff.inviteeIds, context.inviteeIds);
  assert.equal(handoff.statusSourceId, "status");
  assert.equal(handoff.startsAt, context.startsAt);
  assert.equal(handoff.timezone, context.timezone);
  assert.equal(creationHandoffParams({ ...context, timezone: "invalid-zone" }).timezone, undefined);
  assert.equal(handoff.latitude, "41.8");
  assert.equal(handoff.placeLabel, "Park");
  assert.equal(handoff.secret, undefined);
  assert.equal(creationHandoffParams({ ...context, latitude: "" }).latitude, undefined);
  assert.equal(creationHandoffParams({ ...context, longitude: "181" }).placeLabel, undefined);
});

test("late status hydration seeds untouched fields while preserving text the user has edited", () => {
  const draft = { title: "My draft", description: "", category: "Social" };
  const seed = { title: "Painting", description: "A portrait", category: "Creative" };
  assert.deepEqual(mergeCreationStatusSeed(draft, seed, { title: true, description: false, category: false }),
    { title: "My draft", description: "A portrait", category: "Creative" });
  assert.deepEqual(mergeCreationStatusSeed(draft, seed, { title: true, description: true, category: true }), draft);
});

test("concurrent creation/retry calls share one run and never duplicate the Beacon or invitations", async () => {
  const data = makeDemo(), session = newCreationInviteSession();
  let release!: (value: Record<string, unknown>) => void;
  const created = new Promise<Record<string, unknown>>((resolve) => { release = resolve; });
  let creates = 0, invitations = 0;
  const create = () => { creates++; return created; };
  const act = async () => { invitations++; return {}; };
  const first = createAndInvite(session, ["jordan"], () => data, DEMO_ID, create, act);
  const second = createAndInvite(session, ["jordan"], () => data, DEMO_ID, create, act);
  assert.equal(first, second);
  assert.equal(creates, 1);
  release({ id: "created-once" });
  await Promise.all([first, second]);
  assert.equal(invitations, 1);
  await createAndInvite(session, ["jordan"], () => data, DEMO_ID, create, act);
  assert.equal(creates, 1);
  assert.equal(invitations, 1);
});

test("an explicitly removed pending recipient is skipped after an earlier invitation completes", async () => {
  const data = makeDemo(), session = newCreationInviteSession();
  const ids = data.friendships.filter((row) => row.status === "accepted" && [row.sender_id, row.recipient_id].includes(DEMO_ID))
    .map((row) => row.sender_id === DEMO_ID ? row.recipient_id : row.sender_id).slice(0, 2);
  session.createdId = "existing"; session.viewerId = DEMO_ID; session.pendingIds = [...ids];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const invited: string[] = [];
  const run = createAndInvite(session, ids, () => data, DEMO_ID, async () => { assert.fail("Must not recreate"); }, async (_, payload) => {
    invited.push(String(payload?.user_id)); await gate; return {};
  });
  session.pendingIds = session.pendingIds.filter((id) => id !== ids[1]);
  release();
  await run;
  assert.deepEqual(invited, [ids[0]]);
});

test("atomic publication retains original payload, selection and UUID after a lost committed response",async()=>{
  const data=makeDemo(), session=newCreationInviteSession();
  const calls:{id?:string; payload?:Payload}[]=[];
  let generated=0;
  const act=async(_action:string,payload?:Payload,id?:string)=>{
    calls.push({id,payload:structuredClone(payload)});
    if(calls.length===1) throw new Error("Response lost");
    return {id:"committed-beacon",event:"create_activity_with_invitees",committed:true,invited_ids:["jordan"]};
  };
  await assert.rejects(()=>atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{title:"Original",mode:"squad"},act,()=>`request-${++generated}`),/Response lost/);
  const retried=await atomicCreateAndInvite(session,["riley"],()=>data,DEMO_ID,"create_activity_with_invitees",{title:"Edited after error",mode:"squad"},act,()=>`request-${++generated}`);
  assert.equal(generated,1); assert.deepEqual(calls[1],calls[0]); assert.equal(calls[1].payload?.title,"Original"); assert.deepEqual(calls[1].payload?.invitee_ids,["jordan"]);
  assert.equal(retried.createdId,"committed-beacon"); assert.deepEqual(retried.invitedIds,["jordan"]);
});
test("unverified atomic replies retain the same request until authoritative acknowledgement",async()=>{
  const data=makeDemo(), session=newCreationInviteSession(); let calls=0; const ids:string[]=[];
  const act=async(_action:string,_payload?:Payload,id?:string)=>{ ids.push(id!); calls++; return calls===1 ? {} : {id:"beacon",event:"create_activity_with_invitees",committed:true,invited_ids:["jordan"]}; };
  await assert.rejects(()=>atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{mode:"squad"},act,()=>"stable-request"),/could not be verified/);
  await atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{mode:"squad"},act,()=>"must-not-replace");
  assert.deepEqual(ids,["stable-request","stable-request"]);
});
test("atomic definitive rollback releases the attempt for corrected draft while prevalidation never locks it",async()=>{
  const data=makeDemo(), session=newCreationInviteSession();
  await assert.rejects(()=>atomicCreateAndInvite(session,["stale"],()=>data,DEMO_ID,"create_activity_with_invitees",{},async()=>{assert.fail("No action");},()=>"unused"),/eligible/);
  assert.equal(session.atomicAttempt,undefined); assert.equal(session.viewerId,null);
  let attempts=0;
  const act=async()=>{ attempts++; if(attempts===1) throw Object.assign(new Error("Rejected draft"),{definitive:true}); return {id:"corrected",event:"create_activity_with_invitees",committed:true,invited_ids:["jordan"]}; };
  await assert.rejects(()=>atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{title:"Rejected"},act,()=>"first"),/Rejected/);
  assert.equal(session.atomicAttempt,undefined);
  await atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{title:"Corrected"},act,()=>"second");
  assert.equal(session.atomicAttempt?.requestId,"second");
});
test("atomic concurrent attempts share one run and account changes cannot reuse publication",async()=>{
  const data=makeDemo(), session=newCreationInviteSession(); let calls=0; let finish:()=>void=()=>{};
  const wait=new Promise<void>((resolve)=>{finish=resolve;});
  const act=async()=>{calls++; await wait; return {id:"beacon",event:"create_activity_with_invitees",committed:true,invited_ids:["jordan"]};};
  const first=atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{},act,()=>"request");
  const second=atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{},act,()=>"duplicate");
  finish(); await Promise.all([first,second]); assert.equal(calls,1);
  await assert.rejects(()=>atomicCreateAndInvite(session,["jordan"],()=>data,"other-account","create_activity_with_invitees",{},act,()=>"new"),/account/);
  const pending=newCreationInviteSession();
  await assert.rejects(()=>atomicCreateAndInvite(pending,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{},async()=>{throw new Error("Network");},()=>"pending"),/Network/);
  await assert.rejects(()=>atomicCreateAndInvite(pending,["jordan"],()=>data,"other-account","create_activity_with_invitees",{},act,()=>"new"),/account/);
  assert.equal(calls,1);
});
test("demo atomic invitation failure proves rollback and leaves the helper draft editable",async()=>{
  const data=makeDemo(), original=structuredClone(data), session=newCreationInviteSession();
  const act=async(action:string,payload?:Payload)=>{
    try { demoAction(data,action,payload!); return {}; }
    catch(failure) { throw Object.assign(failure as Error,{definitive:true}); }
  };
  await assert.rejects(()=>atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{title:"",mode:"squad"},act,()=>"demo-rollback"));
  assert.equal(session.atomicAttempt,undefined); assert.equal(session.createdId,null); assert.deepEqual(data,original);
});

test("an account change during an atomic response cannot navigate with the previous account result",async()=>{
  const data=makeDemo(),session=newCreationInviteSession();
  await assert.rejects(()=>atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{},async()=>{
    data.viewer_id="other-account";
    return {id:"old-account-beacon",event:"create_activity_with_invitees",committed:true,invited_ids:["jordan"]};
  },()=>"original-owner-request"),/account/);
  assert.equal(session.createdId,null); assert.equal(session.atomicAttempt?.requestId,"original-owner-request");
});

test("server actor mismatch cannot discard an ambiguous original-account request",async()=>{
  const data=makeDemo(),session=newCreationInviteSession();
  await assert.rejects(()=>atomicCreateAndInvite(session,["jordan"],()=>data,DEMO_ID,"create_activity_with_invitees",{},async()=>{throw Object.assign(new Error("Your account changed before publication."),{definitive:true});},()=>"owner-request"),/account changed/);
  assert.equal(session.atomicAttempt?.requestId,"owner-request");
  assert.equal(session.atomicAttempt?.payload.expected_actor_id,DEMO_ID);
});
