import { Share } from "react-native";
import * as ExpoLinking from "expo-linking";
import { router, type Href } from "expo-router";
import type { Activity,Data } from "@/src/shared/types";
import { canManageBeacon } from "@/src/features/beacons/permissions";
import { guestSharingOrigin } from "./guestTransport";

/** One entrypoint for Beacon cards, Browse, Map and Your Activity. */
export async function shareBeaconInvitation(data:Data,userId:string|null,activity:Activity) {
  if(!userId || data.viewer_id!==userId)throw new Error("Refresh before sharing this Beacon.");
  const origin=guestSharingOrigin();
  const status=activity.mode==="solo" && activity.solo_purpose!=="activity_note" && activity.owner_id===userId;
  if(origin && ((status && data.capabilities?.guest_planning) || (activity.mode!=="solo" && data.capabilities?.guest_sharing && (activity.owner_id===userId || canManageBeacon(data,activity,userId))))) {
    router.push(`/share?kind=${status ? "status" : "beacon"}&id=${encodeURIComponent(activity.id)}` as Href);
    return;
  }
  const url=origin ? `${origin}/activity/${encodeURIComponent(activity.id)}` : ExpoLinking.createURL(`/activity/${activity.id}`);
  await Share.share({title:activity.title,message:`${activity.title}\n${url}`,url});
}
