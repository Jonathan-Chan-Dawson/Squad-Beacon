import assert from "node:assert/strict";
import { test } from "node:test";
import { guestDatabase, guestIds } from "./guestDatabase";

test("map icons are host-managed and exposed publicly only after explicit sharing", async () => {
  const { db, role, beacon } = await guestDatabase();
  try {
    const id = await beacon();
    const setIcon = (map_icon: string | null, map_icon_public: boolean) =>
      db.query("select public.beacon_action('set_beacon_map_icon',$1::jsonb)", [
        JSON.stringify({ id, map_icon, map_icon_public }),
      ]);
    const publicIcons = async () =>
      (
        await db.query(
          "select * from public.public_beacon_map_icons(array[$1::uuid])",
          [id],
        )
      ).rows;
    await role("authenticated", guestIds.member);
    await assert.rejects(setIcon("food", true), /unavailable for editing/);
    await role("authenticated", guestIds.host);
    await assert.rejects(
      setIcon("https://example.com/image.jpg", true),
      /activity_map_icon_valid/,
    );
    await setIcon("trophy", false);
    await db.query(
      "select public.set_beacon_discovery($1,true,'Auburn',32.6,-85.48)",
      [id],
    );
    await role("authenticated", guestIds.member);
    assert.deepEqual(await publicIcons(), []);
    await role("authenticated", guestIds.host);
    await setIcon("trophy", true);
    await role("authenticated", guestIds.member);
    assert.deepEqual(await publicIcons(), [
      { activity_id: id, map_icon: "trophy" },
    ]);
    await role("authenticated", guestIds.host);
    await setIcon(null, false);
    assert.deepEqual(await publicIcons(), []);
  } finally {
    await db.close();
  }
});

test("topic assignment is official-source scoped and revoked visibility redacts a follow", async () => {
  const { db, role, beacon } = await guestDatabase();
  try {
    const id = await beacon();
    const squad = crypto.randomUUID();
    const otherSquad = crypto.randomUUID();
    for (const entity of [squad, otherSquad]) {
      await db.query(
        "insert into public.squads(id,owner_id,name) values($1,$2,'Test Squad')",
        [entity, guestIds.host],
      );
      await db.query(
        "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')",
        [entity, guestIds.host, guestIds.member],
      );
    }
    const action = async (name: string, payload: object, request = crypto.randomUUID()) =>
      (
        await db.query<{ result: Record<string, string> }>(
          "select public.beacon_action($1,$2::jsonb,$3::uuid) result",
          [name, JSON.stringify(payload), request],
        )
      ).rows[0].result;
    const snapshot = async () =>
      (
        await db.query<{
          result: {
            beacon_topic_follows: unknown[];
            beacon_topic_assignments: { activity_id: string; topic_id: string }[];
          };
        }>("select public.beacon_snapshot() result")
      ).rows[0].result;
    const scope = { entity_type: "squad", entity_id: squad };
    await role("authenticated", guestIds.member);
    await assert.rejects(
      action("save_beacon_topic", { ...scope, name: "Tournaments" }),
      /cannot manage/,
    );
    await role("authenticated", guestIds.host);
    await action("set_social_association", { ...scope, activity_id: id });
    const topic = (
      await action("save_beacon_topic", { ...scope, name: "Tournaments" })
    ).topic_id;
    const foreignTopic = (
      await action("save_beacon_topic", {
        ...scope,
        entity_id: otherSquad,
        name: "Practice",
      })
    ).topic_id;
    await assert.rejects(
      action("set_beacon_topic", { id, beacon_topic_id: foreignTopic }),
      /active topic/,
    );
    await action("set_beacon_topic", { id, beacon_topic_id: topic });
    const publication = {
      title: "Tournament finals",
      category: "Fitness",
      mode: "squad",
      starts_at: new Date(Date.now() + 3_600_000).toISOString(),
      ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      timezone: "UTC",
      audience: "friends",
      social_entity_type: "squad",
      social_entity_id: squad,
      invitee_ids: [guestIds.member],
      map_icon: "trophy",
      beacon_topic_id: topic,
    };
    const request = crypto.randomUUID();
    const created = await action("create_activity_with_invitees", publication, request);
    assert.equal((await action("create_activity_with_invitees", publication, request)).id, created.id);
    assert.equal((await db.query("select map_icon from public.activities where id=$1", [created.id])).rows[0].map_icon, "trophy");
    await role("authenticated", guestIds.member);
    await action("follow_beacon_topic", { beacon_topic_id: topic });
    await action("follow_beacon_topic", { beacon_topic_id: topic });
    assert.equal((await snapshot()).beacon_topic_follows.length, 1);
    const assignments = (await snapshot()).beacon_topic_assignments;
    assert.deepEqual(new Set(assignments.map(row => row.activity_id)), new Set([id, created.id]));
    assert.ok(assignments.every(row => row.topic_id === topic));
    await role("root");
    await db.query("delete from public.squad_members where squad_id=$1 and user_id=$2", [squad, guestIds.member]);
    await role("authenticated", guestIds.member);
    assert.deepEqual((await snapshot()).beacon_topic_assignments, []);
    assert.match(JSON.stringify((await snapshot()).beacon_topic_follows), /"name":null/);
    await role("root");
    await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'member')", [squad, guestIds.member]);
    await role("authenticated", guestIds.host);
    assert.deepEqual((await snapshot()).beacon_topic_follows, []);
    await action("archive_beacon_topic", { ...scope, beacon_topic_id: topic });
    await role("authenticated", guestIds.member);
    assert.deepEqual((await snapshot()).beacon_topic_assignments, []);
    assert.match(
      JSON.stringify((await snapshot()).beacon_topic_follows),
      /"name":null/,
    );
    assert.doesNotMatch(
      JSON.stringify((await snapshot()).beacon_topic_follows),
      /Tournaments/,
    );
  } finally {
    await db.close();
  }
});
