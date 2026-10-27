import React from "react";
import { Platform, Pressable, Text, View, ScrollView } from "react-native";
import { Check, ChevronRight, Plus } from "lucide-react-native";
import { useDesignTheme } from "@/src/theme";

/** One row language; browsing never performs selection. */
export function SocialChoiceRow({
  label,
  detail,
  icon,
  selected = false,
  disabled = false,
  browse = false,
  expanded,
  multiple = true,
  accessibilityLabel = label,
  onPress,
}: {
  label: string;
  detail?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  browse?: boolean;
  expanded?: boolean;
  multiple?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { colors, tokens } = useDesignTheme();
  const styles = {
    body: { ...tokens.type.body, color: colors.textPrimary },
    muted: { ...tokens.type.caption, color: colors.textSecondary },
  };
  return (
    <Pressable
      accessibilityRole={browse ? "button" : multiple ? "checkbox" : "radio"}
      accessibilityLabel={accessibilityLabel}
      aria-checked={browse ? undefined : selected}
      aria-disabled={disabled}
      aria-expanded={browse ? expanded : undefined}
      accessibilityState={{
        disabled,
        ...(browse && expanded !== undefined ? { expanded } : {}),
        ...(!browse ? { checked: selected } : {}),
      }}
      disabled={disabled}
      onPress={onPress}
      {...(Platform.OS === "web" && !browse
        ? {
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
              if (!disabled && (event.key === " " || event.key === "Enter")) {
                event.preventDefault();
                onPress();
              }
            },
          }
        : {})}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        borderRadius: 8,
        opacity: disabled ? 0.5 : 1,
        backgroundColor:
          selected || pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.body}>{label}</Text>
        {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      </View>
      {browse ? (
        <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
          <ChevronRight size={18} color={colors.textSecondary} />
        </View>
      ) : (
        <View
          accessible={false}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: selected ? colors.accent : colors.textSecondary,
            backgroundColor: selected ? colors.accent : "transparent",
          }}
        >
          {selected ? (
            <Check size={15} color={colors.onAccent} />
          ) : (
            <Plus size={15} color={colors.textSecondary} />
          )}
        </View>
      )}
    </Pressable>
  );
}

export function SocialCategoryRail({
  items,
  value,
  onChange,
  disabled = false,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useDesignTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 4 }}
    >
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: value === item.value, disabled }}
          disabled={disabled}
          onPress={() => onChange(item.value)}
          style={{
            minHeight: 44,
            minWidth: 44,
            justifyContent: "center",
            paddingHorizontal: 10,
            borderRadius: 8,
            borderBottomWidth: 2,
            borderBottomColor:
              value === item.value ? colors.accent : "transparent",
            backgroundColor:
              value === item.value ? colors.surfaceRaised : "transparent",
          }}
        >
          <Text
            style={{
              color:
                value === item.value ? colors.accent : colors.textSecondary,
              fontSize: 14,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
