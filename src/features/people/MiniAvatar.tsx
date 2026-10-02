import React from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { miniAvatarSvg } from "@/src/features/profile/avatarArt";
export function MiniAvatar({
  seed,
  size = 48,
  name = "Mini avatar",
}: {
  seed: number;
  size?: number;
  name?: string;
}) {
  return (
    <View
      testID="user-avatar"
      accessibilityLabel={name}
      style={{ width: size, height: size }}
    >
      <SvgXml xml={miniAvatarSvg(seed)} width={size} height={size} />
    </View>
  );
}
