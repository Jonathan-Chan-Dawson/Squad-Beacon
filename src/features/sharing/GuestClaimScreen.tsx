import React, { useState } from "react";
import { Linking, Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Screen, Txt } from "@/src/shared/ui";
import { guestSharingOrigin, manageGuestAccess } from "./guestTransport";

type Preview = { claimed: boolean; eligible: number; conflicts: number; historical: number };
export default function GuestClaimScreen() {
  const { userId, viewerEpoch } = useBeacon();
  return <ClaimSession key={`${userId}:${viewerEpoch}`} />;
}
function ClaimSession() {
  const { userId, getViewerEpoch } = useBeacon();
  const [preview,setPreview] = useState<Preview | null>(null);
  const [finished,setFinished] = useState(false);
  const params=useLocalSearchParams<{ invitation?: string; target?: string }>();
  const origin=guestSharingOrigin();
  const token=typeof params.invitation === "string" && /^[A-Za-z0-9_-]{43}$/.test(params.invitation) ? params.invitation : null;
  const target=typeof params.target === "string" && /^[a-f0-9-]{36}$/i.test(params.target) ? params.target : null;
  const returnUrl=origin && token ? `${origin}/g/${token}${target ? `?target=${target}` : ""}` : null;
  const claim=async(command: "preview" | "confirm")=>{
    if(!userId) throw new Error("Sign in to your member account first.");
    const epoch=getViewerEpoch();
    const result=await manageGuestAccess<Preview>(userId,{ action:"claim",command },()=>{if(getViewerEpoch()!==epoch)throw new Error("Your account changed. Reopen claiming.");});
    setPreview(result);if(command==="confirm" || result.claimed)setFinished(true);
  };
  return <Screen title="Keep your participation" eyebrow="YOUR CONNECTIONS" create={false}>
    <View style={{gap:16}}>
      <Txt>Review and explicitly claim eligible responses from your verified guest identity into this signed-in member account.</Txt>
      <Txt muted>Existing member responses take precedence. Approval states stay unchanged. Finalized decisions and past events keep their recorded history. Organizer restrictions and revoked links remain in effect. No friendships, Squad membership or organizer roles are added.</Txt>
      {Platform.OS !== "web" ? <><Txt>Open this secure flow in the browser where you verified guest access, then sign in there to prove both identities.</Txt><Action title="Open secure claiming in browser" run={async()=>{if(!origin)throw new Error("Guest sharing is not configured yet.");await Linking.openURL(`${origin}/guest-claim${token ? `?invitation=${token}${target ? `&target=${target}` : ""}` : ""}`);}} /></> : <>
        {!preview ? <Action title="Review prior responses" run={()=>claim("preview")} /> : null}
        {preview ? <Txt>{preview.eligible} eligible responses · {preview.conflicts} member responses preserved · {preview.historical} historical or inaccessible responses left unchanged</Txt> : null}
        {preview && !finished ? <Action title="Confirm claim to this account" run={()=>claim("confirm")} /> : null}
        {finished ? <View accessibilityRole="alert"><Txt>Your eligible responses are linked to this member account. To edit in a guest browser, verify with this member account’s email address.</Txt></View> : null}
      </>}
      {returnUrl ? <Button secondary title="Return to invitation" onPress={()=>void Linking.openURL(returnUrl)} /> : <Button secondary title="Back to your activity" onPress={()=>router.back()} />}
    </View>
  </Screen>;
}
