import React, { type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useDesignTheme } from "@/src/shared/design-system";
import { Button } from "@/src/shared/ui";
export type ActivityDetailToolDescriptor = {
  id: string;
  icon: ReactNode;
  label: string;
  status?: string | null;
  paused?: boolean;
  onPress: () => void;
};
const purpose = (id: string) =>
  id === "checklist" || id === "agenda"
    ? "Planning"
    : id === "journal" || id === "chat"
      ? "Collaboration"
      : id === "experiences"
        ? "Memories"
        : "During the activity";
export function ActivityDetailTools({
  tools,
  selected,
  onOpenMemories,
  onBrowse,
  sidebar = false,
}: {
  tools: ActivityDetailToolDescriptor[];
  selected?: string | null;
  onOpenMemories?: () => void;
  onBrowse?: () => void;
  sidebar?: boolean;
}) {
  const { colors } = useDesignTheme();
  const { width, fontScale } = useWindowDimensions();
  const current = tools.find((t) => t.id === selected);
  if (!tools.length && !onOpenMemories) return null;
  if (current && !sidebar)
    return (
      <View
        testID="beacon-tool-workspace-header"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Button
          compact
          secondary
          title="All tools"
          onPress={() => onBrowse?.()}
        />
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          {purpose(current.id)}
        </Text>
      </View>
    );
  const groups = [...new Set(tools.map((t) => purpose(t.id)))];
  const columns = sidebar
    ? 1
    : width < 360 && fontScale > 1.15
      ? 1
      : width >= 1024
        ? 3
        : 2;
  return (
    <View style={{ gap: 24 }} testID="beacon-tool-picker">
      {groups.map((group) => (
        <View key={group} style={{ gap: 10 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {group}
          </Text>
          <View
            accessibilityRole="tablist"
            accessibilityLabel={`${group} activity tools`}
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
          >
            {tools
              .filter((t) => purpose(t.id) === group)
              .map((tool) => (
                <Pressable
                  key={tool.id}
                  accessibilityRole="tab"
                  aria-selected={tool.id === selected}
                  accessibilityState={{ selected: tool.id === selected }}
                  accessibilityLabel={tool.label}
                  onPress={tool.onPress}
                  style={({ pressed }) => ({
                    flexBasis:
                      columns === 3 ? "30%" : columns === 2 ? "46%" : "100%",
                    flexGrow: 1,
                    minHeight: 92,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor:
                      tool.id === selected
                        ? colors.accent + "12"
                        : colors.surface,
                    borderWidth: 1,
                    borderColor:
                      tool.id === selected ? colors.accent : colors.border,
                    gap: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  {React.isValidElement<{ color?: string }>(tool.icon)
                    ? React.cloneElement(tool.icon, {
                        color: colors.textSecondary,
                      })
                    : tool.icon}
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {tool.label}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {tool.status || "Ready to use"}
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>
      ))}
      {onOpenMemories && (
        <View style={{ gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Memories
          </Text>
          <Button
            compact
            secondary
            title="Albums & recaps"
            accessibilityLabel="Open activity memories"
            onPress={onOpenMemories}
          />
        </View>
      )}
    </View>
  );
}
