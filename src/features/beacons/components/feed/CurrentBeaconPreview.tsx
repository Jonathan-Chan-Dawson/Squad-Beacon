import React from "react";
import type { Activity } from "@/src/shared/types";
import { DiscoveryBeaconCard } from "@/src/features/discovery/DiscoveryBeaconCard";

export type CurrentBeaconRole = "hosting" | "cohosting" | "going";

export function currentBeaconRoleLabel(role: CurrentBeaconRole) {
  return role === "cohosting"
    ? "Co-hosting"
    : role === "hosting"
      ? "Hosting"
      : "Going";
}

function startedLabel(activity: Activity, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(activity.starts_at)) / 60_000),
  );
  if (minutes < 1) return "Started just now";
  if (minutes < 60) return `Started ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining
    ? `Started ${hours} hr ${remaining} min ago`
    : `Started ${hours} hr ago`;
}

function untilLabel(activity: Activity) {
  return `Until ${new Date(activity.ends_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function CurrentBeaconPreview({
  activity,
  role,
  now,
  onPress,
  featured = false,
  compact = false,
}: {
  activity: Activity;
  role: CurrentBeaconRole;
  now: number;
  onPress?: () => void;
  featured?: boolean;
  compact?: boolean;
}) {
  return (
    <DiscoveryBeaconCard
      activityId={activity.id}
      testID="current-beacon-preview"
      density={compact ? "mini" : "compact"}
      title={activity.title}
      category={activity.category}
      mapIcon={activity.map_icon}
      decorationEmoji={activity.decoration_emoji}
      decorationAccent={activity.decoration_accent}
      isLive
      whenLabel={`${startedLabel(activity, now)} · ${untilLabel(activity)}`}
      statusLabel={currentBeaconRoleLabel(role)}
      detailsLabel={`${featured ? "Featured, " : ""}Happening now: ${activity.title}. ${startedLabel(activity, now)}. ${currentBeaconRoleLabel(role)}.`}
      onDetails={onPress}
    />
  );
}
