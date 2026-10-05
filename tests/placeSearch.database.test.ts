import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("place-search budget is server-only, atomic and stores no queries", async () => {
  const db = new PGlite();
  const id = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema private; create table public.profiles(id uuid primary key);
      insert into public.profiles values ('${id}');`);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610040005_places_search_budget.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.reserve_places_search($1)", [id]),
      /permission denied/,
    );
    await db.exec("reset role; set role service_role");
    for (let n = 0; n < 30; n++)
      await db.query("select public.reserve_places_search($1)", [id]);
    await assert.rejects(
      db.query("select public.reserve_places_search($1)", [id]),
      /Too many place searches/,
    );
    await db.exec("reset role");
    const result = await db.query<{ bucket: string; hits: number }>(
      "select bucket,hits from private.places_search_budgets order by bucket",
    );
    assert.equal(result.rows.length, 2);
    assert.ok(result.rows.every((row) => row.hits === 30));
    const fields = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='private' and table_name='places_search_budgets' order by ordinal_position",
    );
    assert.deepEqual(
      fields.rows.map((row) => row.column_name),
      ["bucket", "hour", "hits"],
    );
    await db.query(
      "update private.places_search_budgets set hits=1000 where bucket='app'",
    );
    await db.exec("set role service_role");
    await assert.rejects(
      db.query("select public.reserve_places_search($1)", [id]),
      /Place search is busy/,
    );
  } finally {
    await db.close();
  }
});
