import { ThemedSwitch } from "@/src/shared/ThemedSwitch";
import React from "react";
import { Pressable, Text, View } from "react-native";
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
        borderRadius: 0,
        borderBottomWidth: 1,
        borderColor: colors.line,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={[styles.body, { fontWeight: "600", fontSize: 14 }]}>
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
  icon,
}: {
  title: string;
  detail?: string;
  icon?: React.ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { styles } = useTheme();
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {icon}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.body, { fontWeight: "600" }]}>{title}</Text>
        {detail ? <Txt muted>{detail}</Txt> : null}
      </View>
      <ThemedSwitch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

export function CreationModuleControls({
  value,
  onChange,
  category,
  focusMusic = false,
}: {
  value: BeaconControlValues;
  onChange: (value: BeaconControlValues) => void;
  category: string;
  focusMusic?: boolean;
}) {
  const { styles, colors } = useTheme();
  const recommendations = recommendedCreationModules(category).filter(
    (field) => !value[field],
  );
  return (
    <View style={{ gap: 12 }}>
      {recommendations.length > 0 && <View style={{ gap: 4 }}>
        <Txt muted>
          Suggested for {category} ·{" "}
          {creationModules
            .filter((row) => recommendations.includes(row.field))
            .map((row) => row.name)
            .join(" + ")}
        </Txt>
        <Button
          compact
          secondary
          title="Use suggested tools"
          onPress={() =>
            onChange({
              ...value,
              ...Object.fromEntries(
                recommendations.map((field) => [field, true]),
              ),
            })
          }
        />
      </View>}
      {(["Social", "Collaboration", "Media"] as const).map((family) => (
        <View key={family} style={{ gap: 4 }}>
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
                  title={row.name}
                  detail={row.description}
                  icon={
                    <Text accessible={false} style={styles.body}>
                      {row.icon}
                    </Text>
                  }
                  value={value[row.field]}
                  onChange={(enabled) =>
                    onChange({ ...value, [row.field]: enabled })
                  }
                />
                {value[row.field] && row.field === "enable_music" ? (
                  <Field
                    label="Music link"
                    autoFocus={focusMusic}
                    value={value.music_url ?? ""}
                    onChangeText={(music_url) =>
                      onChange({ ...value, music_url: music_url || null })
                    }
                    autoCapitalize="none"
                  />
                ) : null}
                {value[row.field] && row.field === "enable_checklist" ? (
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
                ) : null}
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}
