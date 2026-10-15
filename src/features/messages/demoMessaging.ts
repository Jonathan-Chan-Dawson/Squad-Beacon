import type { Data, Payload } from "@/src/shared/types";
import {
  privateListName,
  selectListPeople,
  listIsUsed,
} from "@/src/features/people/privateLists";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import { canReadOrganizationMembers } from "@/src/features/organizations/domain";
import { afterReadMarker } from "./readMarkers";

export function applyDemoMessaging(
  data: Data,
  viewer: string,
  action: string,
  payload: Payload,
  newId: () => string,
) {
  if (
    ![
      "create_list",
      "rename_list",
      "delete_list",
      "list_member",
      "mark_dm_chat_read",
    ].includes(action) &&
    !(action === "mark_group_chat_read" && payload.message_id)
  )
    return false;
  if (data.viewer_id !== viewer) throw new Error("Refresh before continuing.");
  const id = String(payload.id ?? "");
  if (
    ["create_list", "rename_list", "delete_list", "list_member"].includes(
      action,
    )
  ) {
    const list = data.lists.find(
      (row) => row.id === id && row.owner_id === viewer,
    );
    if (action !== "create_list" && !list)
      throw new Error("Choose your own private list.");
    if (action === "delete_list") {
      if (listIsUsed(data, id))
        throw new Error(
          "This list is still used for sharing. Remove its audience references before deleting it.",
        );
      data.lists = data.lists.filter((row) => row.id !== id);
      data.list_members = data.list_members.filter((row) => row.list_id !== id);
    } else if (action === "list_member") {
      const person = String(payload.user_id ?? "");
      if (!selectListPeople(data, viewer).has(person))
        throw new Error("Choose your own list and an accepted friend.");
      data.list_members = data.list_members.filter(
        (row) => !(row.list_id === id && row.user_id === person),
      );
      if (payload.add) data.list_members.push({ list_id: id, user_id: person });
    } else {
      const name = privateListName(payload.name);
      if (
        data.lists.some(
          (row) =>
            row.owner_id === viewer && row.id !== id && row.name === name,
        )
      )
        throw new Error("You already have a list with that name.");
      if (list) list.name = name;
      else data.lists.push({ id: newId(), owner_id: viewer, name });
    }
    return true;
  }
  const messageId = String(payload.message_id ?? "");
  if (action === "mark_dm_chat_read") {
    const peer = String(payload.peer_id ?? "");
    if (!selectListPeople(data, viewer).has(peer))
      throw new Error("This conversation is unavailable.");
    const message = data.messages.find(
      (row) =>
        row.id === messageId &&
        !row.activity_id &&
        ((row.author_id === viewer && row.recipient_id === peer) ||
          (row.author_id === peer && row.recipient_id === viewer)),
    );
    if (!message) throw new Error("Choose a message from this conversation.");
    data.dm_message_reads ??= [];
    const marker = data.dm_message_reads.find(
      (row) => row.user_id === viewer && row.peer_id === peer,
    );
    if (afterReadMarker(message, marker)) {
      const next = {
        user_id: viewer,
        peer_id: peer,
        last_read_at: message.created_at,
        last_read_message_id: message.id,
      };
      if (marker) Object.assign(marker, next);
      else data.dm_message_reads.push(next);
    }
  } else {
    const scope = payload.scope;
    const scopeId = String(
      scope === "squad"
        ? (payload.squad_id ?? "")
        : (payload.organization_id ?? ""),
    );
    if (
      !(scope === "squad"
        ? activeSquadMembership(data, scopeId, viewer)
        : scope === "organization" &&
          canReadOrganizationMembers(data, scopeId, viewer))
    )
      throw new Error("That group chat is unavailable to you.");
    const message = data.group_messages.find(
      (row) =>
        row.id === messageId &&
        row.scope === scope &&
        row.scope_id === scopeId &&
        !data.blocks.some(
          (block) =>
            (block.blocker_id === viewer &&
              block.blocked_id === row.author_id) ||
            (block.blocked_id === viewer && block.blocker_id === row.author_id),
        ),
    );
    if (!message) throw new Error("Choose a message from this group.");
    const marker = data.group_message_reads.find(
      (row) =>
        row.scope === scope &&
        row.scope_id === scopeId &&
        row.user_id === viewer,
    );
    if (afterReadMarker(message, marker)) {
      const next = {
        scope: message.scope,
        scope_id: scopeId,
        squad_id: message.squad_id,
        organization_id: message.organization_id,
        user_id: viewer,
        last_read_at: message.created_at,
        last_read_message_id: message.id,
      };
      if (marker) Object.assign(marker, next);
      else data.group_message_reads.push(next);
    }
  }
  return true;
}
