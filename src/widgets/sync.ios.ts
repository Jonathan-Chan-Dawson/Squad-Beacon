import * as SecureStore from "expo-secure-store";
import { deriveWidgetPayload, widgetTimelineDates } from "./derive";
import type { WidgetPayload, WidgetPreferences } from "./types";
import type { Data } from "../types";
import FriendsNowWidget from "./FriendsNowWidget";
import SquadBeaconsWidget from "./SquadBeaconsWidget";
import NextBeaconWidget from "./NextBeaconWidget";
import CirclePulseWidget from "./CirclePulseWidget";

const accountKey = "beacon.widgets.active-account";
const emptyPayload: WidgetPayload = {
  updatedEpoch: 0,
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

let activeAccount: string | null = null;
let queue: Promise<void> = Promise.resolve();
function enqueue(action: () => Promise<void>) {
  queue = queue.then(action).catch(() => undefined);
  return queue;
}
function clearSnapshots() {
  FriendsNowWidget.updateSnapshot(emptyPayload);
  SquadBeaconsWidget.updateSnapshot(emptyPayload);
  NextBeaconWidget.updateSnapshot(emptyPayload);
  CirclePulseWidget.updateSnapshot(emptyPayload);
}

export function prepareWidgetAccount(accountId: string) {
  return enqueue(async () => {
    if (activeAccount === accountId) return;
    const storedAccount = await SecureStore.getItemAsync(accountKey);
    if (storedAccount && storedAccount !== accountId) clearSnapshots();
    await SecureStore.setItemAsync(accountKey, accountId);
    activeAccount = accountId;
  });
}

export function clearWidgetContent(forgetAccount = true) {
  return enqueue(async () => {
    clearSnapshots();
    if (forgetAccount) {
      await SecureStore.deleteItemAsync(accountKey);
      activeAccount = null;
    }
  });
}

export function syncWidgetPayload(
  data: Data,
  accountId: string,
  preferences: WidgetPreferences,
) {
  return enqueue(async () => {
    if (!preferences.enabled) {
      clearSnapshots();
      return;
    }
    if (activeAccount !== accountId) {
      const storedAccount = await SecureStore.getItemAsync(accountKey);
      if (storedAccount && storedAccount !== accountId) clearSnapshots();
      await SecureStore.setItemAsync(accountKey, accountId);
      activeAccount = accountId;
    }
    const now = new Date();
    const timeline = widgetTimelineDates(data, accountId, now).map((date) => ({
      date,
      props: deriveWidgetPayload(data, accountId, preferences, date, now),
    }));
    if (!timeline.length)
      timeline.push({
        date: now,
        props: deriveWidgetPayload(data, accountId, preferences, now, now),
      });
    FriendsNowWidget.updateTimeline(timeline);
    SquadBeaconsWidget.updateTimeline(timeline);
    NextBeaconWidget.updateTimeline(timeline);
    CirclePulseWidget.updateTimeline(timeline);
  });
}

export function clearWidgetSnapshotsOnly() {
  return clearWidgetContent(false);
}
