import type { Data } from "@/src/shared/types";
import { activeSpaceRole, canReadSpace } from "@/src/features/spaces/domain";
import {
  activeOrganizationRole,
  canReadOrganization,
} from "@/src/features/organizations/domain";
import { canOpenSquadProfile } from "./squadProfile";

export type SocialRecipient = {
  kind: "friend" | "squad" | "space" | "organization";
  id: string;
};
export type RecipientKind = SocialRecipient["kind"];
export const recipientKey = (row: SocialRecipient) => `${row.kind}:${row.id}`;
export const socialCategories = [
  "All",
  "Friends",
  "Squads",
  "Organizations",
  "Networks",
] as const;
export type SocialCategory = (typeof socialCategories)[number];
export const recipientCategory = {
  friend: "Friends",
  squad: "Squads",
  space: "Organizations",
  organization: "Networks",
} as const;

export function selectableSocialGroups(data: Data, viewerId: string | null) {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  return [
    ...data.squads
      .filter(
        (row) =>
          canOpenSquadProfile(data, row.id, viewerId) &&
          data.squad_members.some(
            (member) =>
              member.squad_id === row.id && member.user_id === viewerId,
          ),
      )
      .map((row) => ({ kind: "squad" as const, id: row.id, name: row.name })),
    ...data.spaces
      .filter((row) => canOpenSpace(row))
      .map((row) => ({ kind: "space" as const, id: row.id, name: row.name })),
    ...data.organizations
      .filter(
        (row) =>
          !row.archived_at &&
          canReadOrganization(data, row.id, viewerId) &&
          activeOrganizationRole(row, data.organization_members, viewerId) !==
            null,
      )
      .map((row) => ({
        kind: "organization" as const,
        id: row.id,
        name: row.name,
      })),
  ];
  function canOpenSpace(row: Data["spaces"][number]) {
    return (
      !row.archived_at &&
      canReadSpace(data, row.id, viewerId) &&
      activeSpaceRole(row, data.space_members, viewerId!) !== null
    );
  }
}

export function addShownRecipients(
  selected: SocialRecipient[],
  shown: SocialRecipient[],
) {
  const existing = new Set(selected.map(recipientKey));
  const added = [
    ...new Map(
      shown
        .filter((row) => !existing.has(recipientKey(row)))
        .map((row) => [recipientKey(row), row]),
    ).values(),
  ];
  return {
    selected: [...selected, ...added],
    addedKeys: added.map(recipientKey),
  };
}

export function undoShownRecipients(
  selected: SocialRecipient[],
  addedKeys: string[],
) {
  const keys = new Set(addedKeys);
  return selected.filter((row) => !keys.has(recipientKey(row)));
}
