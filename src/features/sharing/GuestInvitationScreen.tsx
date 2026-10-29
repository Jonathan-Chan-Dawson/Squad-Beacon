import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";
import { Action, Screen, Txt } from "@/src/shared/ui";
import { guestSharingOrigin } from "./guestTransport";

export default function GuestInvitationScreen() {
  const {token,target}=useLocalSearchParams<{token?:string;target?:string}>();
  const origin=guestSharingOrigin();
  const validToken=typeof token==='string' && /^[A-Za-z0-9_-]{43}$/.test(token);
  const validTarget=typeof target==='string' && /^[a-f0-9-]{36}$/i.test(target) ? target : null;
  const url=origin && validToken && (target == null || validTarget) ? `${origin}/g/${token}${validTarget ? `?target=${validTarget}` : ''}` : null;
  const webUrl=origin && validToken && (target == null || validTarget) ? `${origin}/api/guest?token=${token}${validTarget ? `&target=${validTarget}` : ''}` : null;
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!url)return;
    let active=true;
    if(Platform.OS==='web') { if(webUrl)window.location.replace(webUrl);return; }
    // Opening a browser session avoids bouncing the same Universal Link back
    // into the app and retains the browser's verified guest session.
    void WebBrowser.openBrowserAsync(url).catch(()=>{if(active)setError("The invitation could not be opened. Try again.");});
    return ()=>{active=false;};
  },[url,webUrl]);
  return <Screen title="Your invitation" eyebrow="SHARE & JOIN" create={false}><Txt>{url ? "View and respond securely in your browser. No member account is required." : "This invitation is unavailable or guest sharing is not configured."}</Txt>{error ? <Txt>{error}</Txt> : null}{url ? <Action title="Open invitation" run={async()=>{await WebBrowser.openBrowserAsync(url);}} /> : null}</Screen>;
}
