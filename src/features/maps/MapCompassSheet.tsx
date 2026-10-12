import React, { useEffect, useState } from "react";
import {
  BackHandler,
  Platform,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  Compass,
  LocateFixed,
  MapPin,
  Search,
  Settings2,
  X,
} from "lucide-react-native";
import { Button, Sheet, useTheme } from "@/src/shared/ui";
import { WorldwidePlaceSearch } from "@/src/features/maps/WorldwidePlaceSearch";
import type { WorldwidePlace } from "@/src/features/maps/placeSearch";
import type { ActivityPlace } from "@/src/shared/types";

import { MapStyleControls } from "./MapOptions";
import type { MapStyle } from "./components/BeaconMap";

type PlaceChoice = ActivityPlace & { label: string };

function CompassAction({
  icon: Icon,
  title,
  subtitle,
  onPress,
  busy,
  disabled,
  compact = false,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: compact ? 44 : 68,
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingHorizontal: 10,
        borderRadius: 16,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: compact ? 28 : 40,
          height: compact ? 28 : 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          backgroundColor: colors.lime + "55",
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.green} />
        ) : (
          <Icon size={19} color={colors.green} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
          {title}
        </Text>
        {!compact && (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function MapCompassSheet({
  visible,
  inline = false,
  mapStyle,
  onMapStyle,
  onOptions,
  maxHeight = 440,
  onClose,
  busy,
  message,
  onUseMyLocation,
  onOpenSettings,
  onReturnOverview,
  onExploreEverywhere,
  query,
  onQueryChange,
  onQuerySubmit,
  searchPlaceOpen,
  onToggleSearchPlace,
  places,
  recentQueries,
  onChoosePlace,
  onSelectRecent,
  onChooseWorldPlace,
}: {
  visible: boolean;
  inline?: boolean;
  mapStyle?: MapStyle;
  onMapStyle?: (value: MapStyle) => void;
  onOptions?: () => void;
  maxHeight?: number;
  onClose: () => void;
  busy: boolean;
  message: string;
  onUseMyLocation: () => void;
  onOpenSettings: () => void;
  onReturnOverview: () => void;
  onExploreEverywhere: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  onQuerySubmit: (query: string) => void;
  searchPlaceOpen: boolean;
  onToggleSearchPlace: () => void;
  places: PlaceChoice[];
  recentQueries: string[];
  onChoosePlace: (place: PlaceChoice) => void;
  onSelectRecent: (query: string) => void;
  onChooseWorldPlace?: (place: WorldwidePlace) => void;
}) {
  const { colors, styles } = useTheme();
  const [searchExpanded, setSearchExpanded] = useState(false);

  useEffect(() => {
    if (!inline || !visible) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    if (Platform.OS === "web") document.addEventListener("keydown", escape);
    return () => {
      back.remove();
      if (Platform.OS === "web")
        document.removeEventListener("keydown", escape);
    };
  }, [inline, visible, onClose]);
  const content = (
    <>
      {inline && mapStyle && onMapStyle && (
        <View style={{ gap: 7, paddingBottom: 8 }}>
          <Text style={styles.label}>MAP TYPE</Text>
          <MapStyleControls style={mapStyle} onStyle={onMapStyle} />
        </View>
      )}
      <View style={{ gap: 5, paddingBottom: 6 }}>
        {!inline && <Text style={styles.h2}>Find your way</Text>}
        <Text style={styles.muted}>
          Centering the map never shares your location.
        </Text>
      </View>
      <View style={{ gap: 3 }}>
        <CompassAction
          compact={inline}
          icon={LocateFixed}
          title="Use my location"
          subtitle="Centers the map on you. Doesn't share your location."
          onPress={onUseMyLocation}
          busy={busy}
          disabled={busy}
        />
        {message ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              marginHorizontal: 10,
              marginBottom: 5,
              padding: 12,
              gap: 7,
              borderRadius: 14,
              backgroundColor: colors.bg,
            }}
          >
            <Text style={styles.muted}>{message}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
              onPress={onOpenSettings}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Settings2 size={16} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700" }}>
                Open Settings
              </Text>
            </Pressable>
          </View>
        ) : null}
        <CompassAction
          compact={inline}
          icon={Compass}
          title="Return to overview"
          subtitle="Fits the Beacons and plans in your current results."
          onPress={onReturnOverview}
        />
        <CompassAction
          compact={inline}
          icon={MapPin}
          title="Explore everywhere"
          subtitle="Clear the current place boundary and explore all results."
          onPress={onExploreEverywhere}
        />
        <CompassAction
          compact={inline}
          icon={Search}
          title="Search another place"
          subtitle="Choose a place from your Beacons or search an address."
          onPress={() => {
            setSearchExpanded(true);
            onToggleSearchPlace();
          }}
        />
      </View>

      {searchExpanded && searchPlaceOpen ? (
        <View style={{ gap: 10, paddingTop: 10 }}>
          <View
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
            }}
          >
            <Search size={17} color={colors.green} />
            <TextInput
              accessibilityLabel="Search another place"
              placeholder="Search another place"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={onQueryChange}
              onSubmitEditing={({ nativeEvent }) =>
                onQuerySubmit(nativeEvent.text)
              }
              returnKeyType="search"
              style={
                {
                  flex: 1,
                  color: colors.ink,
                  paddingVertical: 10,
                  outlineStyle: "none",
                } as never
              }
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear place search"
                onPress={() => onQueryChange("")}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={17} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 230 }}
            contentContainerStyle={{ gap: 5 }}
          >
            {!!recentQueries.length ? (
              <Text style={styles.label}>RECENT SEARCHES</Text>
            ) : null}
            {recentQueries.map((recent) => (
              <Pressable
                key={recent.toLowerCase()}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${recent}`}
                onPress={() => onSelectRecent(recent)}
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                <ArrowLeft size={15} color={colors.muted} />
                <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>
                  {recent}
                </Text>
              </Pressable>
            ))}
            {!!places.length ? (
              <Text style={[styles.label, { marginTop: 6 }]}>
                PLACES FROM YOUR BEACONS
              </Text>
            ) : null}
            {places.map((place) => (
              <Pressable
                key={`${place.activity_id}:${place.latitude}:${place.longitude}`}
                accessibilityRole="button"
                accessibilityLabel={`Explore ${place.label}`}
                onPress={() => onChoosePlace(place)}
                style={{
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                <MapPin size={17} color={colors.green} />
                <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>
                  {place.label}
                </Text>
              </Pressable>
            ))}
            {!places.length && !recentQueries.length ? (
              <Text style={styles.muted}>
                Your searched places will appear here when you use the map.
              </Text>
            ) : null}
          </ScrollView>
          <WorldwidePlaceSearch query={query} onChoose={onChooseWorldPlace} />
        </View>
      ) : null}
      {inline && onOptions && (
        <Button
          title="More map settings"
          compact
          secondary
          onPress={onOptions}
        />
      )}
      <Button title="Done" compact={inline} secondary onPress={onClose} />
    </>
  );
  if (inline)
    return visible ? (
      <ScrollView
        testID="map-side-menu"
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight }}
        contentContainerStyle={{ padding: 12, gap: 5 }}
      >
        {content}
      </ScrollView>
    ) : null;
  return (
    <Sheet
      title="Compass"
      visible={visible}
      onClose={onClose}
      maxHeightPercent={78}
    >
      {content}
    </Sheet>
  );
}
