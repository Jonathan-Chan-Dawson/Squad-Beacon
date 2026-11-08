import type { PremiumTier } from "./entitlements";

/** Stable identifiers shared by configuration writers and contextual UI. */
export const premiumFeatures = {
  checklist_details: {
    tier: "plus",
    status: "available",
    scope: "shared",
    label: "Task assignments, deadlines and reminders",
  },
  checklist_presets: {
    tier: "plus",
    status: "available",
    scope: "personal",
    label: "Reusable Lists",
  },
  library_organization: {
    tier: "plus",
    status: "available",
    scope: "personal",
    label: "Library organization",
  },
  preparation: {
    tier: "pro",
    status: "available",
    scope: "shared",
    label: "Plan preparation overview",
  },
  focus_sequences: {
    tier: "plus",
    status: "available",
    scope: "shared",
    label: "Custom focus sequences",
  },
  focus_groups: {
    tier: "pro",
    status: "available",
    scope: "shared",
    label: "Grouped focus sessions",
  },
  journal_formatting: {
    tier: "plus",
    status: "available",
    scope: "shared",
    label: "Journal formatting and tags",
  },
  journal_templates: {
    tier: "plus",
    status: "available",
    scope: "personal",
    label: "Journal templates",
  },
  journal_reflections: {
    tier: "pro",
    status: "available",
    scope: "shared",
    label: "Linked reflections and filters",
  },
  memory_collections: {
    tier: "plus",
    status: "available",
    scope: "shared",
    label: "Memory albums and highlights",
  },
  afterglow: {
    tier: "pro",
    status: "available",
    scope: "shared",
    label: "Multi-Beacon Afterglow",
  },
  team_presets: {
    tier: "plus",
    status: "available",
    scope: "shared",
    label: "Team and scoring presets",
  },
  team_rotation: {
    tier: "pro",
    status: "available",
    scope: "shared",
    label: "Plan team rotation",
  },
  council_presets: {
    tier: "plus",
    status: "available",
    scope: "shared",
    label: "Council setups and option groups",
  },
  council_readiness: {
    tier: "pro",
    status: "available",
    scope: "shared",
    label: "Council preparation checks",
  },
  appearance: {
    tier: "plus",
    status: "available",
    scope: "shared",
    label: "Additional Beacon styles",
  },
  layouts: {
    tier: "pro",
    status: "available",
    scope: "shared",
    label: "Preparation and session layouts",
  },
} as const satisfies Record<
  string,
  {
    tier: PremiumTier;
    status: "available";
    scope: "personal" | "shared";
    label: string;
  }
>;
export type PremiumFeature = keyof typeof premiumFeatures;
export const tierRank = (tier: PremiumTier) =>
  tier === "pro" ? 2 : tier === "plus" ? 1 : 0;
export const higherTier = (a: PremiumTier, b: PremiumTier): PremiumTier =>
  tierRank(a) >= tierRank(b) ? a : b;
export const boostTier = (count: number): PremiumTier =>
  count >= 4 ? "pro" : count >= 2 ? "plus" : "free";
export type SharedPremiumProjection = {
  tier: PremiumTier;
  source: "verified" | "squad" | "grace" | "free";
  grace_until: string | null;
};
export type SquadPremiumProjection = SharedPremiumProjection & {
  squad_id: string;
  total: number;
  qualified_tier: PremiumTier;
  contributors: { allocation_id: string; user_id: string | null }[];
};
export type BoostAllocation = {
  id: string;
  owner_id: string;
  squad_id: string | null;
  assigned_at: string;
  released_at: string | null;
  available_at: string | null;
  hidden: boolean;
};
export type ChecklistTiming = {
  due_on?: string | null;
  due_at?: string | null;
  due_timezone?: string | null;
  reminder_minutes?: number | null;
};
export function validateChecklistTiming(value: ChecklistTiming) {
  if (
    value.due_on &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value.due_on) ||
      new Date(value.due_on).toISOString().slice(0, 10) !== value.due_on)
  )
    throw new Error("Choose a valid due date.");
  if (value.due_at && !Number.isFinite(Date.parse(value.due_at)))
    throw new Error("Choose a valid due time.");
  if (value.due_on && value.due_at)
    throw new Error("Choose a due date or a due time.");
  if (value.due_timezone)
    new Intl.DateTimeFormat("en", { timeZone: value.due_timezone });
  if (
    value.reminder_minutes != null &&
    (!Number.isInteger(value.reminder_minutes) ||
      value.reminder_minutes < 0 ||
      value.reminder_minutes > 10080 ||
      (!value.due_on && !value.due_at))
  )
    throw new Error(
      "Choose a deadline and a reminder up to seven days before it.",
    );
}
