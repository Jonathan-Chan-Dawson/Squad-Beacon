const stages = [
  [0, "Spark"],
  [5, "Ping"],
  [10, "Signal"],
  [20, "Pulse"],
  [35, "Static"],
  [50, "Relay"],
  [75, "Frequency"],
  [100, "Amplifier"],
  [150, "High Gain"],
  [250, "Broadcast"],
  [400, "Tower"],
  [650, "Skywave"],
  [1_000, "Citywide"],
  [2_000, "Cross-Country"],
  [3_500, "Worldwide"],
  [5_000, "Uplink"],
  [8_000, "Orbit"],
  [12_000, "Moonshot"],
  [18_000, "Deep Space"],
  [25_000, "Solar Flare"],
  [35_000, "Pulsar"],
  [50_000, "Nebula"],
  [70_000, "Star Cluster"],
  [90_000, "Supernova"],
  [120_000, "Galactic"],
  [160_000, "Quasar"],
  [210_000, "Wormhole"],
  [270_000, "Event Horizon"],
  [340_000, "Gravity Wave"],
  [420_000, "Dark Matter"],
  [520_000, "Multiverse"],
  [640_000, "Time Loop"],
  [750_000, "Beyond Light"],
  [850_000, "Big Bang"],
  [925_000, "Cosmic Echo"],
  [975_000, "Star Atlas"],
  [1_000_000, "Cosmic Beacon"],
  [1_150_000, "Dark Sky"],
  [1_300_000, "Gravity Well"],
  [1_500_000, "Starlight"],
  [1_700_000, "Far Horizon"],
  [1_950_000, "Deep Orbit"],
  [2_200_000, "Nova Chain"],
  [2_500_000, "Star Bridge"],
  [2_850_000, "Cosmic Tide"],
  [3_250_000, "Void Signal"],
  [3_650_000, "Eternal Orbit"],
  [4_100_000, "First Light"],
  [4_550_000, "The Last Star"],
  [5_000_000, "Infinite Signal"],
] as const;

const tints = [
  "#82D7EA",
  "#AAB8FF",
  "#F1A6CF",
  "#F5C481",
  "#A0E6BD",
  "#DDABFF",
];

export const scoreTiers = stages.map(([at, label], index) => ({
  at,
  label,
  tint: tints[index % tints.length],
}));

export function beaconScoreTier(points: number) {
  const upcoming = scoreTiers.findIndex(({ at }) => at > points);
  const index =
    upcoming === -1 ? scoreTiers.length - 1 : Math.max(0, upcoming - 1);
  return { index, stage: scoreTiers[index], nextStage: scoreTiers[index + 1] };
}

export function tapsPerPoint(points: number) {
  return Math.max(1, 8 - Math.floor(beaconScoreTier(points).index / 3));
}

/** Advance by rate boundaries rather than looping once per tap. */
export function applyScoreTaps(points: number, pendingTaps: number) {
  let remaining = pendingTaps;
  while (remaining > 0) {
    const { index } = beaconScoreTier(points);
    const rate = tapsPerPoint(points);
    const boundary = rate === 1 ? undefined : scoreTiers[3 * (Math.floor(index / 3) + 1)].at;
    const earned = Math.min(Math.floor(remaining / rate), boundary === undefined ? Infinity : boundary - points);
    if (!earned) break;
    points += earned;
    remaining -= earned * rate;
  }
  return { points, remaining, rate: tapsPerPoint(points) };
}

export const scoreRewardLabels = {
  tap: "Tiny Beacon taps",
  legacy: "Previous tiny Beacon taps",
  attend: "Checked in to a Beacon",
  host: "Hosted a Beacon",
  joined: "Someone joined a Beacon you hosted",
  friend: "Connected with a friend",
  comment: "Received a comment on your Beacon",
  message: "Received a chat message in your Beacon",
  reaction: "Received a reaction on your Beacon",
} as const;

export const scoreRewards = {
  attend: 500,
  host: 500,
  joined: 100,
  friend: 2000,
  comment: 20,
  message: 2,
  reaction: 20,
} as const;

export type BeaconScore = {
  total: number;
  credited: number;
  tap_remainder: number;
  show_badge: boolean;
  rewards: Record<keyof typeof scoreRewards, number>;
  history: {
    id: number;
    kind: keyof typeof scoreRewardLabels;
    points: number;
    earned_at: string;
  }[];
};
