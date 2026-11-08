import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import {
  Activity,
  ChevronDown,
  MapPin,
  MessageCircle,
  ExternalLink,
  Navigation,
  RadioTower,
  Search,
  X,
} from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";
import {
  focusOverlay,
  useOverlayKeyboardFocus,
} from "@/src/shared/overlayFocus";

export function MapPlaceActions({
  maxHeight,
  title,
  onClose,
  onCreate,
  onPing,
  onUpdate,
  onDirections,
  onSearch,
  children,
}: {
  maxHeight: number;
  title: string;
  onClose(): void;
  onCreate(): void;
  onPing(): void;
  onUpdate(): void;
  onDirections(): void;
  onSearch(): void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const headerIconFace = {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.outline + "88",
    backgroundColor: colors.primaryContainer + "66",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  const root = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      focusOverlay(root, "Create Beacon"),
    );
    return () => {
      cancelAnimationFrame(frame);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useOverlayKeyboardFocus(root, true, onClose, () => focusOverlay(root));
  const actions = [
    { label: "Create Beacon", Icon: RadioTower, run: onCreate, primary: true },
    { label: "Start Ping", Icon: MessageCircle, run: onPing, mint: true },
    { label: "Add live update", Icon: Activity, run: onUpdate },
  ];
  return (
    <View
      ref={root}
      testID="map-place-actions"
      accessibilityLabel="At this place"
      style={{
        maxHeight,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface + "FA",
        overflow: "hidden",
        boxShadow: "0 4px 16px #00000020",
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", paddingLeft: 12 }}
      >
        <MapPin size={18} color={colors.primary} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginLeft: 10,
            color: colors.ink,
            fontSize: 14,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search location"
          accessibilityHint="Open location search to change this pin"
          onPress={onSearch}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View pointerEvents="none" style={headerIconFace}>
            <Search size={20} color={colors.primary} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close location actions"
          onPress={onClose}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View pointerEvents="none" style={headerIconFace}>
            <X size={20} color={colors.muted} />
          </View>
        </Pressable>
      </View>
      <ScrollView
        nativeID="map-place-action-scroll"
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 350, flexShrink: 1 }}
        contentContainerStyle={{ padding: 6, gap: 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {actions.map(({ label, Icon, run, primary, mint }) => (
          <View key={label}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={run}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor:
                  primary || pressed ? colors.primaryContainer : "transparent",
              })}
            >
              <Icon
                size={18}
                color={
                  mint
                    ? colors.success
                    : primary || label === "Add live update"
                      ? colors.primary
                      : colors.muted
                }
              />
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 13,
                  fontWeight: primary ? "700" : "500",
                }}
              >
                {label}
              </Text>
            </Pressable>
          </View>
        ))}
        {children && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Place activity"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded(!expanded)}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 10,
                gap: 10,
              }}
            >
              <Activity size={18} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.ink }}>Place activity</Text>
              <ChevronDown size={16} color={colors.muted} />
            </Pressable>
            {expanded && children}
          </>
        )}
      </ScrollView>
      <Pressable
        testID="locator-directions-footer"
        accessibilityRole="button"
        accessibilityLabel="Directions"
        accessibilityHint="Opens Google Maps in another app or browser."
        ref={(node) => {
          if (Platform.OS === "web")
            (node as unknown as HTMLElement | null)?.setAttribute(
              "title",
              "Get directions · opens Google Maps.",
            );
        }}
        onPress={onDirections}
        style={({ pressed }) => ({
          minHeight: 44,
          flexShrink: 0,
          paddingHorizontal: 12,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: pressed
            ? colors.primaryContainer
            : colors.primaryContainer + "33",
        })}
      >
        <Navigation size={16} color={colors.primary} />
        <Text
          style={{
            flex: 1,
            color: colors.ink,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          Get directions
        </Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>Google Maps</Text>
        <View
          testID="locator-directions-external"
          pointerEvents="none"
          accessible={false}
          aria-hidden={true}
          style={{ width: 12, height: 12 }}
        >
          <ExternalLink size={12} color={colors.muted} />
        </View>
      </Pressable>
    </View>
  );
}
