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
  LayoutGrid,
  MoreHorizontal,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme } from "@/src/shared/design-system";
import { ActionRow, ContextMenu, MenuGroup } from "@/src/shared/ContextMenu";
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
export function BeaconCardEngagement({
  activityId,
  mode = "both",
  outlined = false,
  labeled = false,
}: {
  activityId: string;
  mode?: "both" | "reactions" | "comments";
  outlined?: boolean;
  labeled?: boolean;
  separateChat?: boolean;
}) {
  const { data, userId, act } = useBeacon();
  const { colors } = useDesignTheme();
  const preview = beaconEngagement(data, userId, activityId);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const overflowAnchor = useRef<View>(null);
  const identity = `${userId}:${activityId}`;
  const [overflow, setOverflow] = useState<string | null>(null);
  const [availableWidth, setAvailableWidth] = useState(260);
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
  if (!preview) return null;
  const groups = preview.allReactionGroups;
  // Reserve room for React, Comments and overflow before choosing chip density.
  const reserved =
    (preview.canReact ? (labeled && !groups.length ? 68 : 44) : 0) +
    (mode !== "reactions" && preview.canReadComments
      ? labeled && !preview.commentCount
        ? 96
        : 56
      : 0);
  const chipWidth = Math.max(
    50,
    ...groups.map((group) => 34 + String(group.count).length * 8),
  );
  const slots = Math.max(
    0,
    Math.min(
      3,
      Math.floor(
        (availableWidth - reserved - (groups.length > 3 ? 44 : 0)) / chipWidth,
      ),
    ),
  );
  const visibleCount =
    groups.length > slots
      ? Math.max(
          0,
          Math.min(
            slots,
            Math.floor((availableWidth - reserved - 44) / chipWidth),
          ),
        )
      : slots;
  const visible = groups.slice(0, visibleCount);
  const hidden = groups.slice(visibleCount);
  const face = {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <View
      testID={`beacon-engagement-${activityId}`}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 4,
      }}
    >
      {mode !== "comments" ? (
        <>
          {visible.map((group) => (
            <Pressable
              key={group.emoji}
              aria-pressed={preview.selectedEmoji === group.emoji}
              accessibilityRole="button"
              accessibilityLabel={`${group.emoji}, ${group.count} reactions on ${preview.activity.title}`}
              accessibilityState={{
                selected: preview.selectedEmoji === group.emoji,
                disabled: busy || !preview.canReact,
              }}
              disabled={busy || !preview.canReact}
              onPress={() => void choose(group.emoji)}
              style={{ ...face, paddingHorizontal: 2 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: 16,
                  paddingHorizontal: 7,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor:
                    preview.selectedEmoji === group.emoji
                      ? colors.accent
                      : colors.border,
                  backgroundColor:
                    preview.selectedEmoji === group.emoji
                      ? colors.surfaceRaised
                      : "transparent",
                }}
              >
                <Text style={{ fontSize: 14 }}>{group.emoji}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {group.count}
                </Text>
              </View>
            </Pressable>
          ))}
          {hidden.length ? (
            <View ref={overflowAnchor} collapsable={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show ${hidden.length} more reaction types`}
                onPress={() => setOverflow(identity)}
                style={face}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  +{hidden.length}
                </Text>
              </Pressable>
            </View>
          ) : null}
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
                    ...face,
                    flexDirection: "row",
                    gap: 4,
                    paddingHorizontal: labeled && !groups.length ? 4 : 0,
                  }}
                >
                  <SmilePlus
                    size={18}
                    color={
                      preview.selectedEmoji
                        ? colors.accent
                        : colors.textSecondary
                    }
                  />
                  {labeled && !groups.length ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      React
                    </Text>
                  ) : null}
                </Pressable>
              }
            />
          ) : null}
        </>
      ) : null}
      {preview.canReadComments && mode !== "reactions" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments on ${preview.activity.title}${preview.commentCount ? `, ${preview.commentCount} comments` : ""}`}
          onPress={() => {
            if (
              latest.current.userId === userId &&
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
            ...face,
            flexDirection: "row",
            gap: 4,
            marginLeft: labeled ? 8 : "auto",
          }}
        >
          <View
            testID={`beacon-comment-face-${activityId}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: outlined ? 6 : 0,
            }}
          >
            <MessageCircle size={18} color={colors.textSecondary} />
            {labeled && !preview.commentCount ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Comments
              </Text>
            ) : null}
            {preview.commentCount > 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {preview.commentCount}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, flexBasis: "100%", fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
      <ContextMenu
        title="Beacon reactions"
        visible={overflow === identity && mode !== "comments"}
        onClose={() => setOverflow(null)}
        anchorRef={overflowAnchor}
        mode="dropdown"
        anchoredOnly
      >
        {groups.map((group) => (
          <ActionRow
            key={group.emoji}
            label={`${group.emoji} · ${group.count}`}
            selected={preview.selectedEmoji === group.emoji}
            disabled={busy || !preview.canReact}
            onPress={() => {
              void choose(group.emoji).then((success) => {
                if (success) setOverflow(null);
              });
            }}
          />
        ))}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}
      </ContextMenu>
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
  const latest = useRef({ data, userId });
  useEffect(() => {
    latest.current = { data, userId };
  }, [data, userId]);
  const preview = beaconEngagement(data, userId, activityId);
  if (!preview?.tools.length) return null;
  const groups = [
    { title: "Collaboration", tools: ["checklist", "journal"] as const },
    {
      title: "Media & Activities",
      tools: ["experiences", "focus", "music", "scoreboard"] as const,
    },
  ];
  return (
    <>
      {groups.map((group) => {
        const available = group.tools.filter((tool) =>
          preview.tools.includes(tool),
        );
        return available.length ? (
          <MenuGroup key={group.title} title={group.title}>
            {available.map((tool) => {
              const Icon = toolIcons[tool];
              return (
                <ActionRow
                  key={tool}
                  label={cardToolLabels[tool]!}
                  icon={<Icon size={18} color={colors.textSecondary} />}
                  onPress={() =>
                    afterMenu(() => {
                      const current = beaconEngagement(
                        latest.current.data,
                        latest.current.userId,
                        activityId,
                      );
                      if (
                        latest.current.userId === userId &&
                        current?.tools.includes(tool)
                      )
                        router.push({
                          pathname: "/activity/[id]",
                          params: { id: activityId, tab: "tools", tool },
                        });
                    })
                  }
                />
              );
            })}
          </MenuGroup>
        ) : null;
      })}
    </>
  );
}

export type BeaconToolsMenuOwner = {
  anchorRef: React.RefObject<View | null>;
  onOpen: () => void;
};

export function BeaconToolsButton({
  activityId,
  menuOwner,
}: {
  activityId: string;
  menuOwner?: BeaconToolsMenuOwner;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  const preview = beaconEngagement(data, userId, activityId);
  const anchor = useRef<View>(null);
  const identity = `${userId}:${activityId}`;
  const [open, setOpen] = useState<string | null>(null);
  const continuation = useRef<(() => void) | null>(null);
  useEffect(() => {
    continuation.current = null;
  }, [userId, activityId]);
  const count = preview?.tools.length ?? 0;
  if (!count && !menuOwner) return null;
  return (
    <>
      <View ref={menuOwner?.anchorRef ?? anchor} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            count ? `Beacon tools, ${count} available` : "More Beacon actions"
          }
          accessibilityState={{
            expanded: menuOwner ? undefined : open === identity,
          }}
          onPress={menuOwner?.onOpen ?? (() => setOpen(identity))}
          style={{
            width: count ? 76 : 44,
            minWidth: 44,
            minHeight: 44,
            flexDirection: "row",
            gap: 4,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            paddingHorizontal: 6,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          {count ? (
            <LayoutGrid size={16} color={colors.accent} />
          ) : (
            <MoreHorizontal size={20} color={colors.textSecondary} />
          )}
          {count ? (
            <Text style={{ color: colors.textPrimary, fontSize: 11 }}>
              Tools
            </Text>
          ) : null}
          {count ? (
            <Text
              accessible={false}
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                lineHeight: 16,
                marginLeft: 4,
              }}
            >
              {count}
            </Text>
          ) : null}
        </Pressable>
      </View>
      {!menuOwner ? (
        <ContextMenu
          title="Beacon tools"
          visible={open === identity && !!count}
          anchorRef={anchor}
          mode="dropdown"
          anchoredOnly
          onClose={() => setOpen(null)}
          onDismiss={() => {
            const callback = continuation.current;
            continuation.current = null;
            callback?.();
          }}
        >
          <BeaconToolMenuRows
            activityId={activityId}
            afterMenu={(callback) => {
              continuation.current = callback;
              setOpen(null);
            }}
          />
        </ContextMenu>
      ) : null}
    </>
  );
}
