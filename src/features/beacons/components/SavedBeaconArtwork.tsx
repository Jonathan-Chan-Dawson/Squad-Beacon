import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme } from "@/src/shared/design-system";
import { canReadMemory, mediaForActivity } from "../models";
import { isBeaconModuleEnabled } from "../permissions";
import { signedBeaconMediaUrl } from "../beaconMedia";
import { BeaconIcon } from "./BeaconIcon";

export function SavedBeaconArtwork({ activity }: { activity: Activity }) {
  const { data, userId } = useBeacon();
  const { tokens } = useDesignTheme();
  const memory =
    userId &&
    data.viewer_id === userId &&
    isBeaconModuleEnabled(activity, "experiences")
      ? mediaForActivity(data, activity.id).find(
          (row) =>
            row.media_type === "image" &&
            !row.object_path.startsWith("demo://") &&
            canReadMemory(data, activity, row, userId),
        )
      : undefined;
  const path = memory?.object_path;
  const key = `${userId}:${path}`;
  const [photo, setPhoto] = useState<{ key: string; uri: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (path)
      void signedBeaconMediaUrl(path)
        .then((uri) => {
          if (active && uri) setPhoto({ key, uri });
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [key, path]);
  return (
    <View
      style={{
        width: 64,
        height: 72,
        borderRadius: 12,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.categories[activity.category].tint,
      }}
    >
      {photo?.key === key ? (
        <Image
          source={{ uri: photo.uri }}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          style={{ width: 64, height: 72 }}
          onError={() => setPhoto(null)}
        />
      ) : (
        <BeaconIcon
          category={activity.category}
          emoji={activity.decoration_emoji}
          size={34}
        />
      )}
    </View>
  );
}
