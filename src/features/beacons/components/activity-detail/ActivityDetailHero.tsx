import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { ArrowLeft, Ellipsis } from "lucide-react-native";
import type { Category } from "@/src/shared/types";
import { useDesignTheme, useReducedMotion } from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";
import { themeVariants } from "@/src/theme/palettes";

export type ActivityDetailHeroProps = {
  title: string;
  category: Category;
  modeLabel: string;
  stateLabel: string;
  stateTone: "open" | "pending" | "closed" | "ended";
  chips: string[];
  demo: boolean;
  scrollY: Animated.Value;
  onBack: () => void;
  onOverflow: () => void;
};

const stateColors: Record<
  ActivityDetailHeroProps["stateTone"],
  { background: string; foreground: string }
> = {
  open: { background: "#DDF5A1", foreground: "#173D32" },
  pending: { background: "#FFE2A8", foreground: "#543900" },
  closed: { background: "#E6E9E6", foreground: "#3F4A43" },
  ended: { background: "#E6E9E6", foreground: "#3F4A43" },
};

export function ActivityDetailHero({
  title,
  category,
  modeLabel,
  stateLabel,
  stateTone,
  chips,
  demo,
  scrollY,
  onBack,
  onOverflow,
}: ActivityDetailHeroProps) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { categories, tokens, theme, appearance } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [collapsedForAccessibility, setCollapsedForAccessibility] = useState(false);
  const collapsedForAccessibilityRef = useRef(false);
  const categoryToken = categories[category];
  const CategoryIcon = categoryToken.icon;
  const compact = screenWidth <= 375 || screenHeight <= 667;
  const expandedHeight = compact ? 180 : 212;
  const collapseDistance = expandedHeight - 56;
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      const next = value >= collapseDistance * 0.45;
      if (next === collapsedForAccessibilityRef.current) return;
      collapsedForAccessibilityRef.current = next;
      setCollapsedForAccessibility(next);
    });
    return () => scrollY.removeListener(listener);
  }, [collapseDistance, scrollY]);
  const animatedHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeight, 56],
    extrapolate: "clamp",
  });
  const expandedContentStyle = {
        opacity: scrollY.interpolate({
          inputRange: [0, 48, collapseDistance],
          outputRange: [1, 0.78, 0],
          extrapolate: "clamp" as const,
        }),
        transform: reducedMotion
          ? undefined
          : [
              {
                translateY: scrollY.interpolate({
                  inputRange: [0, collapseDistance],
                  outputRange: [0, -28],
                  extrapolate: "clamp" as const,
                }),
              },
            ],
      };
  const collapsedTitleStyle = {
    opacity: scrollY.interpolate({
      inputRange: [collapseDistance * 0.45, collapseDistance],
      outputRange: [0, 1],
      extrapolate: "clamp" as const,
    }),
  };
  const stateStyle = stateColors[stateTone];
  const palette = themeVariants[theme][appearance];
  const heroBackground = palette.heroBg;
  const heroText = palette.heroText;

  return (
    <Animated.View
      testID="activity-detail-hero"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        elevation: 5,
        height: animatedHeight,
        minHeight: 56,
        overflow: "hidden",
        backgroundColor: heroBackground,
        borderBottomLeftRadius: radius.sheet,
        borderBottomRightRadius: radius.sheet,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="activityHeroGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={heroBackground} />
            <Stop offset="1" stopColor={categoryToken.color} stopOpacity="0.82" />
          </LinearGradient>
        </Defs>
        <Circle cx="400" cy="12" r="174" fill="url(#activityHeroGradient)" />
        <Circle cx="355" cy="178" r="105" fill={categoryToken.tint} opacity="0.22" />
      </Svg>

      <View
        style={{
          position: "absolute",
          right: 18,
          bottom: -4,
          opacity: 0.18,
          transform: [{ rotate: "-12deg" }],
        }}
        pointerEvents="none"
      >
        <CategoryIcon size={142} color={tokens.categories[category].onColor} />
      </View>

      <View
        style={{
          height: 56,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: space.md,
          zIndex: 2,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.16)",
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <ArrowLeft size={21} color={heroText} />
        </Pressable>
        <Animated.Text
          numberOfLines={1}
          accessibilityElementsHidden={!collapsedForAccessibility}
          style={[
            {
              position: "absolute",
              left: 68,
              right: 68,
              textAlign: "center",
              color: heroText,
              ...type.headline,
              fontWeight: type.weight.bold,
            },
            collapsedTitleStyle,
          ]}
        >
          {title}
        </Animated.Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More activity options"
          onPress={onOverflow}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.16)",
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Ellipsis size={22} color={heroText} />
        </Pressable>
      </View>

      <Animated.View
        pointerEvents={reducedMotion ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            left: space.lg,
            right: space.lg,
            bottom: compact ? 12 : 16,
            gap: space.sm,
          },
          expandedContentStyle,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderRadius: radius.pill,
              backgroundColor: categoryToken.tint,
              paddingHorizontal: 10,
              minHeight: 28,
            }}
          >
            <CategoryIcon size={14} color={categoryToken.color} />
            <Text
              maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
              style={{ color: categoryToken.color, ...type.caption, fontWeight: type.weight.bold }}
            >
              {category}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={{ color: heroText, ...type.caption, fontWeight: type.weight.semibold }}
          >
            {"\u00b7"} {modeLabel}
          </Text>
          <View
            style={{
              minHeight: 28,
              justifyContent: "center",
              borderRadius: radius.pill,
              backgroundColor: stateStyle.background,
              paddingHorizontal: 10,
            }}
          >
            <Text
              maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
              style={{ color: stateStyle.foreground, ...type.caption, fontWeight: type.weight.bold }}
            >
              {stateLabel}
            </Text>
          </View>
          {demo && (
            <View
              style={{
                minHeight: 28,
                justifyContent: "center",
                borderRadius: radius.pill,
                backgroundColor: "rgba(255,255,255,0.18)",
                paddingHorizontal: 10,
              }}
            >
              <Text style={{ color: heroText, ...type.caption, fontWeight: type.weight.bold }}>
                Demo
              </Text>
            </View>
          )}
        </View>
        <Text
          accessibilityRole="header"
          accessibilityElementsHidden={collapsedForAccessibility}
          numberOfLines={compact ? 1 : 2}
          style={{
            color: heroText,
            fontSize: compact ? 22 : 30,
            lineHeight: compact ? 28 : 36,
            fontWeight: type.weight.bold,
            letterSpacing: -0.4,
          }}
        >
          {title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {chips.slice(0, 3).map((chip) => (
            <View
              key={chip}
              style={{
                minHeight: 26,
                justifyContent: "center",
                borderRadius: radius.pill,
                backgroundColor: "rgba(255,255,255,0.16)",
                paddingHorizontal: 9,
              }}
            >
              <Text numberOfLines={1} style={{ color: heroText, ...type.caption }}>
                {chip}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}
