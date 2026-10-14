import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useDesignTheme } from "@/src/shared/design-system";
import { StatusPanel } from "./StatusPanel";
import { clearOwnStatuses, liveOwnedStatuses, saveOwnStatus, type StatusDraft } from "./statusActions";

export function useOwnStatusControl() {
  const { data, userId, act } = useBeacon();
  const tick = useNow();
  const [acknowledged, setAcknowledged] = useState(0);
  const [editorVisible, setEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const status = liveOwnedStatuses(data, userId, Math.max(tick, acknowledged))[0];
  const profile = userId && data.viewer_id === userId ? data.profiles.find((item) => item.id === userId) : undefined;
  const mutate = async (value?: StatusDraft) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError("");
    try {
      const current = Date.now();
      const result = value ? await saveOwnStatus(data, userId, value, act, current) : await clearOwnStatuses(data, userId, act, current);
      setAcknowledged(Date.now());
      setError(result.message);
      if (!result.message) setEditorVisible(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update your status. Try again.");
      throw failure;
    } finally { busyRef.current = false; setSaving(false); }
  };
  return { status, profile, editorVisible, saving, error,
    open: () => setEditorVisible(true), close: () => { if (!saving) setEditorVisible(false); },
    save: (value: StatusDraft) => mutate(value), clear: () => mutate(),
    convert: () => {
      if (!status) return;
      setEditorVisible(false);
      router.push({ pathname: "/create", params: { statusSourceId: status.id } });
    },
  };
}

export function SharedStatusControl({ compact = false, avatarControl = false }: { compact?: boolean; avatarControl?: boolean }) {
  const control = useOwnStatusControl();
  const { colors, tokens } = useDesignTheme();
  return <View>
    <StatusPanel compact={compact} avatarControl={avatarControl} profile={control.profile}
      status={control.status ? { id: control.status.id, title: control.status.title, available: control.status.available === true,
        startsAt: control.status.starts_at, endsAt: control.status.ends_at, description: control.status.description,
        category: control.status.category, audience: control.status.audience, audienceId: control.status.audience_id } : null}
      editorVisible={control.editorVisible} saving={control.saving} error={control.error}
      onCreate={control.open} onEdit={control.open} onCloseEditor={control.close} onSave={control.save}
      onClear={control.clear} onConvert={control.convert} />
    {!!control.error && !control.editorVisible && !avatarControl ? <Text accessibilityRole="alert" style={{ color: colors.danger, ...tokens.type.caption }}>{control.error}</Text> : null}
  </View>;
}
