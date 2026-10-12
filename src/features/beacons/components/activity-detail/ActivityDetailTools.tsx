import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Card, useDesignTheme } from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";

const detailSeparator = " \u00b7 ";

export type ActivityDetailToolDescriptor = {
  id: string;
  icon: ReactNode;
  label: string;
  status?: string | null;
  paused?: boolean;
  onPress: () => void;
};

export function ActivityDetailTools({
  tools,
}: {
  tools: ActivityDetailToolDescriptor[];
}) {
  const { colors, tokens } = useDesignTheme();

  if (!tools.length) return null;

  const toolRows: ActivityDetailToolDescriptor[][] = [];
  for (let index = 0; index < tools.length; index += 2) {
    toolRows.push(tools.slice(index, index + 2));
  }

  return (
    <Card style={{ gap: space.sm, padding: space.md }}>
      <View style={{ gap: space.sm }}>
        {toolRows.map((row) => (
          <View key={row[0].id} style={{ flexDirection: "row", gap: space.sm }}>
            {row.map((tool) => {
              const paused = tool.paused === true;
              const status = tool.status?.trim();
              const detail = [
                tool.id === "focus" ? "On this device" : null,
                status || (paused ? "Paused" : null),
                paused ? "View history" : null,
              ]
                .filter(Boolean)
                .filter((item, index, all) => all.indexOf(item) === index)
                .join(detailSeparator);

              return (
                <Pressable
                  key={tool.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${tool.label}${detail ? `, ${detail}` : ""}`}
                  accessibilityHint={
                    paused ? "Opens this tool's saved history." : undefined
                  }
                  onPress={tool.onPress}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    minHeight: 112,
                    padding: space.md,
                    justifyContent: "space-between",
                    gap: space.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceRaised,
                    opacity: pressed ? 0.78 : paused ? 0.72 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.sm,
                      backgroundColor: paused
                        ? colors.surface
                        : colors.surfaceRaised,
                    }}
                  >
                    {tool.icon}
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text
                      maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                      numberOfLines={2}
                      style={{
                        color: colors.textPrimary,
                        ...type.headline,
                        fontSize: 15,
                        lineHeight: 19,
                      }}
                    >
                      {tool.label}
                    </Text>
                    {detail ? (
                      <Text
                        maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                        numberOfLines={2}
                        style={{ color: colors.textSecondary, ...type.caption }}
                      >
                        {detail}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
    </Card>
  );
}
