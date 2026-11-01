import React from "react";
import { Platform, Switch, type SwitchProps } from "react-native";
import { useDesignTheme } from "@/src/theme";

/** A visible track on both page and card surfaces, in every theme. */
export function ThemedSwitch(props: SwitchProps) {
  const { colors } = useDesignTheme();
  const thumb = props.value ? colors.onPrimary : "#FFFFFF";
  return (
    <Switch
      {...props}
      trackColor={{ false: colors.borderStrong, true: colors.primary }}
      ios_backgroundColor={colors.borderStrong}
      thumbColor={thumb}
      {...Platform.select({ web: { activeThumbColor: thumb }, default: {} })}
    />
  );
}
