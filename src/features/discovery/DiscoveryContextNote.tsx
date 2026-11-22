import { Text, View } from "react-native";
import { Clock3, Compass, Sparkles, UserPlus, UsersRound } from "lucide-react-native";
import { useDesignTheme } from "@/src/shared/design-system";

export function DiscoveryContextNote({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  const { colors, tokens } = useDesignTheme();
  const description = detail ? `${label} · ${detail}` : label;
  const Icon =
    label === "Matches your interest"
      ? Sparkles
      : label === "Friend hosting"
        ? UsersRound
        : label === "Starts soon"
          ? Clock3
          : label === "Spots available"
            ? UserPlus
            : Compass;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
      <Icon size={14} color={colors.accent} accessible={false} />
      <Text
        numberOfLines={1}
        accessibilityLabel={description}
        style={{
          flexShrink: 1,
          color: colors.textSecondary,
          ...tokens.type.caption,
        }}
      >
        {description}
      </Text>
    </View>
  );
}
