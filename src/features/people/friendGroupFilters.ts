import type { Data } from "@/src/shared/types";
import { selectListPeople, type PeopleListSelection } from "./privateLists";
import {
  recipientKey,
  selectableSocialGroups,
  type SocialRecipient,
} from "./socialSelection";

/** Groups narrow an accepted-friend roster; they never become sharing recipients. */
export function filteredFriendIds(
  data: Data,
  viewer: string | null,
  filter: {
    list?: PeopleListSelection;
    group?: SocialRecipient | null;
    selected?: readonly string[];
  } = {},
) {
  const eligible = selectListPeople(data, viewer, filter.list);
  if (filter.group) {
    const group = filter.group;
    if (
      !selectableSocialGroups(data, viewer).some(
        (row) => recipientKey(row) === recipientKey(group),
      )
    )
      return new Set<string>();
    const members =
      group.kind === "squad"
        ? data.squad_members
            .filter(
              (m) =>
                m.squad_id === group.id &&
                !data.squad_bans.some(
                  (b) => b.squad_id === group.id && b.user_id === m.user_id,
                ),
            )
            .map((m) => m.user_id)
        : group.kind === "space"
          ? [
              ...data.space_members
                .filter(
                  (m) =>
                    m.space_id === group.id &&
                    m.status === "active" &&
                    !data.space_bans.some(
                      (b) => b.space_id === group.id && b.user_id === m.user_id,
                    ),
                )
                .map((m) => m.user_id),
              ...data.spaces
                .filter((g) => g.id === group.id)
                .map((g) => g.owner_id),
            ]
          : group.kind === "organization"
            ? [
                ...data.organization_members
                  .filter(
                    (m) =>
                      m.organization_id === group.id &&
                      m.status === "active" &&
                      !data.organization_bans.some(
                        (b) =>
                          b.organization_id === group.id &&
                          b.user_id === m.user_id,
                      ),
                  )
                  .map((m) => m.user_id),
                ...data.organizations
                  .filter((g) => g.id === group.id)
                  .map((g) => g.owner_id),
              ]
            : [];
    for (const id of eligible) if (!members.includes(id)) eligible.delete(id);
  }
  if (filter.selected)
    for (const id of eligible)
      if (!filter.selected.includes(id)) eligible.delete(id);
  return eligible;
}
