import { test } from "node:test";
import assert from "node:assert/strict";
import { guestDatabase, guestIds } from "./guestDatabase";
import {
  beaconScoreTier,
  applyScoreTaps,
  scoreRewards,
} from "../src/features/profile/beaconScore";

test("Beacon Score settles eligible activity once and only shares opted-in tiers", async () => {
  const { db, role, beacon } = await guestDatabase();
  try {
    const { host, member } = guestIds;
    const finished = await beacon();
    const canceled = await beacon();
    const rsvpOnly = await beacon();
    const stream = crypto.randomUUID();
    const second = crypto.randomUUID();
    const sync = async (
      owner: string,
      taps: number,
      legacy = 0,
      badge: boolean | null = null,
      id = stream,
    ) =>
      (
        await db.query<{
          result: {
            total: number;
            credited: number;
            tap_remainder: number;
            rewards: typeof scoreRewards;
            history: { kind: string; points: number }[];
          };
        }>("select public.sync_beacon_score($1,$2,$3,$4,$5) result", [
          owner,
          id,
          taps,
          legacy,
          badge,
        ])
      ).rows[0].result;
    await db.exec(
      "update private.beacon_score_launch set launched_at=now()-interval '3 days'",
    );
    await db.query(
      "update public.activities set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour', status=case when id=$2 then 'cancelled' else 'completed' end where id in ($1,$2,$3)",
      [finished, canceled, rsvpOnly],
    );
    for (const id of [finished, canceled, rsvpOnly]) {
      await db.query(
        "insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,'going',true)",
        [id, member],
      );
    }
    await db.query(
      "insert into public.beacon_attendance(activity_id,user_id,state) values($1,$2,'present'),($1,$3,'present'),($4,$3,'present')",
      [finished, host, member, canceled],
    );
    await db.query(
      "insert into private.beacon_attendee_details(activity_id,user_id,checked_in_at) values($1,$2,now())",
      [finished, member],
    );
    await db.query(
      "insert into public.messages(author_id,recipient_id,body) values ($1,$2,'Hello'),($2,$1,'Hi')",
      [host, member],
    );
    await db.query(
      "insert into public.messages(activity_id,author_id,body) values ($1,$2,'Guest message'),($1,$3,'Host message'),($4,$2,'Canceled message')",
      [finished, member, host, canceled],
    );
    await db.query(
      "insert into public.comments(activity_id,author_id,body) values ($1,$2,'Guest comment'),($1,$3,'Host comment'),($4,$2,'Canceled comment')",
      [finished, member, host, canceled],
    );
    await db.query(
      "insert into public.reactions(activity_id,user_id) values ($1,$2),($1,$3),($4,$2)",
      [finished, member, host, canceled],
    );

    await role("authenticated", member);
    const attended = await sync(member, 12, 3);
    assert.equal(attended.total, 2506);
    assert.deepEqual(attended.rewards, scoreRewards);
    assert.deepEqual(attended.history.map(({ kind }) => kind).sort(), [
      "attend",
      "friend",
      "legacy",
      "tap",
    ]);
    assert.equal((await sync(member, 12, 99)).total, 2506);
    assert.equal((await sync(member, 4)).credited, 12);
    const otherDevice = await sync(member, 7, 99, null, second);
    assert.equal(otherDevice.total, 2507);
    assert.equal(otherDevice.tap_remainder, 3);
    assert.equal((await sync(member, 13)).total, 2508);
    await assert.rejects(sync(host, 10), /Sign in/);
    await assert.rejects(sync(member, -1), /Invalid tap progress/);
    await assert.rejects(
      db.exec("select * from private.beacon_score_awards"),
      /permission denied/,
    );

    await role("authenticated", host);
    const hostStream = await sync(host, 0);
    assert.equal(hostStream.total, 3242);
    await role("authenticated", member);
    const tier = () =>
      db.query<{ tier: number | null }>(
        "select public.beacon_score_profile_tier($1) tier",
        [host],
      );
    assert.equal((await tier()).rows[0].tier, null);
    await role("authenticated", host);
    const hosted = await sync(host, 0, 0, true);
    assert.equal(hosted.total, 3242);
    assert.deepEqual(hosted.history.map(({ kind }) => kind).sort(), [
      "attend",
      "comment",
      "friend",
      "host",
      "joined",
      "joined",
      "message",
      "reaction",
    ]);
    await role("authenticated", member);
    assert.equal(
      (await tier()).rows[0].tier,
      beaconScoreTier(hosted.total).index,
    );
    await role("authenticated", host);
    assert.equal((await sync(host, 1, 4_996_757)).total, 5_000_000);
    await role("authenticated", member);
    assert.equal((await tier()).rows[0].tier, 49);
    await role("root");
    await db.query(
      "update public.profiles set profile_visibility='custom' where id=$1",
      [host],
    );
    await role("authenticated", member);
    assert.equal((await tier()).rows[0].tier, null);
    await role("root");
    await db.exec("delete from private.beacon_score_awards; delete from private.beacon_score_streams; delete from private.beacon_score_settings; update private.beacon_score_launch set launched_at=now()+interval '1 day'");
    await role("authenticated", member);
    const firstTaps = await sync(member, 7);
    assert.equal(firstTaps.total, 0);
    assert.equal(firstTaps.tap_remainder, 7);
    assert.equal((await sync(member, 1, 0, null, second)).total, 1);
    for (const count of [166, 565, 1800, 50_000, 220_000, 900_000]) {
      const expected = applyScoreTaps(0, count + 1);
      const actual = await sync(member, count);
      assert.equal(actual.total, expected.points);
      assert.equal(actual.tap_remainder, expected.remaining);
    }
    await role("root");
    await db.exec("set role anon");
    await assert.rejects(tier(), /permission denied/);
  } finally {
    await db.close();
  }
});
