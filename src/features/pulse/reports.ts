import type { PlaceCategory, PulseCondition, PulseKind } from "./types";
/** Pure-core input only. Never fetched by or passed to UI; independent rows are enforced server-side. */
export interface PulseReport {
  id: string;
  placeKey: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  kind: PulseKind;
  value: number | PulseCondition;
  note?: string;
  createdAt: number;
  expiresAt: number;
  lastConfirmedAt?: number;
  confirmCount: number;
}
