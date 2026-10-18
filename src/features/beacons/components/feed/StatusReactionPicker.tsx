import React, { useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import { SmilePlus } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useTheme } from "@/src/shared/ui";
import { canReactToSoloActivity } from "@/src/features/maps/soloActivity";
import { ReactionPicker } from "./ReactionPicker";

export function StatusReactionPicker({
  activityId,
  compact = false,
  labeled = false,
}: {
  activityId: string;
  compact?: boolean;
  labeled?: boolean;
}) {
  const { data, userId, act } = useBeacon();
  const { colors } = useTheme();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const activity = data.activities.find((item) => item.id === activityId);
  const allowed =
    !!activity &&
    data.viewer_id === userId &&
    canReactToSoloActivity(data, activity, userId, now);
  const selected = data.reactions.find(
    (item) => item.activity_id === activityId && item.user_id === userId,
  )?.emoji;
  const count = data.reactions.filter(
    (item) => item.activity_id === activityId,
  ).length;

  const choose = async (emoji: string): Promise<boolean> => {
    if (busyRef.current || !allowed) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await act("react_status", {
        id: activityId,
        emoji,
        remove: selected === emoji,
      });
      if (result.event !== "react_status" || result.id !== activityId)
        throw new Error(
          "This server could not verify your status reaction. Try again after refreshing.",
        );
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not react. Try again.",
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (!allowed) return null;
  return (
    <ReactionPicker
      selectedEmoji={selected}
      disabled={busy || !allowed}
      error={error}
      onSelect={choose}
      onOpen={() => setError("")}
      trigger={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose status reaction"
          accessibilityState={{
            selected: !!selected,
            disabled: busy || !allowed,
          }}
          style={{
            minHeight: 44,
            minWidth: 44,
            flexDirection: "row",
            gap: labeled ? 7 : 3,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: compact ? 6 : 10,
            borderRadius: 22,
            backgroundColor:
              compact && !labeled ? colors.green + "12" : "transparent",
          }}
        >
          {(compact || labeled) && !selected ? (
            <SmilePlus
              size={labeled ? 18 : 20}
              color={labeled ? colors.muted : colors.green}
            />
          ) : null}
          {(selected || !labeled) && (
            <Text
              style={{
                color: labeled ? colors.muted : colors.ink,
                fontSize: selected ? 19 : labeled ? 14 : undefined,
              }}
            >
              {selected || (compact || labeled ? "" : "🙌")}
              {!labeled && (count || (compact ? "" : " React"))}
            </Text>
          )}
          {labeled && (
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              React{count ? ` · ${count}` : ""}
            </Text>
          )}
        </Pressable>
      }
    />
  );
}
