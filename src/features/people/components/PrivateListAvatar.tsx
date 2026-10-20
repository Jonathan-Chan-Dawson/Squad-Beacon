import React from "react";
import { Text, View } from "react-native";
import { UsersRound } from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";

const accents = [
  { light: ["#E7EFFF", "#354E85"], dark: ["#293552", "#BCD0FF"] },
  { light: ["#F8E8EF", "#8B3C5C"], dark: ["#492B3B", "#FFC0D6"] },
  { light: ["#E2F3EE", "#27634F"], dark: ["#243F36", "#A5E3C9"] },
  { light: ["#F8EEDC", "#76531C"], dark: ["#423723", "#F5D299"] },
] as const;

export function PrivateListAvatar({
  id,
  name,
  size = 28,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  const { colors, resolvedAppearance } = useTheme();
  const hash = Array.from(id).reduce(
    (value, char) => (value * 31 + char.codePointAt(0)!) >>> 0,
    0,
  );
  const [backgroundColor, color] =
    accents[hash % accents.length][resolvedAppearance];
  const close = name.trim().toLowerCase() === "close friends";
  return (
    <View
      testID={`private-list-icon-${id}`}
      accessibilityRole="image"
      accessibilityLabel={close ? "Close Friends list" : `${name} private list`}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: close ? colors.lime : backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {close ? (
        <UsersRound size={size * 0.6} color={colors.green} />
      ) : (
        <Text style={{ color, fontSize: size * 0.5, fontWeight: "600" }}>
          {Array.from(name.trim())[0]?.toLocaleUpperCase() || "L"}
        </Text>
      )}
    </View>
  );
}
