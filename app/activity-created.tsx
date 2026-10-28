import type { Audience } from "@/src/shared/types";
import { useNow } from "@/src/shared/useNow";
import React, { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Dialog } from "@/src/shared/Dialogs";
import ActivityDetail from "@/src/features/beacons/screens/ActivityDetailScreen";
import PlanningDetailScreen from "@/src/features/planning/PlanningDetailScreen";
import { Pressable, Text, View } from "react-native";
import { CheckCircle2, ChevronDown } from "lucide-react-native";
import { AudiencePicker, Button, Txt, useTheme } from "@/src/shared/ui";
import { eligibleCurrentBeacons } from "@/src/features/beacons/currentStatusBeacon";
import {
  eligibleStatusAttachments,
  type StatusAttachmentType,
} from "@/src/features/beacons/statusAttachments";
import {
  liveOwnedStatuses,
  saveOwnStatus,
} from "@/src/features/beacons/components/feed/statusActions";

/** Publication is complete before entering here. Retrying never republishes the item. */
export default function ActivityCreated() {
  const { id, type, intent } = useLocalSearchParams<{
    id: string;
    type: StatusAttachmentType;
    intent?: string;
  }>();
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const { styles, semanticColors: colors } = useTheme();
  const submitting = useRef(false);
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [audienceOpen, setAudienceOpen] = useState(false);
  const presence = data.presence?.find((p) => p.owner_id === userId);
  const [audience, setAudience] = useState<Audience>(
    presence?.current_audience ?? "friends",
  );
  const [audienceId, setAudienceId] = useState<string | null>(
    presence?.current_audience_id ?? null,
  );
  const now = useNow();
  const live =
    intent !== "feature" &&
    type === "beacon" &&
    eligibleCurrentBeacons(data, userId, now).some((a) => a.id === id);
  const eligible = eligibleStatusAttachments(data, userId, now).some(
    (a) => a.id === id && a.type === type,
  );
  const status = liveOwnedStatuses(data, userId, now)[0];
  const audienceName =
    audience === "private"
      ? "Only me"
      : audience === "friends"
        ? "Friends"
        : (data.lists.find((item) => item.id === audienceId)?.name ??
          data.squads.find((item) => item.id === audienceId)?.name ??
          data.organizations.find((item) => item.id === audienceId)?.name ??
          "Selected audience");
  const open = () =>
    router.replace({
      pathname: type === "beacon" ? "/activity/[id]" : "/council/[id]",
      params: { id },
    });
  const link = async (replaceConfirmed = false) => {
    if (submitting.current || !userId) return;
    if (!live && status?.status_attachment && !replaceConfirmed) {
      setConfirm(true);
      return;
    }
    const epoch = getViewerEpoch();
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (live)
        await act("update_presence", {
          show_current_beacon: true,
          current_beacon_id: id,
          current_audience: audience,
          current_audience_id: audienceId,
        });
      else {
        const result = await saveOwnStatus(
          data,
          userId,
          {
            sourceId: status?.id,
            title: status?.title ?? "",
            description: status?.description,
            category: status?.category,
            available: status?.available === true,
            endsAt: status?.ends_at ?? new Date(now + 3600000).toISOString(),
            audience: status?.audience ?? "friends",
            audienceId: status?.audience_id ?? null,
            attachment: { type, id },
            presentation: status?.title ? "text_activity" : "activity_only",
          },
          act,
          now,
        );
        if (result.message) throw new Error(result.message);
      }
      if (epoch === getViewerEpoch()) {
        setConfirm(false);
        open();
      }
    } catch (e) {
      if (epoch === getViewerEpoch())
        setError(
          e instanceof Error
            ? e.message
            : "Created successfully, but linking failed. Try again.",
        );
    } finally {
      submitting.current = false;
      if (epoch === getViewerEpoch()) setBusy(false);
    }
  };
  return (
    <>
      {type === "beacon" ? <ActivityDetail /> : <PlanningDetailScreen />}
      <Dialog
        title={confirm ? "Replace Featured activity?" : "Created successfully"}
        visible
        busy={busy}
        onClose={() => (confirm ? setConfirm(false) : open())}
        initialFocusLabel={confirm ? "Keep Featured activity" : "Not Now"}
        footer={
          <View style={{ gap: 8 }}>
            {(live || eligible) && (
              <Button
                title={
                  busy
                    ? "Updating…"
                    : confirm
                      ? "Replace Featured Activity"
                      : live
                        ? "Use as My Current Activity"
                        : "Feature on Status"
                }
                disabled={busy}
                onPress={() => void link(confirm)}
              />
            )}
            <Button
              secondary
              title={confirm ? "Keep Featured activity" : "Not Now"}
              disabled={busy}
              onPress={() => (confirm ? setConfirm(false) : open())}
            />
          </View>
        }
      >
        {confirm ? (
          <Txt>Replace your existing Featured activity with this one?</Txt>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.accent + "18",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={21} color={colors.accent} />
            </View>
            <Text
              style={[styles.body, { flex: 1 }]}
            >{`Your ${type === "beacon" ? "Beacon" : type === "ping" ? "Ping" : "Council"} is ready.`}</Text>
          </View>
        )}
        {!confirm && live && (
          <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 12 }}>
            <Txt muted>
              You can use this live Beacon as your Current Activity. Your
              Activity Note will end and remain in history.
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose audience"
              accessibilityState={{ expanded: audienceOpen, disabled: busy }}
              disabled={busy}
              onPress={() => setAudienceOpen(!audienceOpen)}
              style={{
                minHeight: 44,
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <Text style={[styles.muted, { flexShrink: 1 }]}>
                Audience: {audienceName}
              </Text>
              <ChevronDown size={15} color={colors.textSecondary} />
            </Pressable>
            {audienceOpen && (
              <AudiencePicker
                inline
                value={audience}
                id={audienceId}
                onChange={(nextAudience, nextId) => {
                  setAudience(nextAudience);
                  setAudienceId(nextId);
                  setAudienceOpen(false);
                }}
              />
            )}
          </View>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </Dialog>
    </>
  );
}
