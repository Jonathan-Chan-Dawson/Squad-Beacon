import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("Phase F ordered migrations enforce agenda, graph, privacy and replay boundaries", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
      grant usage on schema auth,public to authenticated,anon,service_role;
      grant execute on function auth.uid() to authenticated,anon,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:1]$$;
      create publication supabase_realtime;`);
    for (const file of readdirSync(
      new URL("../supabase/migrations/", import.meta.url),
    )
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      try {
        await db.exec(
          readFileSync(
            new URL("../supabase/migrations/" + file, import.meta.url),
            "utf8",
          ).replace("create extension if not exists pgcrypto;", ""),
        );
      } catch (e) {
        throw new Error(file + ": " + (e as Error).message);
      }
    }
    const alice = "91111111-1111-4111-8111-111111111111",
      bob = "92222222-2222-4222-8222-222222222222";
    for (const [id, name] of [
      [alice, "alice"],
      [bob, "bob"],
    ]) {
      await db.query("insert into auth.users values($1,now())", [id]);
      await db.query(
        "insert into public.profiles(id,username,name) values($1,$2,$2)",
        [id, name],
      );
    }
    const actor = async (id: string) => {
      await db.exec("reset role; set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    const action = async (name: string, p: object, request?: string) =>
      (
        await db.query<{ r: any }>(
          "select public.beacon_action($1,$2::jsonb,coalesce($3::uuid,gen_random_uuid())) r",
          [name, JSON.stringify(p), request ?? null],
        )
      ).rows[0].r;
    const snapshot = async () =>
      (await db.query<{ s: any }>("select public.beacon_snapshot() s")).rows[0]
        .s;
    await actor(alice);
    const a = await action("create_activity", {
      enable_checklist: true,
      enable_focus: true,
      enable_scoreboard: true,
      title: "Tournament",
      category: "Fitness",
      mode: "squad",
      audience: "friends",
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
      timezone: "America/Chicago",
      location_type: "none",
    });
    const aid = a.id ?? a.activity_id;
    const agenda = {
      enabled: true,
      steps: [
        {
          id: "prep",
          label: "Prepare",
          offset: -30,
          minutes: 15,
          reminder: null,
          organizer: null,
          tasks: [],
          state: "planned",
        },
      ],
    };
    await assert.rejects(
      action("save_tool_config", {
        activity_id: aid,
        kind: "agenda",
        settings: { agenda },
        revision: -1,
      }),
      /PREMIUM_REQUIRED/,
    );
    await db.exec("reset role");
    await db.query(
      "insert into private.premium_grants(owner_id,tier,valid_until) values($1,'pro',now()+interval '1 day')",
      [alice],
    );
    await actor(alice);
    const request = "93333333-3333-4333-8333-333333333333";
    const saved = await action(
      "save_tool_config",
      { activity_id: aid, kind: "agenda", settings: { agenda }, revision: -1 },
      request,
    );
    assert.deepEqual(
      await action(
        "save_tool_config",
        {
          activity_id: aid,
          kind: "agenda",
          settings: { agenda },
          revision: -1,
        },
        request,
      ),
      saved,
    );
    await assert.rejects(
      action("save_tool_config", {
        activity_id: aid,
        kind: "agenda",
        settings: { agenda },
        revision: -1,
      }),
      /changed/,
    );
    const t1 = await action("add_checklist_item", {
      activity_id: aid,
      text: "Equipment",
    });
    const t2 = await action("add_checklist_item", {
      activity_id: aid,
      text: "Warm up",
    });
    await action("save_task_coordination", {
      id: t2.id,
      priority: "high",
      prerequisite_id: t1.id,
      revision: 0,
    });
    await assert.rejects(
      action("save_task_coordination", {
        id: t1.id,
        priority: "normal",
        prerequisite_id: t2.id,
        revision: 0,
      }),
      /cycle/,
    );
    assert.equal((await snapshot()).capabilities.beacon_expansion, true);
    const hosting = {
      enabled: true,
      questions: [{ id: "diet", label: "Dietary needs" }],
      groups: ["Red", "Blue"],
      check_in: true,
      coordinators: [],
    };
    await action("save_tool_config", {
      activity_id: aid,
      kind: "hosting",
      settings: { hosting },
      revision: -1,
    });
    await action("save_rsvp_answers", {
      activity_id: aid,
      answers: { diet: "Private answer" },
      revision: -1,
    });
    await action("save_host_record", {
      activity_id: aid,
      user_id: alice,
      organizer_note: "Private organizer note",
      group_label: "Red",
      checked_in: true,
      revision: 0,
    });
    assert.equal(
      (await snapshot()).attendee_details[0].organizer_note,
      "Private organizer note",
    );
    await actor(bob);
    assert.equal(
      (await snapshot()).premium_tool_configs.some(
        (c: any) => c.activity_id === aid,
      ),
      false,
    );
    await assert.rejects(
      action("save_task_coordination", {
        id: t2.id,
        priority: "normal",
        prerequisite_id: null,
        revision: 1,
      }),
      /unavailable/,
    );
    await db.exec("reset role");
    await db.query(
      "insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,'going',true)",
      [aid, bob],
    );
    await actor(bob);
    const participantSnapshot = await snapshot();
    assert.equal(
      participantSnapshot.attendee_details.find((r: any) => r.user_id === alice)
        .answers,
      undefined,
    );
    assert.equal(
      participantSnapshot.attendee_details.find((r: any) => r.user_id === alice)
        .organizer_note,
      undefined,
    );
    await action("save_rsvp_answers", {
      activity_id: aid,
      answers: { diet: "Bob answer" },
      revision: -1,
    });
    await assert.rejects(
      action("save_host_record", {
        activity_id: aid,
        user_id: alice,
        organizer_note: "Leaked",
        group_label: null,
        revision: 1,
      }),
      /Organizer access/,
    );
    await action("set_agenda_reminders", {
      activity_id: aid,
      reminders: false,
      revision: 0,
    });
    await actor(alice);
    assert.equal(
      (await snapshot()).attendee_details.find((r: any) => r.user_id === bob)
        .answers.diet,
      "Bob answer",
    );
    await db.exec("reset role");
    await db.query("update public.activities set starts_at=now() where id=$1", [
      aid,
    ]);
    await db.query(
      "update private.premium_tool_configs set settings=jsonb_set(settings,'{agenda,steps,0,offset}','0') where activity_id=$1 and kind='agenda'",
      [aid],
    );
    await db.query(
      "update private.premium_tool_configs set settings=jsonb_set(settings,'{agenda,steps,0,reminder}','30') where activity_id=$1 and kind='agenda'",
      [aid],
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select private.send_agenda_reminders() n",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select private.send_agenda_reminders() n",
        )
      ).rows[0].n,
      0,
    );
    await actor(alice);
    const recapId = "94444444-4444-4444-8444-444444444444";
    const recap = {
      id: recapId,
      activity_id: aid,
      title: "Our activity",
      introduction: "Highlights",
      memory_ids: [],
      layout: "timeline",
      participant_ids: [alice],
      revision: -1,
    };
    await assert.rejects(action("save_memory_recap", recap), /consenting/);
    await action("set_recap_consent", { activity_id: aid, allowed: true });
    const recapRequest = "95555555-5555-4555-8555-555555555555";
    await action("save_memory_recap", recap, recapRequest);
    await action("save_memory_recap", recap, recapRequest);
    assert.equal(
      (await snapshot()).memory_recaps.find((r: any) => r.id === recapId)
        .layout,
      "timeline",
    );
    await action("set_recap_consent", { activity_id: aid, allowed: false });
    assert.deepEqual(
      (await snapshot()).memory_recaps.find((r: any) => r.id === recapId)
        .participant_ids,
      [],
    );
    await assert.rejects(
      action("save_memory_recap", {
        ...recap,
        revision: 0,
        participant_ids: [],
        layout: "invalid",
      }),
      /layout/,
    );
    const team = await action("create_beacon_team", {
      activity_id: aid,
      name: "Red",
    });
    const teamId = team.team_id ?? team.id;
    await action("save_tool_config", {
      activity_id: aid,
      kind: "teams",
      settings: {
        team_names: [],
        score_steps: [{ label: "Goal", points: 3 }],
        round_names: ["First", "Final"],
      },
      revision: -1,
    });
    const scoreRequest = "96666666-6666-4666-8666-666666666666";
    const score = {
      team_id: teamId,
      round_name: "First",
      delta: 3,
      revision: -1,
    };
    await action("record_round_score", score, scoreRequest);
    await action("record_round_score", score, scoreRequest);
    assert.equal(
      (await snapshot()).beacon_teams.find((t: any) => t.id === teamId).score,
      3,
    );
    assert.equal((await snapshot()).round_scores[0].score, 3);
    await assert.rejects(action("record_round_score", score), /changed/);
    const councilIds:string[]=[];
    for(const title of ["Destination","Activity"]) {
      const t=await action("create_planning_thread",{kind:"vote",title,body:"",audience:"friends",audience_id:null,deadline_at:new Date(Date.now()+86400000).toISOString(),coowner_ids:[]});
      councilIds.push(t.id);
    }
    const workflow={groups:[],explanations:false,readiness:false,workflow:councilIds.map((thread_id,index)=>({thread_id,label:`Stage ${index+1}`}))};
    await action("save_tool_config",{thread_id:councilIds[0],kind:"council",settings:workflow,revision:-1});
    assert.equal((await snapshot()).premium_tool_configs.find((c:any)=>c.thread_id===councilIds[0]).settings.workflow.length,2);
    await assert.rejects(action("save_tool_config",{thread_id:councilIds[0],kind:"council",settings:{...workflow,workflow:[{thread_id:"97777777-7777-4777-8777-777777777777",label:"Hidden"}]},revision:0}),/readable Councils/);
    await actor(bob);
    await assert.rejects(
      action("record_round_score", { ...score, revision: 0 }),
      /organizers/,
    );
    await assert.rejects(
      db.query("select * from private.beacon_attendee_details"),
      /permission denied/,
    );
    await actor(alice);
    await db.exec("reset role");
    await db.query(
      "update private.premium_grants set revoked_at=now() where owner_id=$1",
      [alice],
    );
    await actor(alice);
    await assert.rejects(
      action("record_round_score", { ...score, revision: 0 }),
      /PREMIUM_REQUIRED/,
    );
    await action("adjust_beacon_team_score", { team_id: teamId, delta: 1 });
    assert.equal(
      (await snapshot()).beacon_teams.find((t: any) => t.id === teamId).score,
      4,
    );
  } finally {
    await db.close();
  }
});
