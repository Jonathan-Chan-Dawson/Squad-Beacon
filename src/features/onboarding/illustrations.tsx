import React from "react";
import { View } from "react-native";
import {
  Radio,
  CalendarDays,
  UsersRound,
  Compass,
  Images,
  CircleCheck,
  WifiOff,
  Bookmark,
  Route,
} from "lucide-react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useDesignTheme } from "@/src/theme";

export const illustrationRegistry = {
  welcome: Radio,
  emptyUpcoming: CalendarDays,
  noFriends: UsersRound,
  noSquads: UsersRound,
  discovery: Compass,
  memories: Images,
  complete: CircleCheck,
  disconnected: WifiOff,
  templates: Bookmark,
  plans: Route,
};
export type IllustrationKey = keyof typeof illustrationRegistry;
export function BeaconIllustration({
  name,
  size = 120,
}: {
  name: IllustrationKey;
  size?: number;
}) {
  const { colors } = useDesignTheme();
  const Icon = illustrationRegistry[name];
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        style={{ position: "absolute" }}
      >
        <Circle cx="60" cy="60" r="40" fill={colors.accent} opacity={0.07} />
        <Path
          d="M19 75 C4 35 38 9 77 20 M101 45 C117 85 82 110 44 100"
          stroke={colors.accent}
          strokeWidth="1.5"
          strokeDasharray="3 6"
          fill="none"
          opacity={0.5}
        />
        <Circle cx="80" cy="21" r="4" fill={colors.accent} />
        <Circle cx="24" cy="85" r="3" fill={colors.accent} opacity={0.6} />
      </Svg>
      <Icon
        size={size <= 48 ? 24 : size * 0.36}
        strokeWidth={1.6}
        color={colors.accent}
      />
    </View>
  );
}
