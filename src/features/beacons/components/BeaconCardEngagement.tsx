import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Images,
  ListChecks,
  MessageCircle,
  Music2,
  NotebookPen,
  SmilePlus,
  Timer,
  Trophy,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme } from "@/src/shared/design-system";
import { ActionRow, MenuGroup } from "@/src/shared/ContextMenu";
import { ReactionPicker } from "./feed/ReactionPicker";
import { beaconEngagement, cardToolLabels } from "../beaconEngagement";
const toolIcons = {
  checklist: ListChecks,
  journal: NotebookPen,
  focus: Timer,
  experiences: Images,
  scoreboard: Trophy,
  music: Music2,
};
export function BeaconCardEngagement({ activityId }: { activityId: string }) {
  const { data, userId, act } = useBeacon();
  const { colors } = useDesignTheme();
  const preview = beaconEngagement(data, userId, activityId);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const latest = useRef({ data, userId });
  useEffect(() => {
    latest.current = { data, userId };
  }, [data, userId]);
  const choose = async (emoji: string) => {
    const current = latest.current;
    const permission = beaconEngagement(
      current.data,
      current.userId,
      activityId,
    );
    if (lock.current || current.userId !== userId || !permission?.canReact)
      return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await act("react", {
        id: activityId,
        emoji,
        remove: permission.selectedEmoji === emoji,
      });
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not react. Try again.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!preview || (!preview.canReact && !preview.canReadComments)) return null;
  return (
    <View
      testID={`beacon-engagement-${activityId}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 4,
      }}
    >
      {preview.canReact ? (
        <ReactionPicker
          selectedEmoji={preview.selectedEmoji}
          disabled={busy}
          error={error}
          onOpen={() => setError("")}
          onSelect={choose}
          trigger={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`React to ${preview.activity.title}${preview.selectedEmoji ? `, your reaction ${preview.selectedEmoji}` : ""}${preview.reactionCount ? `, ${preview.reactionCount} reactions` : ""}`}
              accessibilityState={{
                disabled: busy,
                selected: !!preview.selectedEmoji,
              }}
              style={{
                minWidth: 44,
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingHorizontal: 4,
              }}
            >
              {preview.selectedEmoji ? (
                <Text style={{ fontSize: 16 }}>{preview.selectedEmoji}</Text>
              ) : (
                <SmilePlus size={17} color={colors.textSecondary} />
              )}
              {preview.reactionCount > 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {preview.reactionCount}
                </Text>
              ) : null}
            </Pressable>
          }
        />
      ) : null}
      {preview.canReadComments ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments on ${preview.activity.title}${preview.commentCount ? `, ${preview.commentCount} comments` : ""}`}
          onPress={() => {
            if (
              beaconEngagement(
                latest.current.data,
                latest.current.userId,
                activityId,
              )?.canReadComments
            )
              router.push({
                pathname: "/activity/[id]",
                params: { id: activityId, tab: "comments" },
              });
          }}
          style={{
            minWidth: 44,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            paddingHorizontal: 4,
          }}
        >
          <MessageCircle size={17} color={colors.textSecondary} />
          {preview.commentCount > 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {preview.commentCount}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
export function BeaconToolMenuRows({
  activityId,
  afterMenu,
}: {
  activityId: string;
  afterMenu: (callback: () => void) => void;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  const preview = beaconEngagement(data, userId, activityId);
  if (!preview?.tools.length) return null;
  return (
    <MenuGroup title="Tools">
      {preview.tools.map((tool) => {
        const Icon = toolIcons[tool as keyof typeof toolIcons];
        return (
          <ActionRow
            key={tool}
            label={cardToolLabels[tool]!}
            icon={<Icon size={18} color={colors.textSecondary} />}
            onPress={() =>
              afterMenu(() =>
                router.push({
                  pathname: "/activity/[id]",
                  params: { id: activityId, tab: "tools", tool },
                }),
              )
            }
          />
        );
      })}
    </MenuGroup>
  );
}
