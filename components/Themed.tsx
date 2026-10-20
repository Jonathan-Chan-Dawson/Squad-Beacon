/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */
import { Text as DefaultText, View as DefaultView } from "react-native";

import { useDesignTheme } from "@/src/theme";

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName:
    "text" | "background" | "tint" | "tabIconDefault" | "tabIconSelected",
) {
  const { colors, appearance } = useDesignTheme();
  const colorFromProps = props[appearance];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return {
      text: colors.textPrimary,
      background: colors.background,
      tint: colors.primary,
      tabIconDefault: colors.textSecondary,
      tabIconSelected: colors.primary,
    }[colorName];
  }
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "background",
  );

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
