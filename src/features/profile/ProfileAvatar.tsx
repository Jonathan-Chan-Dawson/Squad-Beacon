import { AvailabilityArc, AvatarStatusBadge } from "./AvatarStatusBadge";
import { activeAvailability } from "@/src/features/beacons/availability";
import { useAvailabilityNow } from "@/src/features/beacons/availabilityClock";
import type { FriendAvailabilityState } from "@/src/shared/domain";
import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import type { Profile } from "@/src/shared/types";
import { MiniAvatar } from "@/src/features/people/MiniAvatar";
import { avatarSeed } from "@/src/features/profile/avatarArt";
import { usePreferences } from "@/src/shared/preferences";
import { supabase } from "@/src/shared/supabase";
import { useBeacon } from "@/src/shared/store";
import { canViewProfile } from "@/src/features/profile/privacy";
import { getRewardLook } from "@/src/features/beacons/rewardLooks";
export function ProfileAvatar({
  profile,
  size = 42,
  status,
}: {
  profile: Profile | undefined;
  size?: number;
  status?: FriendAvailabilityState;
}) {
  const { showAvatars } = usePreferences();
  const { data, userId } = useBeacon();
  const presence = data.viewer_id === userId ? data.presence?.find((row) => row.owner_id === profile?.id) : undefined;
  const now = useAvailabilityNow(Date.parse(presence?.availability_until ?? ""), !!status && !!presence);
  const availability = status ? activeAvailability(presence, now) : null;
  const badgeStatus = presence && status ? availability?.status === "busy" ? "unavailable" : availability ? "available" : "unknown" : status;
  const [image, setImage] = useState<{ key: string; uri: string } | null>(null);
  const canReadPhoto = !!profile && canViewProfile(data, profile, userId);
  const key =
    profile?.id +
    ":" +
    profile?.avatar_updated_at +
    ":" +
    userId +
    ":" +
    String(canReadPhoto);
  useEffect(() => {
    if (
      !showAvatars ||
      !canReadPhoto ||
      !profile?.avatar_updated_at ||
      !supabase
    )
      return;
    let active = true;
    supabase.storage
      .from("avatars")
      .download(profile.id + "/avatar.jpg")
      .then(({ data, error }) => {
        if (!data || error) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (active && typeof reader.result === "string")
            setImage({ key, uri: reader.result });
        };
        reader.readAsDataURL(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profile?.id, profile?.avatar_updated_at, key, showAvatars, canReadPhoto]);
  if (!showAvatars) return null;
  const avatar =
    canReadPhoto &&
    profile?.avatar_style !== "illustrated" &&
    image?.key === key ? (
      <Image
        testID="user-avatar"
        accessibilityLabel={profile?.name ?? "Profile photo"}
        source={{ uri: image.uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    ) : (
      <MiniAvatar
        seed={
          canReadPhoto
            ? (profile?.avatar_seed ?? avatarSeed(profile?.id ?? "friend"))
            : avatarSeed(profile?.id ?? "friend")
        }
        name={profile?.name ?? "Friend"}
        size={size}
      />
    );
  const ring = profile && canReadPhoto ? getRewardLook(data.equipped_looks?.[profile.id]?.ring) : undefined;
  return ring || (badgeStatus && badgeStatus !== "unknown") ? (
    <View style={{ width: size, height: size }}>
      {avatar}
      {ring && <View testID="equipped-avatar-ring" pointerEvents="none" style={{
        position: "absolute", inset: -2, borderWidth: 2, borderRadius: size, borderColor: ring.color,
      }} />}
      {size >= 32 && <AvailabilityArc detail={availability} size={size} />}
      {badgeStatus && badgeStatus !== "unknown" && <AvatarStatusBadge state={badgeStatus} size={size >= 64 ? 16 : 12} />}
    </View>
  ) : (
    avatar
  );
}
