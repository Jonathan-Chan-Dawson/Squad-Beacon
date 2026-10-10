import type { PlaceCategory } from "@/src/features/maps/placeCategories";
export type { PlaceCategory } from "@/src/features/maps/placeCategories";
export const PULSE_KINDS = [
  "crowd",
  "wait",
  "parking",
  "availability",
  "condition",
] as const;
export type PulseKind = (typeof PULSE_KINDS)[number];
export type CrowdLevel = 0 | 1 | 2 | 3;
export type WaitBucket = 0 | 1 | 2 | 3;
export type ParkingLevel = 0 | 1 | 2;
export type PulseCondition =
  | "seats_available"
  | "courts_open"
  | "courts_occupied"
  | "people_waiting"
  | "equipment_available"
  | "trail_muddy"
  | "field_wet"
  | "blocked_closed";
export type PulseAnswers = Partial<Record<PulseKind, number | PulseCondition>>;
export interface PulsePlace {
  placeKey: string;
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  isArea?: boolean;
}
export interface PulseDraft {
  place: PulsePlace;
  answers: PulseAnswers;
  note?: string;
}
/** UI boundary: no report IDs, reporter identities or raw rows. */
export interface PulseSummary {
  placeKey: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  crowd?: CrowdLevel;
  wait?: WaitBucket;
  parking?: ParkingLevel;
  conditions: { key: PulseCondition; strength: "reported" | "likely" }[];
  recentCount: number;
  confirmCount: number;
  updatedAt: number;
  freshness: number;
  importance: number;
  noteSample?: string;
  confidence?: Partial<Record<PulseKind, number>>;
  generatedAt?: number;
  signals?: Partial<
    Record<
      PulseKind,
      {
        totalWeight: number;
        freshness: number;
        validUntil: number;
        count: number;
        updatedAt: number;
      }
    >
  >;
  noteValidUntil?: number;
}
