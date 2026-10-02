import type { Category, ID } from "@/src/shared/types";

/**
 * Safe public card projection. Do not replace this with Activity: the public
 * directory deliberately omits host profiles, descriptions, exact places,
 * attendees, chat, and beacon tools.
 */
export interface PublicBeaconSummary {
  activity_id: ID;
  title: string;
  category: Category;
  interest_tags: string[];
  starts_at: string;
  ends_at: string;
  area_label: string;
  coarse_lat: number | null;
  coarse_lng: number | null;
  requires_approval: boolean;
  capacity_limit: number | null;
  capacity_policy: "soft" | "strict";
  accepted_seat_count: number;
  closed: boolean;
}

export interface PublicDiscoveryFilters {
  query: string;
  category: Category | "All";
  interest: string;
  area: string;
}

export interface PublicDiscoveryOptIn {
  activity_id: ID;
  area_label: string;
  coarse_lat?: number;
  coarse_lng?: number;
}

export type PublicDiscoveryAction =
  | { type: "publish_beacon_discovery"; input: PublicDiscoveryOptIn }
  | { type: "unpublish_beacon_discovery"; input: { activity_id: ID } }
  | { type: "join_public_beacon"; input: { activity_id: ID } };
