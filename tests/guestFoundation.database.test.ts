import test from "node:test";
import assert from "node:assert/strict";
import { guestDatabase,guestIds as ids } from "./guestDatabase";

test("Phase 5.1 canonical guest participation and member isolation", async t => {
  const { db,role,rpc,beacon,share } = await guestDatabase();
  const hash = "a".repeat(64), secondHash = "b".repeat(64);
  const respond = (link = hash, actor = ids.guest, status = "going", request = crypto.randomUUID()) => rpc("guest_respond",[link,actor,"rsvp",{ status },request]);
  try {
    await t.test("service-only identity and age eligibility", async () => {
      await role("service_role");
      await assert.rejects(rpc("guest_identity",[ids.guest,"Guest","2020-01-01"]),/16 and older/);
      await rpc("guest_identity",[ids.guest,"Guest","1990-01-01"]);
      await rpc("guest_identity",[ids.other,"Other","1990-01-01"]);
      await role("root");
      assert.equal((await db.query("select * from public.profiles where id=$1",[ids.guest])).rows.length,0);
      await role("authenticated",ids.guest);
      await assert.rejects(rpc("guest_identity",[ids.host,"Impersonator","1990-01-01"]),/permission denied/);
    });
    const target = await beacon();
    await share(target,hash);
    await t.test("minimal projection and idempotent canonical RSVP", async () => {
      await role("service_role");
      const before = await rpc("guest_preview",[hash,null]);
      assert.equal(before.title,"Shared invitation");
      assert.ok(!JSON.stringify(before).includes("PRIVATE")); assert.ok(!JSON.stringify(before).includes("SECRET"));
      const key = crypto.randomUUID();
      assert.deepEqual(await respond(hash,ids.guest,"going",key),await respond(hash,ids.guest,"going",key));
      await assert.rejects(respond(hash,ids.guest,"interested",key),/already used/);
      await role("root");
      const rows = (await db.query("select * from public.rsvps where activity_id=$1",[target])).rows;
      assert.equal(rows.length,1); assert.equal(rows[0].user_id,ids.guest);
    });
    await t.test("member and guest admission share atomic capacity including the host", async () => {
      await role("service_role");
      assert.equal((await rpc("guest_preview",[hash,ids.guest])).seat_count,2);
      await assert.rejects(respond(hash,ids.other),/full/);
      await role("authenticated",ids.member);
      await assert.rejects(db.query("select public.beacon_action('rsvp',$1,gen_random_uuid())",[{ id:target,status:"going" }]),/full/);
      await role("service_role");
      await respond(hash,ids.guest,"declined");
      const results = await Promise.allSettled([respond(hash,ids.guest),respond(hash,ids.other)]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    });
    await t.test("approved guest JWT cannot read member event, venue, profile or chat", async () => {
      await role("authenticated",ids.guest);
      for (const table of ["activities","places","profiles","comments","locations"]) {
        assert.equal((await db.query(`select ${table === 'profiles' ? 'id,name,username' : '*'} from public.${table}`)).rows.length,0,table);
      }
      await assert.rejects(rpc("guest_respond",[hash,ids.host,"rsvp",{status:"going"},crypto.randomUUID()]),/permission denied/);
      await assert.rejects(db.query("select public.beacon_action('save_profile','{}',gen_random_uuid())"),/profile|account/i);
      const snapshot = (await db.query<{ result: any }>("select public.beacon_snapshot() result")).rows[0].result;
      for (const field of ["activities","places","profiles","comments","locations","planning_threads"]) assert.equal(snapshot[field]?.length ?? 0,0,`guest snapshot ${field}`);
    });
    const approvalTarget = await beacon(true,3);
    await share(approvalTarget,secondHash);
    await t.test("approval, host management and permanent guest removal", async () => {
      assert.equal((await respond(secondHash)).response,"requested");
      let guests = (await rpc("guest_attendance",[ids.host,approvalTarget,null,"read"])).guests;
      assert.equal(guests[0].response,"requested");
      await assert.rejects(rpc("guest_attendance",[ids.member,approvalTarget,ids.guest,"approve"]),/Organizer/);
      await rpc("guest_attendance",[ids.host,approvalTarget,ids.guest,"approve"]);
      guests = (await rpc("guest_attendance",[ids.host,approvalTarget,null,"read"])).guests;
      assert.equal(guests[0].approved,true);
      await role("authenticated",ids.guest);
      assert.equal((await db.query("select * from public.activities where id=$1",[approvalTarget])).rows.length,0);
      await role("service_role");
      await rpc("guest_attendance",[ids.host,approvalTarget,ids.guest,"remove"]);
      await assert.rejects(respond(secondHash),/unavailable/);
      await share(approvalTarget,"c".repeat(64));
      await assert.rejects(respond("c".repeat(64)),/unavailable/);
    });
    await t.test("preview-only, expired, revoked and blocked invitations fail closed", async () => {
      const previewTarget=await beacon();
      await share(previewTarget,"d".repeat(64),"preview");
      await assert.rejects(respond("d".repeat(64)),/unavailable/);
      await rpc("guest_share_manage",[ids.host,"revoke","beacon",previewTarget,{},null]);
      assert.equal((await rpc("guest_preview",["d".repeat(64),null])).state,"unavailable");
      await role("root");
      await db.query("update private.guest_shares set expires_at=now()-interval '1 second' where token_hash=$1",[hash]);
      await role("service_role");
      await assert.rejects(respond(),/unavailable/);
      await assert.rejects(share(previewTarget,"e".repeat(64),"participate","beacon",{expires_at:"2020-01-01"}),/future expiry/);
    });
    await t.test("removing a member profile retains the original participation cascade", async () => {
      const cleanup = await beacon(false,4);
      await role("root");
      await db.query("insert into public.rsvps(activity_id,user_id,status) values($1,$2,'interested')",[cleanup,ids.member]);
      await db.query("delete from public.profiles where id=$1",[ids.member]);
      assert.equal((await db.query("select * from public.rsvps where user_id=$1",[ids.member])).rows.length,0);
    });
    await t.test("cancelled event updates remain readable and its owner can still revoke", async () => {
      const cancelled = await beacon();
      const cancelledHash = "f".repeat(64);
      await share(cancelled,cancelledHash);
      await role("root");
      await db.query("update public.activities set status='cancelled' where id=$1",[cancelled]);
      await role("service_role");
      assert.equal((await rpc("guest_preview",[cancelledHash,null])).state,"cancelled");
      await assert.rejects(respond(cancelledHash),/closed/);
      await rpc("guest_share_manage",[ids.host,"revoke","beacon",cancelled,{},null]);
      assert.equal((await rpc("guest_preview",[cancelledHash,null])).state,"unavailable");
    });
  } finally { await db.close(); }
});
