import { useNow } from "@/src/shared/useNow";
import React, { useRef, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen, Button } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { StatusPanel } from "../components/feed/StatusPanel";
import { legacyStatusSeed } from "../statusRouteSeed";
import { saveOwnStatus, type StatusDraft } from "../components/feed/statusActions";

export function LegacyStatusScreen({ params }: { params: Record<string, unknown> }) {
  const { data, userId } = useBeacon();
  const now = useNow();
  if (!userId || data.viewer_id !== userId) return <Screen title="Your status" eyebrow="" create={false}><Text>Refresh your profile before sharing a status.</Text></Screen>;
  let seed: StatusDraft | undefined;
  let error = "";
  try { seed = legacyStatusSeed(data, userId, params, now); }
  catch (failure) { error = failure instanceof Error ? failure.message : "Status context unavailable."; }
  if (!seed) return <Screen title="Your status" eyebrow="" create={false}><Text accessibilityRole="alert">{error}</Text>
    <Button title="Open status without this context" onPress={() => router.replace({ pathname: "/create", params: { kind: "status" } })} /></Screen>;
  return <LegacyStatusEditor key={userId + JSON.stringify(params)} seed={seed} />;
}
function LegacyStatusEditor({ seed }: { seed: StatusDraft }) {
  const { data, userId, act } = useBeacon();
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const leave = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/activities"); };
  const save = async (value: StatusDraft) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try { await saveOwnStatus(data, userId, value, act, Date.now()); setOpen(false); leave(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your status."); throw failure; }
    finally { busy.current = false; setSaving(false); }
  };
  return <Screen title="Your status" eyebrow="" create={false}>
    <StatusPanel initialDraft={seed} advanced compact profile={data.profiles.find((item) => item.id === userId)} status={null}
      editorVisible={open} saving={saving} error={error} onCreate={() => setOpen(true)} onEdit={() => setOpen(true)}
      onCloseEditor={() => { if (!busy.current) leave(); }} onSave={save}
      onClear={async () => { throw new Error("Clear your current status from Beacons or Profile."); }} onConvert={() => undefined} />
  </Screen>;
}
