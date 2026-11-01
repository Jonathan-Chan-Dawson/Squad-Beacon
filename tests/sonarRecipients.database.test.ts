import test from "node:test";
import assert from "node:assert/strict";
import { guestDatabase, guestIds } from "./guestDatabase";

test("Sonar saves unlimited accepted recipients while retaining privacy and expiry checks", async () => {
  const { db, role } = await guestDatabase();
  try {
    const recipients = Array.from({ length: 100 }, () => crypto.randomUUID());
    for (const [index, id] of recipients.entries()) {
      await db.query("insert into auth.users values($1,now())", [id]);
      await db.query("insert into public.profiles(id,username,name) values($1,$2,$2)", [id, `sonar${index}`]);
      await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')", [guestIds.host, id]);
    }
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const action = async (selected: string[], expiration = expiresAt, requestId = crypto.randomUUID()) =>
      (await db.query<{ result: { id: string; expires_at: string } }>(
        "select public.beacon_action('start_location',$1::jsonb,$2::uuid) result",
        [JSON.stringify({ recipients: selected, expires_at: expiration }), requestId],
      )).rows[0].result;
    await role("authenticated", guestIds.host);
    const requestId = crypto.randomUUID();
    const saved = await action(recipients, expiresAt, requestId);
    assert.deepEqual(await action(recipients, expiresAt, requestId), saved);
    await role("root");
    assert.equal((await db.query("select * from private.location_recipients where session_id=$1", [saved.id])).rows.length, 100);
    await role("authenticated", guestIds.host);
    await assert.rejects(action([]), /at least one accepted friend/);
    await assert.rejects(action([...recipients, guestIds.other]), /accepted friends/);
    await assert.rejects(action(recipients, new Date(Date.now() + 25 * 3600000).toISOString()), /24 hours/);
    // A rejected update must preserve the previously authorized session.
    await role("root");
    assert.equal((await db.query("select id from public.locations where owner_id=$1", [guestIds.host])).rows[0].id, saved.id);
    await db.query("insert into public.blocks values($1,$2)", [guestIds.host, recipients[99]]);
    await role("authenticated", guestIds.host);
    await assert.rejects(action(recipients), /accepted friends/);
  } finally {
    await db.close();
  }
});
