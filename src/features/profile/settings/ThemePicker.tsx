import React from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { usePreferences } from "@/src/shared/preferences";
import { useTheme } from "@/src/shared/ui";
import { SegmentedControl, uiHaptics } from "@/src/shared/design-system";
import { getDesignColorTheme } from "@/src/theme/data";
import {
  themeNames,
  type AppearanceMode,
  type ResolvedAppearance,
  type ThemeName,
} from "@/src/theme/palettes";

const descriptions: Record<ThemeName, string> = {
  Essential: "Warm neutral",
  Midnight: "Quiet navy",
  Ocean: "Coastal blue",
  Mint: "Fresh sage",
  Sunset: "Warm coral",
  Berry: "Soft plum",
  Sunflower: "Soft gold",
};

function ThemePreviewChoice({
  name,
  appearance,
  label,
  selected,
  disabled,
  onPress,
}: {
  name: ThemeName;
  appearance: ResolvedAppearance;
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = getDesignColorTheme(name, appearance);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} palette`}
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      testID={`theme-preview-${name}-${appearance}`}
      style={{
        width: "48%",
        minHeight: 92,
        padding: 9,
        gap: 8,
        borderRadius: 16,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.primary : colors.outline,
        backgroundColor: colors.background,
      }}
    >
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          backgroundColor: colors.surface,
          borderRadius: 7,
          padding: 7,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          minHeight: 36,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View
            style={{
              height: 3,
              width: "70%",
              borderRadius: 2,
              backgroundColor: colors.textPrimary,
            }}
          />
          <View
            style={{
              height: 3,
              width: "90%",
              borderRadius: 2,
              backgroundColor: colors.textSecondary,
            }}
          />
        </View>
        <View
          style={{
            width: 30,
            minHeight: 20,
            borderRadius: 5,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ color: colors.onPrimary, fontSize: 9, fontWeight: "600" }}
          >
            Aa
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
        {selected && <Check size={14} color={colors.primary} />}
      </View>
      <Text
        style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 15 }}
      >
        {descriptions[name]}
      </Text>
    </Pressable>
  );
}

export function ThemePicker() {
  const preferences = usePreferences();
  const { styles } = useTheme();
  const choose = (name: ThemeName, appearance?: ResolvedAppearance) => {
    preferences.setTheme(name);
    if (appearance) preferences.setAppearanceMode(appearance);
    void uiHaptics.light();
  };
  return (
    <View testID="theme-picker" style={{ gap: 12 }}>
      <Text style={styles.label}>ESSENTIAL · WARM NEUTRAL</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {(["dark", "light"] as const).map((appearance) => (
          <ThemePreviewChoice
            key={appearance}
            name="Essential"
            appearance={appearance}
            label={`Essential ${appearance === "dark" ? "Dark" : "Light"}`}
            disabled={!preferences.ready}
            selected={
              preferences.theme === "Essential" &&
              preferences.resolvedAppearance === appearance
            }
            onPress={() => choose("Essential", appearance)}
          />
        ))}
      </View>
      <Text style={styles.label}>COLOR THEMES</Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 10,
        }}
      >
        {themeNames
          .filter((name) => name !== "Essential")
          .map((name) => (
            <ThemePreviewChoice
              key={name}
              name={name}
              appearance={preferences.resolvedAppearance}
              label={name}
              disabled={!preferences.ready}
              selected={preferences.theme === name}
              onPress={() => choose(name)}
            />
          ))}
      </View>
      <SegmentedControl<AppearanceMode>
        accessibilityLabel="Appearance"
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        value={preferences.appearanceMode}
        onChange={preferences.setAppearanceMode}
      />
      <Text style={styles.muted}>
        System follows your phone or browser. Your theme and appearance stay on
        this device.
      </Text>
    </View>
  );
}
