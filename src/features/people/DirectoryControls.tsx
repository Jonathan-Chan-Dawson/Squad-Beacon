import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  LayoutGrid,
  LockKeyhole,
  Search,
  UserRound,
  UserPlus,
  UsersRound,
} from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";

export type DirectoryFilter = "All" | "Squads" | "Friends" | "Private lists";

const options = [
  { label: "All", Icon: LayoutGrid },
  { label: "Squads", Icon: UsersRound },
  { label: "Friends", Icon: UserRound },
  { label: "Private lists", Icon: LockKeyhole },
] as const;

export function DirectoryControls({
  value,
  onChange,
}: {
  value: DirectoryFilter;
  onChange: (value: DirectoryFilter) => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityLabel="Directory sections"
      style={{
        flexDirection: "row",
        gap: 3,
        padding: 4,
        borderRadius: 20,
        backgroundColor: colors.line + "88",
      }}
    >
      {options.map(({ label, Icon }) => {
        const selected = label === value;
        return (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(label)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 54,
              paddingHorizontal: 3,
              paddingVertical: 5,
              borderRadius: 16,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              backgroundColor: selected ? colors.ink : "transparent",
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <Icon size={14} color={selected ? colors.white : colors.muted} />
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 12,
                fontWeight: "700",
                color: selected ? colors.white : colors.muted,
              }}
            >
              {selected ? "\u2713 " : ""}
              {label === "Private lists" ? "Lists" : label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DirectoryActions({
  onFindFriends,
  onInvitePeople,
}: {
  onFindFriends: () => void;
  onInvitePeople: () => void;
}) {
  const { colors, styles } = useTheme();
  const actions = [
    { label: "Find friends", Icon: Search, onPress: onFindFriends },
    { label: "Invite people", Icon: UserPlus, onPress: onInvitePeople },
  ];

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {actions.map(({ label, Icon, onPress }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            paddingHorizontal: 10,
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.line,
            opacity: pressed ? 0.76 : 1,
          })}
        >
          <Icon size={16} color={colors.green} />
          <Text style={[styles.body, { fontSize: 13, fontWeight: "700" }]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
