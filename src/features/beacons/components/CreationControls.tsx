import React, { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Button, Field, Txt, useTheme } from "@/src/shared/ui";
import type { BeaconControlValues } from "../controls";
import {
  creationModules,
  recommendedCreationModules,
} from "../creationModules";

export function CreationRow({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail?: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, detail].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.line,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={[styles.body, { fontWeight: "700", fontSize: 14 }]}>
          {title}
        </Text>
        {detail ? (
          <Text style={[styles.muted, { fontSize: 12 }]}>{detail}</Text>
        ) : null}
      </View>
      <ChevronRight size={17} color={colors.muted} />
    </Pressable>
  );
}

export function CreationSwitch({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { styles, colors } = useTheme();
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.body, { fontWeight: "600" }]}>{title}</Text>
        {detail ? <Txt muted>{detail}</Txt> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}

export function CreationModuleControls({
  value,
  onChange,
  category,
}: {
  value: BeaconControlValues;
  onChange: (value: BeaconControlValues) => void;
  category: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { styles, colors } = useTheme();
  const recommendations = recommendedCreationModules(category);
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>Recommended for this activity</Text>
      <Txt muted>
        {creationModules
          .filter((row) => recommendations.includes(row.field))
          .map((row) => row.name)
          .join(" + ")}
      </Txt>
      <Button
        compact
        secondary
        title="Apply recommendations"
        onPress={() =>
          onChange({
            ...value,
            ...Object.fromEntries(
              recommendations.map((field) => [field, true]),
            ),
          })
        }
      />
      {(["Social", "Tools", "Media"] as const).map((family) => (
        <View key={family} style={{ gap: 5 }}>
          <Text style={styles.label}>{family}</Text>
          {creationModules
            .filter((row) => row.family === family)
            .map((row) => (
              <View
                key={row.field}
                style={{
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                  paddingBottom: 6,
                }}
              >
                <CreationSwitch
                  title={`${row.icon}  ${row.name}`}
                  detail={row.description}
                  value={value[row.field]}
                  onChange={(enabled) =>
                    onChange({ ...value, [row.field]: enabled })
                  }
                />
                {value[row.field] ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${row.name} settings`}
                      style={{ minHeight: 44, justifyContent: "center" }}
                      onPress={() =>
                        setExpanded(expanded === row.field ? null : row.field)
                      }
                    >
                      <Txt muted>
                        {expanded === row.field ? "Hide settings" : "Settings"}
                      </Txt>
                    </Pressable>
                    {expanded === row.field ? (
                      row.field === "enable_music" ? (
                        <Field
                          label="Music link"
                          value={value.music_url ?? ""}
                          onChangeText={(music_url) =>
                            onChange({ ...value, music_url: music_url || null })
                          }
                          autoCapitalize="none"
                        />
                      ) : row.field === "enable_checklist" ? (
                        <CreationSwitch
                          title="Only managers edit the checklist"
                          value={value.checklist_edit_policy === "managers"}
                          onChange={(enabled) =>
                            onChange({
                              ...value,
                              checklist_edit_policy: enabled
                                ? "managers"
                                : "participants",
                            })
                          }
                        />
                      ) : (
                        <Txt muted>
                          No additional settings. Content is added after
                          creating.
                        </Txt>
                      )
                    ) : null}
                  </>
                ) : null}
              </View>
            ))}
        </View>
      ))}
      <Text style={styles.h2}>Selected modules</Text>
      {creationModules
        .filter((row) => value[row.field])
        .map((row) => (
          <Text key={row.field} style={styles.body}>
            {row.icon} {row.name}
          </Text>
        ))}
    </View>
  );
}
