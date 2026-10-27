import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("ordered migrations: owner progress, reliable entry evidence and atomic first-success claims", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
      grant usage on schema auth,public to authenticated,anon,service_role;
      grant execute on function auth.uid() to authenticated,anon,service_role;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:1]$$;
      create publication supabase_realtime;
    `);
    const a = "91111111-1111-4111-8111-111111111111",
      b = "92222222-2222-4222-8222-222222222222";
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const name of readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      if (name.endsWith("_onboarding_progress.sql")) {
        await db.query("insert into auth.users values($1,now())", [a]);
        await db.query(
          "insert into public.profiles(id,username,name) values($1,'older','Older')",
          [a],
        );
      }
      await db.exec(
        readFileSync(new URL(name, dir), "utf8").replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
    }
    await db.query("insert into auth.users values($1,now())", [b]);
    await db.query(
      "insert into public.profiles(id,username,name) values($1,'newer','Newer')",
      [b],
    );
    assert.equal(
      (
        await db.query(
          "select * from public.onboarding_progress where user_id=$1",
          [a],
        )
      ).rows.length,
      0,
      "old empty profile is not new",
    );
    assert.equal(
      (
        await db.query(
          "select * from public.onboarding_progress where user_id=$1",
          [b],
        )
      ).rows.length,
      1,
    );
    let currentViewer = a;
    const actor = async (id: string) => {
      currentViewer = id;
      await db.exec("reset role;set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    const claim = async (key: string, expectedViewer = currentViewer) =>
      (
        await db.query<{ claimed: boolean }>(
          "select public.claim_onboarding_progress($1,$2::uuid) claimed",
          [key, expectedViewer],
        )
      ).rows[0].claimed;
    await actor(b);
    await assert.rejects(claim("tip.vote.v1", a), /account changed/);
    assert.equal(
      (await db.query("select * from public.onboarding_progress")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        "insert into public.onboarding_progress(user_id,key) values($1,'tip.ping.v1')",
        [a],
      ),
    );
    await assert.rejects(claim("entry.eligible.v1"));
    await assert.rejects(claim("invalid"));
    const results = await Promise.all([
      claim("tip.ping.v1"),
      claim("tip.ping.v1"),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.equal(
      await claim("success.firstBeacon.v1"),
      false,
      "no transaction, no achievement",
    );
    await db.exec("reset role");
    await db.query(
      "insert into public.activities(owner_id,title,category,mode,audience,starts_at,ends_at,timezone) values($1,'First','Social','squad','friends',now(),now()+interval '1 hour','UTC')",
      [b],
    );
    await actor(b);
    assert.equal(await claim("success.firstBeacon.v1"), true);
    assert.equal(await claim("success.firstBeacon.v1"), false);
    await assert.rejects(
      db.query("update public.onboarding_progress set key='tip.vote.v1'"),
    );
    await db.exec("reset role");
    await db.query(
      "update public.activities set status='completed' where owner_id=$1",
      [b],
    );
    await db.query(
      "insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')",
      [a, b],
    );
    await actor(b);
    assert.equal(await claim("success.firstCompletion.v1"), true);
    assert.equal(await claim("success.firstCompletion.v1"), false);
    assert.equal(await claim("success.firstConnection.v1"), true);
    assert.equal(await claim("success.firstConnection.v1"), false);
    await actor(a);
    assert.equal(
      (await db.query("select * from public.onboarding_progress")).rows.length,
      0,
      "another account cannot see progress",
    );
    assert.equal(
      await claim("success.firstBeacon.v1"),
      false,
      "unknown first-entry history is conservative",
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(db.query("select * from public.onboarding_progress"));
    await assert.rejects(claim("tip.vote.v1"));
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [b]);
    assert.equal(
      (
        await db.query(
          "select * from public.onboarding_progress where user_id=$1",
          [b],
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
