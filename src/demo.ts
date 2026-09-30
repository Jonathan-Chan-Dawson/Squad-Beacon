import { canChat } from "./browsing";
import { type Data, type Payload } from "./types";
import { localDate, validateActivity } from "./domain";
export { makeDemo } from "../tests/fixtures/neighborhood";
export const DEMO_ID = "demo-you";
export function demoAction(previous: Data, action: string, p: Payload): Data {
  const d = structuredClone(previous),
    id = String(p.id ?? ""),
    uid = DEMO_ID;
  const newId = () => "demo-" + Math.random().toString(36).slice(2);
  if (action === "favorite") {
    d.favorites = d.favorites.filter(
      (f) => !(f.owner_id === uid && f.kind === p.kind && f.target_id === id),
    );
    if (p.add)
      d.favorites.push({
        owner_id: uid,
        kind: p.kind as "friend" | "squad",
        target_id: id,
      });
  }
  if (action === "save_template") {
    if (!String(p.name ?? "").trim() || !String(p.title ?? "").trim())
      throw new Error("Give your template a name and activity.");
    const minutes = Number(p.minutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440)
      throw new Error("Choose a duration from 5 to 1440 minutes.");
    const existing = d.templates.find((t) => t.id === id && t.owner_id === uid);
    const template = {
      id: existing?.id ?? newId(),
      owner_id: uid,
      name: String(p.name).trim(),
      title: String(p.title).trim(),
      description: String(p.description ?? ""),
      category: p.category as any,
      minutes,
      label: String(p.label ?? ""),
      target_count: p.target_count == null ? null : Number(p.target_count),
      approval_required: !!p.approval_required,
    };
    if (existing) Object.assign(existing, template);
    else d.templates.push(template);
  }
  if (action === "delete_template")
    d.templates = d.templates.filter((t) => t.id !== id || t.owner_id !== uid);
  if (action === "send_message") {
    const body = String(p.body ?? "").trim();
    if (!body || body.length > 2000)
      throw new Error("Write a message of 1 to 2000 characters.");
    const a = d.activities.find((a) => a.id === p.activity_id);
    if (p.activity_id && (!a || !canChat(d, a, uid)))
      throw new Error("Join this beacon before entering its chat.");
    if (
      !p.activity_id &&
      !d.friendships.some(
        (f) =>
          f.status === "accepted" &&
          ((f.sender_id === uid && f.recipient_id === p.recipient_id) ||
            (f.recipient_id === uid && f.sender_id === p.recipient_id)),
      )
    )
      throw new Error("Connect as friends to message.");
    d.messages.push({
      id: newId(),
      author_id: uid,
      activity_id: a?.id ?? null,
      recipient_id: p.recipient_id ? String(p.recipient_id) : null,
      body,
      created_at: new Date().toISOString(),
    });
  }
  if (action === "save_profile")
    Object.assign(
      d.profiles.find((x) => x.id === uid)!,
      p,
    );
  if (action === "create_activity") {
    validateActivity(p);
    const aid = newId();
    d.activities.push({
      id: aid,
      owner_id: uid,
      title: String(p.title),
      available: !!p.available,
      description: String(p.description ?? ""),
      target_count: p.target_count == null ? null : Number(p.target_count),
      category: p.category as any,
      mode: p.mode as any,
      starts_at: String(p.starts_at),
      ends_at: String(p.ends_at),
      timezone: String(p.timezone),
      approval_required: !!p.approval_required,
      status: "scheduled",
      goal_id: p.goal_id as string | null,
      habit_id: p.habit_id as string | null,
      audience: p.audience as any,
      audience_id: p.audience_id as string | null,
    });
    d.places.push({
      activity_id: aid,
      label: String(p.label ?? ""),
      latitude: p.latitude as number | null,
      longitude: p.longitude as number | null,
      online_url: p.online_url as string | null,
    });
  }
  if (action === "rsvp") {
    const a = d.activities.find((x) => x.id === id)!;
    const approved =
      d.rsvps.find((x) => x.activity_id === id && x.user_id === uid)
        ?.approved ?? false;
    d.rsvps = d.rsvps.filter(
      (x) => !(x.activity_id === id && x.user_id === uid),
    );
    if (p.status !== "withdraw")
      d.rsvps.push({
        activity_id: id,
        user_id: uid,
        status:
          p.status === "going" &&
          (a.approval_required || a.mode === "invite") &&
          !approved
            ? "requested"
            : (p.status as any),
        approved,
      });
  }
  if (action === "open_status") {
    const a = d.activities.find((x) => x.id === id);
    if (
      !a ||
      a.owner_id !== uid ||
      a.mode !== "solo" ||
      a.status !== "scheduled" ||
      Date.parse(a.ends_at) <= Date.now()
    )
      throw new Error("This status cannot be opened.");
    a.mode = "squad";
    a.approval_required = false;
  }
  if (action === "activity_status")
    d.activities.find((x) => x.id === id)!.status = p.status as any;
  if (action === "edit_activity") {
    validateActivity(p);
    Object.assign(
      d.activities.find((x) => x.id === id)!,
      { title: p.title, starts_at: p.starts_at, ends_at: p.ends_at },
    );
  }
  if (action === "invite_activity")
    d.rsvps.push({
      activity_id: id,
      user_id: String(p.user_id),
      status: "invited",
      approved: true,
    });
  if (action === "approve_rsvp")
    Object.assign(
      d.rsvps.find((x) => x.activity_id === id && x.user_id === p.user_id)!,
      { approved: true, status: "going" },
    );
  if (action === "remove_rsvp")
    d.rsvps = d.rsvps.filter(
      (x) => !(x.activity_id === id && x.user_id === p.user_id),
    );
  if (action === "comment")
    d.comments.push({
      id: newId(),
      activity_id: id,
      author_id: uid,
      body: String(p.body),
      created_at: new Date().toISOString(),
    });
  if (action === "react") {
    d.reactions = d.reactions.filter(
      (x) => !(x.activity_id === id && x.user_id === uid),
    );
    d.reactions.push({ activity_id: id, user_id: uid, emoji: "🙌" });
  }
  if (action === "save_goal") {
    if (id)
      Object.assign(
        d.goals.find((x) => x.id === id)!,
        p,
      );
    else
      d.goals.push({
        id: newId(),
        owner_id: uid,
        title: String(p.title),
        description: String(p.description ?? ""),
        target_date: p.target_date as string | null,
        progress: 0,
        audience: (p.audience as any) ?? "private",
        audience_id: (p.audience_id as string | null) ?? null,
      });
  }
  if (action === "milestone") {
    if (p.milestone_id) {
      const m = d.milestones.find((x) => x.id === p.milestone_id)!;
      m.done = !m.done;
    } else
      d.milestones.push({
        id: newId(),
        goal_id: id,
        title: String(p.title),
        done: false,
      });
  }
  if (action === "save_habit")
    d.habits.push({ ...p, id: newId(), owner_id: uid } as any);
  if (action === "checkin") {
    const habit = d.habits.find((x) => x.id === id)!;
    const date = localDate(new Date(), habit.timezone);
    if (!d.checkins.some((x) => x.habit_id === id && x.local_date === date))
      d.checkins.push({
        id: newId(),
        habit_id: id,
        owner_id: uid,
        local_date: date,
      });
  }
  if (action === "create_squad") {
    const sid = newId();
    d.squads.push({
      id: sid,
      owner_id: uid,
      name: String(p.name),
      description: String(p.description ?? ""),
    });
    d.squad_members.push({ squad_id: sid, user_id: uid, role: "owner" });
  }
  if (action === "create_list")
    d.lists.push({ id: newId(), owner_id: uid, name: String(p.name) });
  if (action === "list_member") {
    d.list_members = d.list_members.filter(
      (x) => !(x.list_id === id && x.user_id === p.user_id),
    );
    if (p.add) d.list_members.push({ list_id: id, user_id: String(p.user_id) });
  }
  if (action === "friend_request") {
    const person = d.profiles.find((x) => x.username === p.username);
    if (!person)
      throw new Error(
        "No demo profile has that username. Try a real account to invite friends.",
      );
    if (
      !d.friendships.some((x) =>
        [x.sender_id, x.recipient_id].includes(person.id),
      )
    )
      d.friendships.push({
        id: newId(),
        sender_id: uid,
        recipient_id: person.id,
        status: "pending",
      });
  }
  if (action === "accept_friend")
    d.friendships.find((x) => x.id === id)!.status = "accepted";
  if (action === "invite_squad")
    d.squad_invites.push({
      id: newId(),
      squad_id: id,
      sender_id: uid,
      recipient_id: String(p.user_id),
    });
  if (action === "accept_squad") {
    const invite = d.squad_invites.find((x) => x.id === id)!;
    d.squad_members.push({
      squad_id: invite.squad_id,
      user_id: uid,
      role: "member",
    });
    d.squad_invites = d.squad_invites.filter((x) => x.id !== id);
  }
  if (action === "remove_member")
    d.squad_members = d.squad_members.filter(
      (x) => !(x.squad_id === id && x.user_id === p.user_id),
    );
  if (action === "block") {
    d.blocks.push({ blocker_id: uid, blocked_id: id });
    d.profiles = d.profiles.filter((x) => x.id !== id);
    d.activities = d.activities.filter((x) => x.owner_id !== id);
    d.comments = d.comments.filter((x) => x.author_id !== id);
    d.friendships = d.friendships.filter(
      (x) => ![x.sender_id, x.recipient_id].includes(id),
    );
  }
  if (action === "report")
    d.reports.push({
      id: newId(),
      reporter_id: uid,
      subject_id: id,
      reason: String(p.reason),
      created_at: new Date().toISOString(),
      resolved: false,
    });
  if (action === "read_notices")
    d.notices = d.notices.map((n) => ({
      ...n,
      read_at: new Date().toISOString(),
    }));
  if (action === "start_location")
    throw new Error(
      "Live location is available only with a connected account. Demo never shares your location.",
    );
  return d;
}
