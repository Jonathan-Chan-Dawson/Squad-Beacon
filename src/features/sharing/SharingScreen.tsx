import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Screen, Txt } from "@/src/shared/ui";
import { canManageBeacon } from "@/src/features/beacons/permissions";
import { canManagePlanningThread, canReadPlanningThread } from "@/src/features/planning/domain";
import { planPermissions, planStops, stopActivity, stopThread } from "@/src/features/plans/livingPlans";
import { GuestShareSheet, type GuestShareProps } from "./GuestShareSheet";
import { guestSharingOrigin } from "./guestTransport";

export default function SharingScreen() {
  const {data,userId}=useBeacon();
  const params=useLocalSearchParams<{ id?:string; kind?:string }>();
  let props: Omit<GuestShareProps,"visible"|"onClose"> | null=null;
  if(userId && data.viewer_id===userId && guestSharingOrigin()) {
    if(params.kind==="beacon" || params.kind==="status") {
      const a=data.activities.find(a=>a.id===params.id);
      if(a && params.kind==="beacon" && data.capabilities?.guest_sharing && a.mode!=="solo" && (a.owner_id===userId || canManageBeacon(data,a,userId)))props={kind:"beacon",target:a.id,title:a.title};
      if(a && params.kind==="status" && data.capabilities?.guest_planning && a.mode==="solo" && a.solo_purpose!=="activity_note" && a.owner_id===userId)props={kind:"status",target:a.id,title:"A note from Squad Beacon",statusText:a.title,expiresAt:a.ends_at,readOnly:true};
    } else if(params.kind==="decision" && data.capabilities?.guest_planning) {
      const t=data.planning_threads.find(t=>t.id===params.id);
      if(t && canReadPlanningThread(data,t,userId) && canManagePlanningThread(t,userId))props={kind:"decision",target:t.id,title:t.title,readOnly:t.kind==="draw"};
    } else if(params.kind==="plan" && data.capabilities?.guest_planning) {
      const p=data.plans.find(p=>p.id===params.id);
      if(p && !p.routine_source && planPermissions(data,p,userId).editor)props={kind:"plan",target:p.id,title:p.title,readOnly:true,stops:planStops(data,p,userId).filter(s=>s.approval==="approved" && s.state==="active").map(s=>({id:s.id,title:stopActivity(data,s,userId)?.title || stopThread(data,s,userId)?.title || s.title || "Plan stop"}))};
    }
  }
  return <Screen title="Share invitation" eyebrow="EXTERNAL INVITATION" create={false}>{props ? <GuestShareSheet {...props} visible onClose={()=>router.back()} /> : <Txt>This item is not available for guest sharing.</Txt>}</Screen>;
}
