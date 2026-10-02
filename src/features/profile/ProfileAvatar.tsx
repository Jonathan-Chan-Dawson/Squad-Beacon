import React, { useEffect, useState } from "react";
import { Image } from "react-native";
import type { Profile } from "@/src/shared/types";
import { MiniAvatar } from "@/src/features/people/MiniAvatar";
import { avatarSeed } from "@/src/features/profile/avatarArt";
import { usePreferences } from "@/src/shared/preferences";
import { supabase } from "@/src/shared/supabase";
export function ProfileAvatar({
  profile,
  size = 42,
}: {
  profile: Profile | undefined;
  size?: number;
}) {
  const { showAvatars } = usePreferences();
  const [image, setImage] = useState<{ key: string; uri: string } | null>(null);
  const key = profile?.id + ":" + profile?.avatar_updated_at;
  useEffect(() => {
    if (!showAvatars || !profile?.avatar_updated_at || !supabase) return;
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
  }, [profile?.id, profile?.avatar_updated_at, key, showAvatars]);
  if (!showAvatars) return null;
  return profile?.avatar_style !== "illustrated" && image?.key === key ? (
    <Image
      testID="user-avatar"
      accessibilityLabel={profile?.name ?? "Profile photo"}
      source={{ uri: image.uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <MiniAvatar
      seed={profile?.avatar_seed ?? avatarSeed(profile?.id ?? "friend")}
      name={profile?.name ?? "Friend"}
      size={size}
    />
  );
}
