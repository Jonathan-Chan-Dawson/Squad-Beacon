import type { Href } from "expo-router";

export const rewardLooks = {
  classic: { name: "Classic", slot: "skin", color: "#65E5E8", price: 0 },
  "ember-beam": {
    name: "Ember Beam",
    slot: "beam",
    color: "#FFC266",
    price: 100,
  },
  "prism-frame": {
    name: "Prism Frame",
    slot: "frame",
    color: "#C7A8FF",
    price: 250,
  },
  "static-bloom": {
    name: "Static Bloom",
    slot: "card",
    color: "#B19AFF",
    price: 350,
  },
  aurora: {
    name: "Aurora",
    slot: "skin",
    color: "#B19AFF",
    beam: "#75F3CD",
    price: 500,
  },
  celestial: {
    name: "Celestial",
    slot: "skin",
    color: "#C6BBFF",
    beam: "#A2CAFF",
    price: 1200,
  },
  legendary: {
    name: "Legendary",
    slot: "skin",
    color: "#FFE097",
    beam: "#FFC45A",
    price: 3500,
  },
  "starter-ring": {
    name: "Halo Ring",
    slot: "ring",
    color: "#BDA4FF",
    price: 75,
  },
  "signal-stamp": {
    name: "Signal Stamp",
    slot: "status",
    color: "#67DBD1",
    price: 150,
  },
  "lavender-signal": {
    name: "Lavender Signal Set",
    slot: "profile_set",
    color: "#C19BF8",
    price: 500,
  },
  "community-backdrop": {
    name: "Gathering Glow",
    slot: "community",
    color: "#74CBBE",
    price: 650,
  },
  "level-five-ring": {
    name: "Spark Ring",
    slot: "ring",
    color: "#85DAFA",
    price: 0,
  },
  "level-ten-accent": {
    name: "Relay Accent",
    slot: "profile_set",
    color: "#EFA8D7",
    price: 0,
  },
  "level-twenty-flair": {
    name: "Orbit Flair",
    slot: "frame",
    color: "#F0BA6D",
    price: 0,
  },
} as const;

export type LookId = keyof typeof rewardLooks;
export type EquippedLooks = Partial<Record<string, string>>;
export type RewardTarget =
  "activity" | "profile" | "squad" | "space" | "organization";

export const lookSlots = {
  activity: ["skin", "beam", "frame", "card"],
  profile: ["ring", "profile", "profile_card", "status"],
  squad: ["community"],
  space: ["community"],
  organization: ["community"],
} satisfies Record<RewardTarget, string[]>;

export const lookSlotLabels: Record<string, string> = {
  skin: "Beacon skin",
  beam: "Projector beam",
  frame: "Beacon frame",
  card: "Beacon card",
  ring: "Avatar ring",
  profile: "Profile",
  profile_card: "Profile card",
  status: "Status",
  community: "Community card",
  profile_set: "Profile set",
};

export function getRewardLook(id: string | undefined) {
  return id && Object.hasOwn(rewardLooks, id)
    ? rewardLooks[id as LookId]
    : undefined;
}

export function beaconMapLook(looks: EquippedLooks | undefined) {
  const skin =
    looks?.skin === "classic" ? undefined : getRewardLook(looks?.skin);
  return {
    frame: getRewardLook(looks?.frame)?.color ?? skin?.color,
    beam:
      getRewardLook(looks?.beam)?.color ??
      (skin && "beam" in skin ? skin.beam : undefined),
  };
}

export function rewardsHref(type: RewardTarget, id?: string): Href {
  return `/beacon-shop?type=${type}${id ? `&target=${encodeURIComponent(id)}` : ""}` as Href;
}

export function rewardTint(id: string | undefined, opacity = "20") {
  const look = getRewardLook(id);
  return look ? look.color + opacity : undefined;
}

export async function recordRewardDiscovery(
  viewer: string,
  action: "map" | "people",
  entity?: string,
) {
  const { supabase } = await import("@/src/shared/supabase");
  return supabase?.rpc("beacon_rewards", {
    p_viewer: viewer,
    p_action: "checkpoint",
    p_args: { action, ...(entity ? { entity } : {}) },
  });
}
