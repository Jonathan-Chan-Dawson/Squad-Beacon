import React, { useEffect, useRef } from "react";
import { View, useWindowDimensions } from "react-native";
import { MessagesSquare } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme } from "@/src/shared/design-system";
import { beaconCardShortcuts } from "../beaconCardShortcuts";
import {
  BeaconCardEngagement,
  BeaconToolsButton,
} from "./BeaconCardEngagement";
import { HomeAction } from "./HomeAction";

export function BeaconCardShortcuts({
  activityId,
  onChat,
  section = "all",
  labeledSocial = true,
}: {
  activityId: string;
  onChat?: () => void;
  section?: "all" | "social" | "actions";
  labeledSocial?: boolean;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  const { width, fontScale } = useWindowDimensions();
  const latest = useRef({ data, userId });
  useEffect(() => {
    latest.current = { data, userId };
  }, [data, userId]);
  const current = beaconCardShortcuts(data, userId, activityId);
  if (!current) return null;
  const chat = onChat ? current.chat : null;
  if (
    section === "social" &&
    !current.engagement?.canReact &&
    !current.engagement?.canReadComments &&
    !current.engagement?.allReactionGroups.length
  )
    return null;
  if (section === "actions" && !chat && !current.engagement?.tools.length)
    return null;
  if (
    !chat &&
    !current.engagement?.canReact &&
    !current.engagement?.canReadComments &&
    !current.engagement?.tools.length
  )
    return null;
  return (
    <View
      testID={`beacon-${section === "social" ? "social" : "shortcuts"}-${activityId}`}
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      {section !== "actions" ? (
        <BeaconCardEngagement activityId={activityId} labeled={labeledSocial} />
      ) : null}
      {section !== "social" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            marginLeft: "auto",
            gap: 4,
          }}
        >
          {chat ? (
            <HomeAction
              outlined
              prominent
              title={
                chat === "beacon" && width >= 360 && fontScale <= 1.25
                  ? "Chat"
                  : undefined
              }
              label={
                chat === "beacon"
                  ? `Open ${current.activity.title} chat`
                  : `Message host of ${current.activity.title}`
              }
              icon={<MessagesSquare size={18} color={colors.accent} />}
              onPress={() => {
                const next = beaconCardShortcuts(
                  latest.current.data,
                  latest.current.userId,
                  activityId,
                );
                if (
                  next?.chat === chat &&
                  next.activity.owner_id === current.activity.owner_id &&
                  latest.current.userId === userId
                )
                  onChat?.();
              }}
            />
          ) : null}
          <BeaconToolsButton activityId={activityId} />
        </View>
      ) : null}
    </View>
  );
}
