import { useEffect, useState } from "react";
import { useBeacon } from "@/src/shared/store";
import type { Data } from "@/src/shared/types";
import type { RoutineCalendarRange, RoutineCalendarResult } from "./calendarRoutineProjection";

export function useRoutineCalendar(range: RoutineCalendarRange) {
  const { data,userId,viewerEpoch,getViewerEpoch,loadRoutineCalendar }=useBeacon();
  const [attempt,setAttempt]=useState(0);
  const key=JSON.stringify([userId,data.viewer_id,viewerEpoch,range.startOn,range.endOn,attempt]);
  const [response,setResponse]=useState<{key:string; snapshot:Data; result?:RoutineCalendarResult; error?:string}>();
  const authorized=!!userId && data.viewer_id===userId;
  useEffect(()=>{
    if (!authorized) return;
    let cancelled=false;
    const generation=getViewerEpoch();
    void loadRoutineCalendar({startOn:range.startOn,endOn:range.endOn}).then((result)=>{
      if (!cancelled && generation===getViewerEpoch()) setResponse({key,snapshot:data,result});
    }).catch((failure)=>{
      if (!cancelled && generation===getViewerEpoch()) setResponse({key,snapshot:data,error:failure instanceof Error ? failure.message : "Could not load Routine dates. Try again."});
    });
    return ()=>{cancelled=true;};
  },[authorized,data,key,getViewerEpoch,loadRoutineCalendar,range.startOn,range.endOn]);
  const current=authorized && response?.key===key && response.snapshot===data ? response : undefined;
  return {rows:current?.result?.rows ?? [],truncated:current?.result?.truncated ?? false,error:current?.error ?? "",loading:authorized && !current,retry:()=>setAttempt((value)=>value+1)};
}
