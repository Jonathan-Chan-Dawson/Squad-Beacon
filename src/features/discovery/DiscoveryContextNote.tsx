import { Text, View } from "react-native";
import { Clock3, Compass, Sparkles, UsersRound } from "lucide-react-native";
import { useDesignTheme } from "@/src/shared/design-system";

export function DiscoveryContextNote({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  const { colors, tokens } = useDesignTheme();
  const Icon =
    label === "Matches your interest"
      ? Sparkles
      : label === "Friend hosting"
        ? UsersRound
        : label === "Starts soon"
          ? Clock3
          : Compass;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
      <Icon size={14} color={colors.accent} accessible={false} />
      <Text
        style={{
          flexShrink: 1,
          color: colors.textSecondary,
          ...tokens.type.caption,
        }}
      >
        {label}
        {detail ? ` · ${detail}` : ""}
      </Text>
    </View>
  );
}
