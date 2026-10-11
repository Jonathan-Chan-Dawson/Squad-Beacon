import type { PlaceCategory, PulsePlace } from "./types";

export type PlaceInterest = "pickup" | "study" | "food" | "hike" | "workout";
export const placeInterests: Record<PlaceCategory, PlaceInterest[]> = {
  court: ["pickup"], field: ["pickup"], recreation: ["pickup"],
  cafe: ["study", "food"], restaurant: ["food"], bar: ["food"],
  library: ["study"], study: ["study"], trail: ["hike"], park: ["hike", "pickup"],
  gym: ["workout"], parking: [], unknown: [], area: [],
};
export const interestLabels: Record<PlaceInterest, string> = {
  pickup: "pickup games", study: "studying", food: "getting food", hike: "hiking", workout: "working out",
};
export type PlaceTip = {
  id: string; text: string; helpful: number; accurateAt: number;
  own: boolean; helped: boolean; accuracy: "accurate" | "stale" | null;
};
export type PlaceKnowledge = {
  tips: PlaceTip[];
  interest: { kind: PlaceInterest; validUntil: number }[];
  ownInterest: PlaceInterest | null;
};
export const emptyKnowledge = (): PlaceKnowledge => ({ tips: [], interest: [], ownInterest: null });
export function canSharePlaceKnowledge(place: PulsePlace) {
  return !place.isArea && place.category !== "area" && !place.placeKey.startsWith("area:");
}
/** Only projected place facts cross this boundary; reporter IDs/coordinates never do. */
export function parsePlaceKnowledge(input: unknown): PlaceKnowledge {
  const result = emptyKnowledge();
  if (!input || typeof input !== "object") return result;
  const value = input as Record<string, unknown>;
  if (Array.isArray(value.tips)) result.tips = value.tips.slice(0, 4).flatMap((tip) => {
    if (!tip || typeof tip !== "object" || typeof tip.id !== "string" ||
      typeof tip.text !== "string" || !tip.text.trim() || tip.text.length > 180 ||
      !Number.isFinite(tip.helpful) || tip.helpful < 0 || !Number.isFinite(tip.accurateAt)) return [];
    return [{ id: tip.id, text: tip.text, helpful: Math.floor(tip.helpful), accurateAt: tip.accurateAt,
      own: tip.own === true, helped: tip.helped === true,
      accuracy: tip.accuracy === "accurate" || tip.accuracy === "stale" ? tip.accuracy : null }];
  });
  const isInterest = (kind: unknown): kind is PlaceInterest => typeof kind === "string" && Object.hasOwn(interestLabels, kind);
  if (Array.isArray(value.interest)) result.interest = value.interest.slice(0, 5).flatMap((signal) =>
    signal && isInterest(signal.kind) && Number.isFinite(signal.validUntil)
      ? [{ kind: signal.kind, validUntil: signal.validUntil }] : []);
  if (isInterest(value.ownInterest)) result.ownInterest = value.ownInterest;
  return result;
}
