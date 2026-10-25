import type { Data, Payload } from "@/src/shared/types";
import type {
  BeaconDraft,
  PlanningAvailability,
  PlanningSlot,
  PlanningThread,
} from "./types";
import {
  canManagePlanningThread,
  canReadPlanningThread,
  validateBeaconDraft,
} from "./domain";
import { backupAvailableAt, validateSlots } from "./connected";

/** Demo persistence mirrors the hosted actions; never used by real accounts. */
export function demoConnected(
  previous: Data,
  uid: string,
  action: string,
  p: Payload,
  legacy: (data: Data, action: string, p: Payload) => Data,
): Data | null {
  const relevant = [
    "save_planning_availability",
    "amend_planning_slots",
    "finalize_planning_time",
    "save_council_approval_ballot",
    "close_planning_without_beacon",
    "save_planning_organizer_message",
    "set_planning_backup",
    "claim_planning_host",
    "release_planning_host",
    "publish_planning_beacon",
  ];
  if (
    !relevant.includes(action) &&
    action !== "create_planning_thread" &&
    action !== "resolve_planning_thread" &&
    action !== "approve_council_proposal" &&
    action !== "vote_council_proposal"
  )
    return null;
  let d = structuredClone(previous);
  const now = Date.now(),
    stamp = new Date(now).toISOString();
  if (p.expected_actor_id && p.expected_actor_id !== uid)
    throw new Error("Your account changed.");
  if (action === "create_planning_thread") {
    if (p.kind !== "time") {
      d = legacy(d, action, p);
      const t = d.planning_threads.find(
        (t) => !previous.planning_threads.some((old) => old.id === t.id),
      );
      if (t) {
        t.source_activity_note_id = p.source_activity_note_id as
          string | undefined;
        t.vote_method = p.vote_method === "approval" ? "approval" : "pick_one";
        t.resolution_policy = p.connected_version === 1 ? "explicit" : "legacy";
        t.interest_target =
          p.interest_target == null ? null : Number(p.interest_target);
        t.allow_backup_hosting =
          p.allow_backup_hosting == null
            ? t.audience === "squad"
            : p.allow_backup_hosting === true;
      }
      return d;
    }
    const slots = p.slots as PlanningSlot[];
    validateSlots(slots, String(p.deadline_at));
    const id = String(p.id ?? crypto.randomUUID());
    const source = d.planning_threads.find((t) => t.id === p.source_thread_id);
    if (
      p.source_thread_id &&
      (!source ||
        source.owner_id !== uid ||
        source.materialized_activity_id ||
        d.planning_threads.some((t) => t.source_thread_id === source.id))
    )
      throw new Error("This source has already continued or is unavailable.");
    const t: PlanningThread = {
      id,
      owner_id: uid,
      coowner_ids: [],
      kind: "time",
      title: String(p.title),
      body: String(p.body ?? ""),
      audience: p.audience as PlanningThread["audience"],
      audience_id: p.audience_id as string | null,
      deadline_at: String(p.deadline_at),
      status: "open",
      payload: p.payload as BeaconDraft,
      winner_proposal_id: null,
      replaced_from_proposal_id: null,
      materialized_activity_id: null,
      created_at: stamp,
      resolved_at: null,
      slots_revision: 1,
      resolution_policy: "explicit",
      source_thread_id: source?.id,
      source_activity_note_id: p.source_activity_note_id as string | undefined,
      allow_backup_hosting:
        p.allow_backup_hosting == null
          ? p.audience === "squad"
          : p.allow_backup_hosting === true,
    };
    if (!t.title.trim() || !canReadPlanningThread(d, t, uid))
      throw new Error("Choose a title and audience.");
    d.planning_threads.push(t);
    d.planning_slots = [
      ...(d.planning_slots ?? []),
      ...slots.map((s) => ({ ...s, thread_id: id, retired_at: null })),
    ];
    d.planning_recovery = [
      ...(d.planning_recovery ?? []),
      {
        thread_id: id,
        owner_id: uid,
        context: {
          ...((p.recovery_context as Partial<BeaconDraft>) ?? t.payload ?? {}),
          ...(typeof p.local_draft_token === "string"
            ? { local_draft_token: p.local_draft_token }
            : {}),
        },
      },
    ];
    return d;
  }
  const t = d.planning_threads.find((t) => t.id === p.thread_id);
  if (!t || !canReadPlanningThread(d, t, uid))
    throw new Error("Planning decision unavailable.");
  const manages = canManagePlanningThread(t, uid);
  const open = t.status === "open" && Date.parse(t.deadline_at) > now;
  let root = t;
  while (root.source_thread_id) {
    const parent = d.planning_threads.find(
      (x) => x.id === root.source_thread_id,
    );
    if (!parent) break;
    root = parent;
  }
  if (
    [
      "publish_planning_beacon",
      "claim_planning_host",
      "resolve_planning_thread",
    ].includes(action) &&
    root.materialized_activity_id
  ) {
    t.materialized_activity_id = root.materialized_activity_id;
    return d;
  }
  if (action === "save_planning_organizer_message") {
    const message = String(p.message ?? "").trim();
    if (message.length > 500)
      throw new Error("Keep your message under 500 characters.");
    d.planning_organizer_messages = (
      d.planning_organizer_messages ?? []
    ).filter((m) => m.thread_id !== t.id || m.user_id !== uid);
    if (message)
      d.planning_organizer_messages.push({
        thread_id: t.id,
        user_id: uid,
        message,
        updated_at: stamp,
      });
    return d;
  }
  if (action === "save_planning_availability") {
    if (!open || t.kind !== "time" || t.finalized_at)
      throw new Error("Availability responses are closed.");
    if (p.slots_revision !== t.slots_revision)
      throw new Error("Proposed times changed. Refresh.");
    const answers = p.answers as PlanningAvailability["answers"];
    for (const [id, value] of Object.entries(answers))
      if (
        !["yes", "maybe", "no"].includes(value) ||
        !d.planning_slots?.some(
          (s) => s.thread_id === t.id && s.id === id && !s.retired_at,
        )
      )
        throw new Error("A proposed time changed.");
    d.planning_availability = (d.planning_availability ?? []).filter(
      (a) => a.thread_id !== t.id || a.user_id !== uid,
    );
    d.planning_availability.push({
      thread_id: t.id,
      user_id: uid,
      answers,
      slots_revision: t.slots_revision ?? 1,
      none_work: p.none_work === true,
      updated_at: stamp,
    });
    return d;
  }
  if (action === "amend_planning_slots") {
    if (
      !manages ||
      !open ||
      t.finalized_at ||
      p.slots_revision !== t.slots_revision
    )
      throw new Error("Times cannot be edited.");
    const slots = p.slots as PlanningSlot[];
    validateSlots(slots, t.deadline_at);
    d.planning_slots = (d.planning_slots ?? []).map((s) =>
      s.thread_id === t.id && !slots.some((n) => n.id === s.id)
        ? { ...s, retired_at: stamp }
        : s,
    );
    for (const s of slots) {
      const old = d.planning_slots.find((o) => o.id === s.id);
      if (
        old &&
        (old.starts_at !== s.starts_at ||
          old.ends_at !== s.ends_at ||
          old.retired_at)
      )
        throw new Error("Changed times need a new slot identity.");
      if (!old)
        d.planning_slots.push({ ...s, thread_id: t.id, retired_at: null });
    }
    t.slots_revision = (t.slots_revision ?? 1) + 1;
    return d;
  }
  if (action === "finalize_planning_time") {
    if (!manages || !p.confirmed) throw new Error("Confirm as an organizer.");
    if (t.finalized_at) return d;
    if (t.status !== "open" || p.slots_revision !== t.slots_revision)
      throw new Error("This Time Finder changed.");
    if (
      Date.parse(t.deadline_at) > now &&
      !d.planning_availability?.some(
        (a) => a.thread_id === t.id && Object.keys(a.answers).length,
      )
    )
      throw new Error("Wait for a saved response or the deadline.");
    if (
      !d.planning_slots?.some(
        (s) =>
          s.thread_id === t.id &&
          s.id === p.slot_id &&
          !s.retired_at &&
          Date.parse(s.starts_at) > now,
      )
    )
      throw new Error("Choose a valid future time.");
    t.selected_slot_id = String(p.slot_id);
    t.finalized_by = uid;
    t.finalized_at = stamp;
    t.status = "resolved";
    t.resolved_at = stamp;
    return d;
  }
  if (action === "save_council_approval_ballot") {
    if (!open || t.vote_method !== "approval")
      throw new Error("This approval vote is closed.");
    const ids = p.proposal_ids as string[];
    if (
      !Array.isArray(ids) ||
      new Set(ids).size !== ids.length ||
      (!ids.length && !p.none_work)
    )
      throw new Error("Choose options or None work.");
    if (
      ids.some(
        (id) =>
          !d.planning_proposals.some(
            (o) =>
              o.thread_id === t.id &&
              o.id === id &&
              o.approved &&
              !o.disqualified_at &&
              Date.parse(o.payload.starts_at) > now &&
              canReadPlanningThread(d, t, o.author_id),
          ),
      )
    )
      throw new Error("Choose eligible approved options.");
    d.planning_approval_ballots = (d.planning_approval_ballots ?? []).filter(
      (b) => b.thread_id !== t.id || b.user_id !== uid,
    );
    d.planning_approval_ballots.push({
      thread_id: t.id,
      user_id: uid,
      proposal_ids: ids,
      none_work: p.none_work === true,
      updated_at: stamp,
    });
    return d;
  }
  if (action === "set_planning_backup") {
    if (t.owner_id !== uid)
      throw new Error("Only the owner can change backup hosting.");
    t.allow_backup_hosting = p.enabled === true;
    d.planning_claims = d.planning_claims?.filter((c) => c.thread_id !== t.id);
    return d;
  }
  if (action === "close_planning_without_beacon") {
    if (
      !manages ||
      Date.parse(t.deadline_at) > now ||
      root.materialized_activity_id
    )
      throw new Error("This decision cannot close.");
    t.continuation_closed_at = stamp;
    if (!t.finalized_at) t.status = "no_options";
    return d;
  }
  if (action === "vote_council_proposal") {
    if (t.vote_method === "approval")
      throw new Error("Use an approval ballot.");
    d = legacy(d, action, p);
    const vote = d.planning_votes.find(
      (v) => v.thread_id === t.id && v.user_id === uid,
    );
    if (vote) vote.updated_at = stamp;
    return d;
  }
  if (action === "approve_council_proposal") {
    d = legacy(d, action, p);
    const option = d.planning_proposals.find((o) => o.id === p.proposal_id);
    if (option) option.approved_at = option.approved ? stamp : null;
    return d;
  }
  const options = d.planning_proposals.filter(
    (o) =>
      o.thread_id === t.id &&
      o.approved &&
      !o.disqualified_at &&
      Date.parse(o.payload.starts_at) > now &&
      canReadPlanningThread(d, t, o.author_id),
  );
  if (action === "claim_planning_host") {
    const starts =
      t.kind === "ping"
        ? [t.payload?.starts_at ?? ""]
        : t.kind === "time"
          ? (d.planning_slots ?? [])
              .filter(
                (s) =>
                  s.thread_id === t.id &&
                  !s.retired_at &&
                  (!t.selected_slot_id || t.selected_slot_id === s.id),
              )
              .map((s) => s.starts_at)
          : options.map((o) => o.payload.starts_at);
    const start = Math.min(...starts.map(Date.parse).filter((v) => v > now));
    if (
      !Number.isFinite(start) ||
      !t.allow_backup_hosting ||
      now < backupAvailableAt(t.deadline_at, new Date(start).toISOString())
    )
      throw new Error("Backup hosting is not available yet.");
    const current = d.planning_claims?.find(
      (c) => c.thread_id === t.id && Date.parse(c.expires_at) > now,
    );
    if (current) {
      if (current.user_id !== uid)
        throw new Error("Another participant is reviewing.");
      return d;
    }
    d.planning_claims = [
      ...(d.planning_claims ?? []).filter((c) => c.thread_id !== t.id),
      {
        thread_id: t.id,
        user_id: uid,
        token: crypto.randomUUID(),
        expires_at: new Date(Math.min(now + 600000, start)).toISOString(),
        revision: t.slots_revision ?? 1,
      },
    ];
    if (t.kind === "draw" && !t.reserved_draw_id)
      t.reserved_draw_id =
        options[Math.floor(Math.random() * options.length)]?.id;
    return d;
  }
  if (action === "release_planning_host") {
    d.planning_claims = d.planning_claims?.filter(
      (c) =>
        !(
          c.thread_id === t.id &&
          c.user_id === uid &&
          c.token === p.claim_token
        ),
    );
    return d;
  }
  if (
    action === "resolve_planning_thread" &&
    t.resolution_policy !== "explicit" &&
    t.vote_method !== "approval" &&
    !t.reserved_draw_id
  )
    return null;
  if (
    action === "resolve_planning_thread" ||
    action === "publish_planning_beacon"
  ) {
    if (!p.confirmed || t.continuation_closed_at)
      throw new Error("Confirm publication.");
    if (
      !manages &&
      !d.planning_claims?.some(
        (c) =>
          c.thread_id === t.id &&
          c.user_id === uid &&
          c.token === p.claim_token &&
          Date.parse(c.expires_at) > now,
      )
    )
      throw new Error("Your hosting claim expired.");
    let draft = (p.payload ?? t.payload) as BeaconDraft;
    let candidate: string | undefined;
    if (t.kind === "vote" || t.kind === "draw") {
      if (Date.parse(t.deadline_at) > now)
        throw new Error("The Council deadline has not arrived.");
      const count = (id: string) =>
        t.vote_method === "approval"
          ? (d.planning_approval_ballots ?? []).filter(
              (b) =>
                b.thread_id === t.id &&
                b.proposal_ids.includes(id) &&
                canReadPlanningThread(d, t, b.user_id),
            ).length
          : d.planning_votes.filter(
              (v) =>
                v.thread_id === t.id &&
                v.proposal_id === id &&
                canReadPlanningThread(d, t, v.user_id),
            ).length;
      const max = Math.max(0, ...options.map((o) => count(o.id)));
      const leaders = options.filter((o) => count(o.id) === max);
      candidate =
        t.kind === "draw"
          ? (t.reserved_draw_id ??
            options[Math.floor(Math.random() * options.length)]?.id)
          : String(
              p.proposal_id ??
                (leaders.length === 1 && max ? leaders[0].id : ""),
            );
      if (t.kind === "vote" && !leaders.some((o) => o.id === candidate))
        throw new Error("Explicitly choose an eligible leading option.");
      const winner = options.find((o) => o.id === candidate);
      if (!winner) throw new Error("No eligible activity remains.");
      draft = winner.payload;
      t.winner_proposal_id = candidate;
      if (t.kind === "vote")
        t.result_summary = {
          support: count(candidate!),
          tie_count: leaders.length,
        };
    }
    if (t.kind === "time") {
      const slot = d.planning_slots?.find(
        (s) =>
          s.thread_id === t.id &&
          s.id === (t.selected_slot_id ?? p.slot_id) &&
          !s.retired_at,
      );
      if (!slot) throw new Error("Select a time.");
      draft = {
        ...draft,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        timezone: slot.timezone,
      };
      t.selected_slot_id = slot.id;
    }
    validateBeaconDraft(draft);
    if (Date.parse(draft.starts_at) <= now)
      throw new Error("The activity has passed.");
    const host = action === "resolve_planning_thread" ? t.owner_id : uid;
    const id = crypto.randomUUID();
    d.activities.push({
      ...draft,
      id,
      owner_id: host,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      plan_id: null,
      plan_step_index: null,
      aspiration_ids: draft.aspiration_ids ?? [],
    });
    d.places.push({
      activity_id: id,
      label: draft.label,
      latitude: draft.latitude,
      longitude: draft.longitude,
      online_url: draft.online_url,
    });
    const lineage = (row: PlanningThread): string =>
      row.source_thread_id
        ? lineage(
            d.planning_threads.find((x) => x.id === row.source_thread_id)!,
          )
        : row.id;
    d.planning_threads.forEach((row) => {
      if (lineage(row) === root.id) row.materialized_activity_id = id;
    });
    t.status = "resolved";
    t.resolved_at = stamp;
    const proposal = d.planning_proposals.find((o) => o.id === candidate);
    if (proposal) proposal.activity_id = id;
    d.planning_claims = d.planning_claims?.filter((c) => c.thread_id !== t.id);
    return d;
  }
  return null;
}
