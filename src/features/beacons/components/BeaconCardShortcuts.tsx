import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Images, MessagesSquare } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme } from "@/src/shared/design-system";
import { beaconCardShortcuts } from "../beaconCardShortcuts";
import {
  BeaconCardEngagement,
  BeaconToolsButton,
  type BeaconToolsMenuOwner,
} from "./BeaconCardEngagement";
import { HomeAction } from "./HomeAction";

export function BeaconCardShortcuts({
  activityId,
  onChat,
  section = "all",
  menuOwner,
  labeledSocial = true,
  mapPreview = false,
}: {
  activityId: string;
  onChat?: () => void;
  section?: "all" | "social" | "actions";
  menuOwner?: BeaconToolsMenuOwner;
  labeledSocial?: boolean;
  mapPreview?: boolean;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  const latest = useRef({ data, userId });
  useEffect(() => {
    latest.current = { data, userId };
  }, [data, userId]);
  const current = beaconCardShortcuts(data, userId, activityId);
  if (!current) return null;
  const chat = !mapPreview && onChat ? current.chat : null;
  const memories =
    !mapPreview && !chat && current.engagement?.tools.includes("experiences");
  if (
    section === "social" &&
    !current.engagement?.canReact &&
    !current.engagement?.canReadComments &&
    !current.engagement?.allReactionGroups.length
  )
    return null;
  if (
    section === "actions" &&
    !chat &&
    !memories &&
    !current.engagement?.tools.length &&
    !menuOwner
  )
    return null;
  if (
    !chat &&
    !memories &&
    !current.engagement?.canReact &&
    !current.engagement?.canReadComments &&
    !current.engagement?.tools.length &&
    !menuOwner
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
        <BeaconCardEngagement
          activityId={activityId}
          separateChat
          labeled={labeledSocial}
        />
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
          {memories ? (
            <HomeAction
              outlined
              prominent
              label={`Open ${current.activity.title} memories`}
              icon={<Images size={18} color={colors.accent} />}
              onPress={() => {
                if (
                  latest.current.userId === userId &&
                  beaconCardShortcuts(
                    latest.current.data,
                    latest.current.userId,
                    activityId,
                  )?.engagement?.tools.includes("experiences")
                )
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: activityId, tab: "memories" },
                  });
              }}
            />
          ) : null}
          <BeaconToolsButton activityId={activityId} menuOwner={menuOwner} />
        </View>
      ) : null}
    </View>
  );
}
