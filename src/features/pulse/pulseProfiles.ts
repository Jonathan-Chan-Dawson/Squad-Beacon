import type { PlaceCategory, PulseCondition, PulseKind } from "./types";
export interface PulseGroup {
  kind: PulseKind;
  options: (number | PulseCondition)[];
}
const crowd: PulseGroup = { kind: "crowd", options: [0, 1, 2, 3] };
const wait: PulseGroup = { kind: "wait", options: [0, 1, 2, 3] };
const seats: PulseGroup = {
  kind: "availability",
  options: ["seats_available"],
};
const food = { groups: [crowd, wait, seats] };
const recreation = {
  groups: [
    {
      kind: "availability" as const,
      options: [
        "courts_open",
        "courts_occupied",
        "people_waiting",
      ] as PulseCondition[],
    },
    { kind: "condition" as const, options: ["field_wet"] as PulseCondition[] },
  ],
};
const outdoors = {
  groups: [
    { kind: "crowd" as const, options: [0, 1, 2] },
    {
      kind: "condition" as const,
      options: ["trail_muddy", "blocked_closed"] as PulseCondition[],
    },
  ],
};
export const pulseProfiles: Record<PlaceCategory, { groups: PulseGroup[] }> = {
  restaurant: food,
  cafe: food,
  bar: food,
  gym: {
    groups: [crowd, { kind: "availability", options: ["equipment_available"] }],
  },
  court: recreation,
  field: recreation,
  recreation,
  parking: { groups: [{ kind: "parking", options: [0, 1, 2] }] },
  trail: outdoors,
  park: outdoors,
  library: { groups: [crowd, seats] },
  study: { groups: [crowd, seats] },
  unknown: { groups: [crowd] },
  area: { groups: [crowd] },
};
export function validPulseAnswer(
  category: PlaceCategory,
  kind: PulseKind,
  value: unknown,
) {
  return (
    pulseProfiles[category]?.groups.some(
      (group) =>
        group.kind === kind && group.options.some((option) => option === value),
    ) ?? false
  );
}
