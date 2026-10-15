import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("messaging migration backfills private reads and protects lists and canonical boundaries", async () => {
  const db = new PGlite();
  const owner = "a1111111-1111-4111-8111-111111111111";
  const peer = "b2222222-2222-4222-8222-222222222222";
  const stranger = "c3333333-3333-4333-8333-333333333333";
  const messageA = "10000000-0000-4000-8000-000000000001";
  const messageB = "10000000-0000-4000-8000-000000000002";
  const messageC = "10000000-0000-4000-8000-000000000003";
  const migrationName = "202610140003_messaging_hub.sql";
  async function root() {
    await db.exec("reset role");
  }
  async function actor(id: string) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  async function action(
    name: string,
    payload: Record<string, unknown>,
    request = crypto.randomUUID(),
  ) {
    return (
      await db.query<{ result: Record<string, unknown> }>(
        "select public.beacon_action($1,$2::jsonb,$3::uuid) result",
        [name, JSON.stringify(payload), request],
      )
    ).rows[0].result;
  }
  async function migrate(file: string) {
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ).replace("create extension if not exists pgcrypto;", ""),
    );
  }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
      grant usage on schema auth,public to authenticated,anon,service_role;
      grant execute on function auth.uid(),auth.role() to authenticated,anon,service_role;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb not null default '{}'::jsonb);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
      create publication supabase_realtime;
    `);
    for (const file of readdirSync(
      new URL("../supabase/migrations/", import.meta.url),
    )
      .filter((file) => file.endsWith(".sql") && file < migrationName)
      .sort())
      await migrate(file);
    for (const [id, name] of [
      [owner, "owner"],
      [peer, "peer"],
      [stranger, "stranger"],
    ]) {
      await db.query("insert into auth.users values($1,now())", [id]);
      await db.query(
        "insert into public.profiles(id,username,name) values($1,$2,$2)",
        [id, name],
      );
      await db.query(
        "insert into private.accounts(id,birth_date) values($1,'1990-01-01')",
        [id],
      );
    }
    await db.query(
      "insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted'),($2,$3,'accepted')",
      [owner, peer, stranger],
    );
    for (const id of [messageA, messageB])
      await db.query(
        "insert into public.messages(id,author_id,recipient_id,body,created_at) values($1,$2,$3,'Before rollout','2026-10-14T10:00:00Z')",
        [id, peer, owner],
      );
    await migrate(migrationName);
    await actor(owner);
    let markers = (
      await db.query<{ last_read_message_id: string }>(
        "select * from public.dm_message_reads",
      )
    ).rows;
    assert.equal(markers.length, 1);
    assert.equal(markers[0].last_read_message_id, messageB);
    const snapshot = (
      await db.query<{ result: { dm_message_reads: unknown[] } }>(
        "select public.beacon_snapshot() result",
      )
    ).rows[0].result;
    assert.equal(snapshot.dm_message_reads.length, 1);
    await assert.rejects(
      db.query("delete from public.dm_message_reads"),
      /permission denied/,
    );
    await actor(stranger);
    assert.equal(
      (await db.query("select * from public.dm_message_reads")).rows.length,
      0,
    );
    await assert.rejects(
      action("mark_dm_chat_read", { peer_id: owner, message_id: messageB }),
      /unavailable/,
    );
    await root();
    await db.query(
      "insert into public.messages(id,author_id,recipient_id,body,created_at) values($1,$2,$3,'After rollout','2026-10-14T10:00:00Z')",
      [messageC, peer, owner],
    );
    await actor(owner);
    await action("mark_dm_chat_read", { peer_id: peer, message_id: messageC });
    await action("mark_dm_chat_read", { peer_id: peer, message_id: messageA });
    markers = (
      await db.query<{ last_read_message_id: string }>(
        "select * from public.dm_message_reads",
      )
    ).rows;
    assert.equal(markers[0].last_read_message_id, messageC);
    await assert.rejects(
      action("mark_dm_chat_read", {
        peer_id: peer,
        message_id: crypto.randomUUID(),
      }),
      /message from this conversation/,
    );
    const request = crypto.randomUUID();
    const created = await action(
      "create_list",
      { name: "  Study Friends  " },
      request,
    );
    assert.deepEqual(
      await action("create_list", { name: "ignored" }, request),
      created,
    );
    const list = created.id as string;
    assert.equal(
      (
        await db.query<{ name: string }>(
          "select name from public.lists where id=$1",
          [list],
        )
      ).rows[0].name,
      "Study Friends",
    );
    await assert.rejects(
      action("create_list", { name: "Study Friends" }),
      /already/,
    );
    await assert.rejects(action("create_list", { name: " " }), /1–50/);
    await assert.rejects(
      action("rename_list", { id: list, name: "x".repeat(51) }),
      /1–50/,
    );
    await action("list_member", { id: list, user_id: peer, add: true });
    await assert.rejects(
      action("list_member", { id: list, user_id: stranger, add: true }),
      /accepted friend/,
    );
    await action("rename_list", { id: list, name: "Renamed" });
    await actor(peer);
    assert.equal(
      (await db.query("select * from public.lists where id=$1", [list])).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query("select * from public.list_members where list_id=$1", [
          list,
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      action("rename_list", { id: list, name: "Hijacked" }),
      /own private list/,
    );
    await assert.rejects(
      action("delete_list", { id: list }),
      /own private list/,
    );
    await root();
    await db.query(
      "insert into public.goals(owner_id,title,audience,audience_id) values($1,'Shared goal','list',$2)",
      [owner, list],
    );
    await actor(owner);
    await assert.rejects(
      action("delete_list", { id: list }),
      /still used for sharing/,
    );
    await root();
    await db.query("delete from public.goals where audience_id=$1", [list]);
    await db.query(
      "insert into private.profile_visibility_lists(owner_id,list_id) values($1,$2)",
      [owner, list],
    );
    await actor(owner);
    await assert.rejects(
      action("delete_list", { id: list }),
      /profile sharing/,
    );
    await root();
    await db.query(
      "delete from private.profile_visibility_lists where list_id=$1",
      [list],
    );
    await actor(owner);
    await action("delete_list", { id: list });
    assert.equal(
      (
        await db.query("select * from public.list_members where list_id=$1", [
          list,
        ])
      ).rows.length,
      0,
    );
    const squad = crypto.randomUUID();
    const groupA = crypto.randomUUID();
    const groupB = crypto.randomUUID();
    await root();
    await db.query(
      "insert into public.squads(id,owner_id,name) values($1,$2,'Crew')",
      [squad, owner],
    );
    await db.query(
      "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')",
      [squad, owner, peer],
    );
    await db.query(
      "insert into public.group_messages(id,scope,scope_id,squad_id,author_id,body,created_at) values($1,'squad',$2,$2,$3,'First','2026-10-14T10:00:00Z'),($4,'squad',$2,$2,$3,'Second','2026-10-14T11:00:00Z')",
      [groupA, squad, peer, groupB],
    );
    await actor(owner);
    await action("mark_group_chat_read", {
      scope: "squad",
      squad_id: squad,
      message_id: groupB,
    });
    await action("mark_group_chat_read", {
      scope: "squad",
      squad_id: squad,
      message_id: groupA,
    });
    assert.equal(
      (
        await db.query<{ last_read_message_id: string }>(
          "select * from public.group_message_reads where scope_id=$1",
          [squad],
        )
      ).rows[0].last_read_message_id,
      groupB,
    );
    const legacyRequest = crypto.randomUUID();
    const legacyRead = await action(
      "mark_group_chat_read",
      { scope: "squad", squad_id: squad },
      legacyRequest,
    );
    const laterMessage = crypto.randomUUID();
    await root();
    await db.query(
      "insert into public.group_messages(id,scope,scope_id,squad_id,author_id,body,created_at) values($1,'squad',$2,$2,$3,'Later',$4::timestamptz+interval '1 second')",
      [laterMessage, squad, peer, String(legacyRead.read_at)],
    );
    await actor(owner);
    await action("mark_group_chat_read", {
      scope: "squad",
      squad_id: squad,
      message_id: laterMessage,
    });
    await action(
      "mark_group_chat_read",
      { scope: "squad", squad_id: squad },
      legacyRequest,
    );
    assert.equal(
      (
        await db.query<{ last_read_message_id: string }>(
          "select last_read_message_id from public.group_message_reads where scope_id=$1",
          [squad],
        )
      ).rows[0].last_read_message_id,
      laterMessage,
    );
    await assert.rejects(
      action("mark_group_chat_read", {
        scope: "squad",
        squad_id: squad,
        message_id: messageC,
      }),
      /message from this group/,
    );
    await actor(stranger);
    await assert.rejects(
      action("mark_group_chat_read", {
        scope: "squad",
        squad_id: squad,
        message_id: groupB,
      }),
      /unavailable/,
    );
    await root();
    await db.query(
      "insert into public.blocks(blocker_id,blocked_id) values($1,$2)",
      [peer, owner],
    );
    await actor(owner);
    assert.equal(
      (await db.query("select * from public.dm_message_reads")).rows.length,
      0,
    );
    await assert.rejects(
      action("mark_dm_chat_read", { peer_id: peer, message_id: messageC }),
      /unavailable/,
    );
  } finally {
    await db.close();
  }
});
