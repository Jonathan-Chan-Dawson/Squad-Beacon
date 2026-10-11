import type { Data, Payload } from "@/src/shared/types";
import type { SocialDirectorySummary } from "./types";

/** Shared by directory and Map previews; all membership uses canonical actions. */
export async function performDirectoryAction(
  row: SocialDirectorySummary,
  data: Data,
  viewerId: string,
  act: (action: string, payload: Payload) => Promise<unknown>,
) {
  if (data.viewer_id !== viewerId)
    throw new Error("Refresh discovery to continue.");
  const type = row.entity_type;
  const payload = { [`${type}_id`]: row.entity_id };
  if (row.action === "join") await act(`join_${type}`, payload);
  else if (row.action === "request") await act(`request_${type}_join`, payload);
  else if (row.action === "requested")
    await act(`cancel_${type}_join_request`, payload);
  else if (row.action === "invited") {
    if (type !== "squad")
      await act(`respond_${type}_invite`, { ...payload, accept: true });
    else {
      const invite = data.squad_invites.find(
        (item) =>
          item.squad_id === row.entity_id && item.recipient_id === viewerId,
      );
      if (!invite)
        throw new Error("Invitation unavailable. Refresh discovery.");
      await act("accept_squad", { id: invite.id });
    }
  }
}
