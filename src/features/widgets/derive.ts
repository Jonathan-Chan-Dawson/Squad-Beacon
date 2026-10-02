import { friendIds } from "@/src/shared/domain";
import type { Data, Activity } from "@/src/shared/types";
import {
  defaultWidgetPreferences,
  type BeaconFeed,
  type BeaconSummary,
  type CircleKey,
  type CircleSource,
  type FriendStatusFeed,
  type WidgetPayload,
  type WidgetPreferences,
} from "@/src/features/widgets/types";

const circleKeys: CircleKey[] = ["circle1", "circle2", "circle3"];
export const WIDGET_FRESHNESS_MS = 15 * 60 * 1000;

function sourceFriendIds(
  data: Data,
  userId: string,
  accepted: Set<string>,
  source: CircleSource,
): string[] {
  if (!isValidCircleSource(data, userId, accepted, source)) return [];
  if (source.kind === "all") return [...accepted];
  if (source.kind === "friend")
    return accepted.has(source.id) ? [source.id] : [];
  if (source.kind === "squad")
    return data.squad_members
      .filter((member) => member.squad_id === source.id)
      .map((member) => member.user_id)
      .filter((id) => accepted.has(id));
  return data.list_members
    .filter((member) => member.list_id === source.id)
    .map((member) => member.user_id)
    .filter((id) => accepted.has(id));
}

function isValidCircleSource(
  data: Data,
  userId: string,
  accepted: Set<string>,
  source: CircleSource,
) {
  if (source.kind === "all") return true;
  if (source.kind === "friend") return accepted.has(source.id);
  if (source.kind === "squad")
    return (
      data.squads.some((squad) => squad.id === source.id) &&
      data.squad_members.some(
        (member) => member.squad_id === source.id && member.user_id === userId,
      )
    );
  return data.lists.some(
    (list) => list.id === source.id && list.owner_id === userId,
  );
}

function friendStatus(
  data: Data,
  userId: string,
  friendId: string,
  now: number,
): { activity?: Activity; free: boolean } {
  const live = data.activities.filter(
    (activity) =>
      activity.status === "scheduled" &&
      Date.parse(activity.starts_at) <= now &&
      Date.parse(activity.ends_at) > now &&
      canViewerSeeActivity(data, userId, activity),
  );
  const activity =
    live
      .filter((item) => item.owner_id === friendId && item.mode === "solo")
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0] ??
    live.find(
      (item) =>
        item.owner_id === friendId ||
        data.rsvps.some(
          (rsvp) =>
            rsvp.activity_id === item.id &&
            rsvp.user_id === friendId &&
            rsvp.status === "going" &&
            rsvp.approved,
        ),
    );
  return {
    activity,
    free: activity?.mode === "solo" && activity.available === true,
  };
}

function makeFriendFeed(
  data: Data,
  userId: string,
  friendIdsToShow: string[],
  title: string,
  privacy: WidgetPreferences["privacy"],
  now: number,
): FriendStatusFeed {
  const ordered = [...new Set(friendIdsToShow)]
    .map((id) => {
      const profile = data.profiles.find((item) => item.id === id);
      if (!profile || id === userId) return null;
      const { activity, free } = friendStatus(data, userId, id, now);
      return { profile, activity, free };
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort(
      (a, b) =>
        Number(b.free) - Number(a.free) ||
        Number(!!b.activity) - Number(!!a.activity) ||
        a.profile.name.localeCompare(b.profile.name),
    );
  const friends = ordered.map((item, index) => ({
    name: privacy === "full" ? item.profile.name : `Friend ${index + 1}`,
    status: item.free ? "Free now" : item.activity ? "At a beacon" : "Quiet",
    detail:
      privacy === "full" && item.activity
        ? item.activity.title
        : item.free
          ? "Open to plans"
          : item.activity
            ? "Out with their people"
            : "No active beacon",
    free: item.free,
    active: !!item.activity,
  }));
  return {
    title,
    friends,
    freeCount: friends.filter((friend) => friend.free).length,
    activeCount: friends.filter((friend) => friend.active).length,
    totalCount: friends.length,
  };
}

function canViewerSeeActivity(data: Data, userId: string, activity: Activity) {
  if (activity.owner_id === userId) return true;
  if (activity.audience === "private") return false;
  if (activity.audience === "friends")
    return friendIds(data, userId).includes(activity.owner_id);
  if (activity.audience === "squad")
    return data.squad_members.some(
      (member) =>
        member.user_id === userId && member.squad_id === activity.audience_id,
    );
  return data.list_members.some(
    (member) =>
      member.user_id === userId && member.list_id === activity.audience_id,
  );
}

function circleBeaconFeed(
  data: Data,
  userId: string,
  source: CircleSource,
  accepted: Set<string>,
  friends: Set<string>,
  privacy: WidgetPreferences["privacy"],
  now: number,
): BeaconFeed {
  if (!isValidCircleSource(data, userId, accepted, source))
    return { title: "Circle beacons", beacons: [] };
  const squadMemberIds =
    source.kind === "squad"
      ? new Set(
          data.squad_members
            .filter((member) => member.squad_id === source.id)
            .map((member) => member.user_id),
        )
      : new Set<string>();
  const candidates = data.activities
    .filter((activity) => {
      if (
        activity.status !== "scheduled" ||
        Date.parse(activity.ends_at) <= now ||
        !canViewerSeeActivity(data, userId, activity)
      )
        return false;
      const inCircle =
        friends.has(activity.owner_id) ||
        (source.kind === "squad" && activity.audience_id === source.id) ||
        data.rsvps.some(
          (rsvp) =>
            rsvp.activity_id === activity.id &&
            rsvp.status === "going" &&
            rsvp.approved &&
            (friends.has(rsvp.user_id) || squadMemberIds.has(rsvp.user_id)),
        );
      return inCircle;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5);
  const beacons: BeaconSummary[] = candidates.map((activity, index) => ({
    title: privacy === "full" ? activity.title : `Beacon ${index + 1}`,
    category: privacy === "full" ? activity.category : "Beacon",
    startEpoch: Date.parse(activity.starts_at),
    state: Date.parse(activity.starts_at) <= now ? "live" : "upcoming",
  }));
  return {
    title: source.kind === "squad" ? "Squad beacons" : "Circle beacons",
    beacons,
  };
}

function deriveNextBeacon(data: Data, userId: string, now: number) {
  const candidates = data.activities
    .filter(
      (activity) =>
        activity.status === "scheduled" &&
        Date.parse(activity.ends_at) > now &&
        canViewerSeeActivity(data, userId, activity) &&
        (activity.owner_id === userId ||
          data.rsvps.some(
            (rsvp) =>
              rsvp.activity_id === activity.id &&
              rsvp.user_id === userId &&
              rsvp.status === "going" &&
              rsvp.approved,
          )),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = candidates[0];
  return next
    ? {
        title: next.title,
        category: next.category,
        startEpoch: Date.parse(next.starts_at),
        live: Date.parse(next.starts_at) <= now,
      }
    : null;
}

export function deriveWidgetPayload(
  data: Data,
  userId: string,
  preferences: WidgetPreferences = defaultWidgetPreferences(),
  now = new Date(),
  fetchedAt = now,
): WidgetPayload {
  const timestamp = +now;
  const updatedEpoch = +fetchedAt;
  const stale = timestamp >= updatedEpoch + WIDGET_FRESHNESS_MS;
  if (stale)
    return {
      updatedEpoch,
      stale: true,
      allFriends: {
        title: "All friends",
        friends: [],
        freeCount: 0,
        activeCount: 0,
        totalCount: 0,
      },
      circles: {
        circle1: {
          title: "Circle 1",
          friends: [],
          freeCount: 0,
          activeCount: 0,
          totalCount: 0,
        },
        circle2: {
          title: "Circle 2",
          friends: [],
          freeCount: 0,
          activeCount: 0,
          totalCount: 0,
        },
        circle3: {
          title: "Circle 3",
          friends: [],
          freeCount: 0,
          activeCount: 0,
          totalCount: 0,
        },
      },
      circleBeacons: {
        circle1: { title: "Circle beacons", beacons: [] },
        circle2: { title: "Circle beacons", beacons: [] },
        circle3: { title: "Circle beacons", beacons: [] },
      },
      nextBeacon: null,
      pulse: { freeCount: 0, activeCount: 0, friendCount: 0 },
    };
  const accepted = new Set(friendIds(data, userId));
  const circleFriends = Object.fromEntries(
    circleKeys.map((key) => [
      key,
      sourceFriendIds(data, userId, accepted, preferences.circles[key]),
    ]),
  ) as Record<CircleKey, string[]>;
  const allFriends = makeFriendFeed(
    data,
    userId,
    [...accepted],
    "All friends",
    preferences.privacy,
    timestamp,
  );
  const circles = Object.fromEntries(
    circleKeys.map((key) => [
      key,
      makeFriendFeed(
        data,
        userId,
        circleFriends[key],
        `Circle ${key.slice(-1)}`,
        preferences.privacy,
        timestamp,
      ),
    ]),
  ) as WidgetPayload["circles"];
  const circleBeacons = Object.fromEntries(
    circleKeys.map((key) => [
      key,
      circleBeaconFeed(
        data,
        userId,
        preferences.circles[key],
        accepted,
        new Set(circleFriends[key]),
        preferences.privacy,
        timestamp,
      ),
    ]),
  ) as WidgetPayload["circleBeacons"];
  const allLive = allFriends.friends.filter((friend) => friend.active).length;
  return {
    updatedEpoch,
    stale: false,
    allFriends,
    circles,
    circleBeacons,
    nextBeacon: (() => {
      const next = deriveNextBeacon(data, userId, timestamp);
      return next && preferences.privacy === "discreet"
        ? { ...next, title: "Your next beacon", category: "Beacon" }
        : next;
    })(),
    pulse: {
      freeCount: allFriends.freeCount,
      activeCount: allLive,
      friendCount: allFriends.totalCount,
    },
  };
}

export function widgetTimelineDates(
  data: Data,
  userId: string,
  now = new Date(),
) {
  const lower = +now;
  const upper = lower + WIDGET_FRESHNESS_MS;
  const dates = new Set<number>([lower]);
  data.activities.forEach((activity) => {
    if (
      activity.status !== "scheduled" ||
      !canViewerSeeActivity(data, userId, activity)
    )
      return;
    [Date.parse(activity.starts_at), Date.parse(activity.ends_at)].forEach(
      (value) => {
        if (value > lower && value < upper && Number.isFinite(value))
          dates.add(value);
      },
    );
  });
  dates.add(upper);
  return [...dates].sort((a, b) => a - b).map((value) => new Date(value));
}
