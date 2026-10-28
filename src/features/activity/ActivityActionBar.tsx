import React from "react";
import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  PrimaryButton,
  SecondaryButton,
  useDesignTheme,
} from "@/src/shared/design-system";

/** Standard app buttons; wrap naturally instead of compressing their size. */
export function ActivityActionBar({
  items,
}: {
  items: {
    label: string;
    accessibilityLabel?: string;
    icon: LucideIcon;
    primary?: boolean;
    selected?: boolean;
    onPress: () => void;
  }[];
}) {
  const { colors, tokens } = useDesignTheme();
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs }}
    >
      {items.map(
        ({
          label,
          accessibilityLabel,
          icon: Icon,
          primary,
          selected,
          onPress,
        }) => {
          const Component = primary ? PrimaryButton : SecondaryButton;
          return (
            <Component
              key={label}
              title={label}
              accessibilityLabel={accessibilityLabel ?? label}
              accessibilityState={{ selected }}
              aria-pressed={selected}
              icon={
                <Icon
                  size={18}
                  color={primary ? colors.onAccent : colors.accent}
                />
              }
              onPress={onPress}
              style={selected ? { borderColor: colors.accent } : undefined}
            />
          );
        },
      )}
    </View>
  );
}
