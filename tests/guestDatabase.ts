import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const guestIds = {
  host: "a1111111-1111-4111-8111-111111111111",
  member: "b2222222-2222-4222-8222-222222222222",
  guest: "c3333333-3333-4333-8333-333333333333",
  other: "d4444444-4444-4444-8444-444444444444",
};
export async function guestDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb not null default '{}'::jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    create publication supabase_realtime;
  `);
  const migrations = join(process.cwd(),"supabase","migrations");
  for (const file of readdirSync(migrations).filter(f => f.endsWith(".sql")).sort()) {
    try { await db.exec(readFileSync(join(migrations,file),"utf8").replace("create extension if not exists pgcrypto;","")); }
    catch(error) { throw new Error(`${file}: ${(error as Error).message}`); }
  }
  for (const id of Object.values(guestIds)) await db.query("insert into auth.users values($1,now())",[id]);
  for (const key of ["host","member"] as const) {
    await db.query("insert into public.profiles(id,username,name) values($1,$2,$2)",[guestIds[key],key]);
    await db.query("insert into private.accounts(id,birth_date) values($1,'1990-01-01')",[guestIds[key]]);
  }
  await db.query("insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted')",[guestIds.host,guestIds.member]);
  const role = async (name: "root" | "service_role" | "authenticated", id?: string) => {
    await db.exec("reset role");
    if(name !== "root") await db.exec(`set role ${name}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || ""]);
  };
  const rpc = async (name: string, values: unknown[]) => {
    if (!/^guest_[a-z_]+$/.test(name)) throw new Error("Expected guest RPC");
    return (await db.query<{ result: any }>(`select public.${name}(${values.map((_,i)=>`$${i+1}`).join(",")}) result`,values.map(v => v && typeof v === "object" ? JSON.stringify(v) : v))).rows[0].result;
  };
  const beacon = async (approval = false, capacity = 2) => {
    await role("root");
    const id = crypto.randomUUID();
    await db.query("insert into public.activities(id,owner_id,title,description,category,mode,starts_at,ends_at,audience,timezone,approval_required,capacity_limit,capacity_policy) values($1,$2,'Private original title','PRIVATE DESCRIPTION','Study','squad',now()+interval '1 hour',now()+interval '2 hours','friends','UTC',$3,$4,'strict')",[id,guestIds.host,approval,capacity]);
    await db.query("insert into public.places(activity_id,label,latitude,longitude) values($1,'SECRET VENUE',40,-90)",[id]);
    return id;
  };
  const share = async (id: string, hash: string, access = "participate", kind = "beacon", settings = {}) => {
    await role("service_role");
    return rpc("guest_share_manage",[guestIds.host,"enable",kind,id,{ access,preview_title:"Shared invitation",preview_description:"Bring a book",...settings },hash]);
  };
  return { db,role,rpc,beacon,share };
}
