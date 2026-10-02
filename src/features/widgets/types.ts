export type CircleKey = "circle1" | "circle2" | "circle3";
export type CircleSource =
  | { kind: "all" }
  | { kind: "friend"; id: string }
  | { kind: "squad"; id: string }
  | { kind: "list"; id: string };
export type WidgetPrivacy = "full" | "discreet";
export type WidgetPreferences = {
  version: 2;
  circles: Record<CircleKey, CircleSource>;
  privacy: WidgetPrivacy;
  enabled: boolean;
};
export type FriendStatusItem = {
  name: string;
  status: string;
  detail: string;
  free: boolean;
  active: boolean;
};
export type FriendStatusFeed = {
  title: string;
  friends: FriendStatusItem[];
  freeCount: number;
  activeCount: number;
  totalCount: number;
};
export type BeaconSummary = {
  title: string;
  category: string;
  startEpoch: number;
  state: "live" | "upcoming";
};
export type BeaconFeed = {
  title: string;
  beacons: BeaconSummary[];
};
export type NextBeacon = {
  title: string;
  category: string;
  startEpoch: number;
  live: boolean;
} | null;
export type WidgetPayload = {
  updatedEpoch: number;
  stale: boolean;
  allFriends: FriendStatusFeed;
  circles: Record<CircleKey, FriendStatusFeed>;
  circleBeacons: Record<CircleKey, BeaconFeed>;
  nextBeacon: NextBeacon;
  pulse: { freeCount: number; activeCount: number; friendCount: number };
};

export const defaultWidgetPreferences = (): WidgetPreferences => ({
  version: 2,
  circles: {
    circle1: { kind: "all" },
    circle2: { kind: "all" },
    circle3: { kind: "all" },
  },
  privacy: "discreet",
  enabled: false,
});
