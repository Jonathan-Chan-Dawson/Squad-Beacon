import React, { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { Tabs, router, usePathname } from "expo-router";
import { Map, Radio, Users, UserRound, Plus } from "lucide-react-native";
import { Button, Sheet, useTheme } from "@/src/shared/ui";
import { GlassBar } from "@/src/shared/design-system";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { pendingSocialCount } from "@/src/features/people/communication";
import { useReducedMotion } from "react-native-reanimated";

let createPulseConsumedThisSession = false;

const items = [
  { name: "index", label: "Map", Icon: Map },
  { name: "activities", label: "Beacons", Icon: Radio },
  { name: "squads", label: "Squads", Icon: Users },
  { name: "profile", label: "Profile", Icon: UserRound },
];

export default function TabLayout() {
  const { semanticColors, tokens } = useTheme();
  const { data, userId } = useBeacon();
  const pending = pendingSocialCount(data, userId, useNow());
  const [actions, setActions] = useState(false);
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [createPulse, setCreatePulse] = useState(false);
  const [pulseProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (pathname !== "/" || createPulseConsumedThisSession) return;
    createPulseConsumedThisSession = true;
    if (reducedMotion) return;
    let animation: Animated.CompositeAnimation | undefined;
    const frame = requestAnimationFrame(() => {
      setCreatePulse(true);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseProgress, { toValue: 1, duration: 620, useNativeDriver: true }),
          Animated.timing(pulseProgress, { toValue: 0, duration: 620, useNativeDriver: true }),
        ]),
        { iterations: 2 },
      );
      animation.start();
    });
    const timer = setTimeout(() => {
      animation?.stop();
      setCreatePulse(false);
    }, 2500);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      animation?.stop();
    };
  }, [pathname, pulseProgress, reducedMotion]);

  function create(kind: string) {
    setActions(false);
    router.push({ pathname: "/create", params: { kind } });
  }

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state, navigation, insets }) => (
          <View style={{ position: "relative" }}>
            <GlassBar
              style={{
                borderRadius: 0,
                borderWidth: 0,
                borderTopWidth: 1,
                borderTopColor: semanticColors.border,
                paddingBottom: insets.bottom,
                overflow: "visible",
              }}
            >
              <View
                style={{
                  height: tokens.layout.tabBarHeight,
                  width: "100%",
                  maxWidth: tokens.layout.contentMaxWidth,
                  alignSelf: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: tokens.layout.screenGutter,
                }}
              >
                {items.map(({ name, label, Icon }, index) => {
                  const route = state.routes.find((item) => item.name === name)!;
                  const focused = state.routes[state.index].name === name;
                  return (
                    <React.Fragment key={name}>
                      {index === 2 ? (
                        <View style={{ width: tokens.layout.createButtonSize }} />
                      ) : null}
                      <MotionPressable
                        accessibilityRole="tab"
                        accessibilityLabel={label}
                        accessibilityState={{ selected: focused }}
                        aria-selected={focused}
                        onPress={() => {
                          const event = navigation.emit({
                            type: "tabPress",
                            target: route.key,
                            canPreventDefault: true,
                          });
                          if (!event.defaultPrevented) navigation.navigate(name);
                        }}
                        style={{
                          flex: 1,
                          minHeight: tokens.layout.touchTarget,
                          alignItems: "center",
                          justifyContent: "center",
                          gap: tokens.space.xxs,
                        }}
                      >
                        <Icon
                          size={tokens.iconSize.md}
                          color={focused ? semanticColors.accent : semanticColors.textSecondary}
                        />
                        {name === "squads" && pending > 0 ? (
                          <View
                            style={{
                              position: "absolute",
                              top: tokens.space.xxs,
                              right: tokens.space.sm,
                              minWidth: tokens.type.caption.lineHeight + tokens.space.sm,
                              minHeight: tokens.type.caption.lineHeight + tokens.space.sm,
                              paddingHorizontal: tokens.space.xs,
                              borderRadius: tokens.radius.circle,
                              backgroundColor: semanticColors.accent,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              accessibilityLabel={`${pending} pending responses`}
                              maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                              style={{
                                ...tokens.type.caption,
                                fontWeight: tokens.type.weight.bold,
                                color: semanticColors.onAccent,
                              }}
                            >
                              {pending > 99 ? "99+" : pending}
                            </Text>
                          </View>
                        ) : null}
                        <Text
                          maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                          style={{
                            ...tokens.type.caption,
                            fontWeight: focused
                              ? tokens.type.weight.semibold
                              : tokens.type.weight.medium,
                            color: focused
                              ? semanticColors.accent
                              : semanticColors.textSecondary,
                          }}
                        >
                          {label}
                        </Text>
                      </MotionPressable>
                    </React.Fragment>
                  );
                })}
              </View>
            </GlassBar>
            {createPulse ? (
              <Animated.View
                pointerEvents="none"
                accessibilityElementsHidden
                style={{
                  position: "absolute",
                  left: "50%",
                  marginLeft: -tokens.layout.createButtonSize / 2,
                  top: -tokens.layout.createButtonRaise,
                  width: tokens.layout.createButtonSize,
                  height: tokens.layout.createButtonSize,
                  borderRadius: tokens.radius.circle,
                  borderWidth: 2,
                  borderColor: semanticColors.accent,
                  opacity: pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  transform: [{ scale: pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
                  zIndex: 1,
                }}
              />
            ) : null}
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Create Beacon"
              onPress={() => setActions(true)}
              style={{
                position: "absolute",
                left: "50%",
                marginLeft: -tokens.layout.createButtonSize / 2,
                top: -tokens.layout.createButtonRaise,
                width: tokens.layout.createButtonSize,
                height: tokens.layout.createButtonSize,
                borderRadius: tokens.radius.circle,
                borderWidth: tokens.space.xs,
                borderColor: semanticColors.bg,
                backgroundColor: semanticColors.accent,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
                shadowColor: semanticColors.textPrimary,
                shadowOpacity: tokens.shadow.raised.opacity,
                shadowRadius: tokens.shadow.raised.radius,
                shadowOffset: { width: 0, height: tokens.shadow.raised.offsetY },
                elevation: tokens.shadow.raised.elevation,
              }}
            >
              <Plus size={tokens.iconSize.lg} color={semanticColors.onAccent} />
            </MotionPressable>
          </View>
        )}
      >
        <Tabs.Screen name="index" options={{ title: "Map" }} />
        <Tabs.Screen name="activities" options={{ title: "Beacons" }} />
        <Tabs.Screen name="squads" options={{ title: "Squads" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        <Tabs.Screen name="two" options={{ href: null }} />
      </Tabs>
      <Sheet
        title="What are you up to?"
        visible={actions}
        onClose={() => setActions(false)}
      >
        <Button title="Create a beacon" onPress={() => create("beacon")} />
        <Button
          title="Share a status"
          secondary
          onPress={() => create("status")}
        />
        <Button
          title="Make a squad plan"
          secondary
          onPress={() => create("squad")}
        />
      </Sheet>
    </>
  );
}
