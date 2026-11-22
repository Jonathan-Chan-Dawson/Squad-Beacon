import { followedBeaconIds } from "@/src/features/discovery/beaconTopics";
import type { PublicBeaconSummary } from "@/src/features/discovery/types";
import React, { useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from "react-native";
import { Info, Maximize2, Search } from "lucide-react-native";
import { cardPresentation as card } from "@/src/theme/cardPresentation";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, useTheme } from "@/src/shared/ui";
import { clusterPeople } from "./mapDiscovery";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadBeaconMeetingDetails } from "./filtering";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import {
  beaconDiscoveryTier,
  beaconPreviewWhen,
  personDiscoveryReason,
} from "./discoveryRanking";
import {
  MapTooltipShell,
  MapTooltipHeader,
  MapTooltipControl,
  MapTooltipClose,
} from "./MapTooltipShell";
import { ActionRow, ContextMenu } from "@/src/shared/ContextMenu";
import { matchesSearch } from "@/src/shared/search";

export function MapNearbyPanel({
  beaconIds,
  publicBeacons: publicRows = [],
  onPublicBeacon,
  personIds,
  initialSection,
  onClose,
  onBeacon,
  onPerson,
  onFit,
  compact = false,
}: {
  compact?: boolean;
  beaconIds: string[];
  publicBeacons?: PublicBeaconSummary[];
  onPublicBeacon?: (id: string) => void;
  personIds: string[];
  initialSection?: "Beacons" | "Friends";
  onClose(): void;
  onBeacon(id: string): void;
  onPerson(id: string): void;
  onFit(): void;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors, tokens } = useTheme();
  const now = useNow();
  const [infoOpen, setInfoOpen] = useState(false);
  const infoAnchor = useRef<View>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"Beacons" | "Friends">(
    initialSection ?? (beaconIds.length ? "Beacons" : "Friends"),
  );
  const prioritized = followedBeaconIds(data, userId, true);
  const beacons = userId
    ? data.activities
        .filter(
          (activity) =>
            beaconIds.includes(activity.id) &&
            canReadBeaconActivity(data, activity, userId),
        )
        .sort(
          (a, b) =>
            beaconDiscoveryTier(data, a, userId, now) -
              beaconDiscoveryTier(data, b, userId, now) ||
            Number(prioritized.has(b.id)) - Number(prioritized.has(a.id)) ||
            Date.parse(a.starts_at) - Date.parse(b.starts_at),
        )
    : [];
  const people = clusterPeople(data, [], personIds, userId);
  const readableIds = new Set(beacons.map((row) => row.id));
  const publicBeacons = [
    ...new Map(
      publicRows
        .filter((row) => !readableIds.has(row.activity_id))
        .map((row) => [row.activity_id, row]),
    ).values(),
  ];
  const beaconCount = beacons.length + publicBeacons.length;
  const matchingBeacons = beacons.filter((activity) => matchesSearch(query, activity.title));
  const matchingPublicBeacons = publicBeacons.filter((row) => matchesSearch(query, row.title, row.area_label));
  const matchingPeople = people.filter((person) => matchesSearch(query, person.name, person.username));
  const hasMatches = compact
    ? matchingBeacons.length + matchingPublicBeacons.length + matchingPeople.length > 0
    : tab === "Beacons"
      ? matchingBeacons.length + matchingPublicBeacons.length > 0
      : matchingPeople.length > 0;
  const resultRow: ViewStyle = {
    minHeight: 48,
    paddingHorizontal: card.rowGap,
    paddingVertical: card.inlineGap,
    gap: card.rowGap,
    borderRadius: card.smallInsetRadius,
    backgroundColor: colors.surfaceRaised,
  };
  return (
    <View style={{ maxHeight: 320, flexShrink: 1 }}>
      <MapTooltipShell testID="map-nearby-panel">
        <MapTooltipHeader
          controls={
            <>
              <View ref={infoAnchor} collapsable={false}>
                <MapTooltipControl
                  label="Cluster info & actions"
                  onPress={() => setInfoOpen(true)}
                  icon={<Info size={18} color={colors.ink} />}
                  expanded={infoOpen}
                />
              </View>
              <MapTooltipClose label="Close Nearby" onClose={onClose} />
            </>
          }
        >
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[styles.h2, tokens.type.titleSmall]}>
              Nearby · {beaconCount + people.length}
            </Text>
          </View>
        </MapTooltipHeader>
        {!compact && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: card.rowGap, paddingHorizontal: card.rowGap, borderWidth: 1, borderRadius: card.insetRadius, borderColor: colors.line, backgroundColor: colors.bg }}>
            <Search size={15} color={colors.muted} />
            <TextInput
              accessibilityLabel="Search nearby Beacons and friends"
              value={query}
              onChangeText={setQuery}
              placeholder="Search this cluster"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, minWidth: 0, minHeight: card.touchTarget, color: colors.ink, ...tokens.type.secondary }}
            />
          </View>
        )}
        {!compact && (
          <View
            accessibilityRole="tablist"
            accessibilityLabel="Nearby sections"
            style={{ flexDirection: "row", gap: card.rowGap, borderBottomWidth: 1, borderColor: colors.line }}
          >
            {(["Beacons", "Friends"] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityLabel={`${value}, ${value === "Beacons" ? beaconCount : people.length}`}
                aria-selected={tab === value}
                accessibilityState={{ selected: tab === value }}
                onPress={() => setTab(value)}
                style={({ pressed }) => ({
                  paddingHorizontal: card.rowGap,
                  minHeight: card.touchTarget,
                  alignItems: "center",
                  justifyContent: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: tab === value ? colors.primary : "transparent",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={[tokens.type.secondary, { color: tab === value ? colors.primary : colors.muted, fontWeight: "600" }]}>
                  {value} {value === "Beacons" ? beaconCount : people.length}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <ScrollView
          style={{
            flexShrink: 1,
            minHeight: 0,
            maxHeight: compact ? 240 : 180,
          }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 4,
            paddingBottom: 0,
          }}
        >
          {(compact || tab === "Beacons") &&
            matchingBeacons
              .slice(0, compact || expanded || query ? undefined : 3)
              .map((activity) => {
                const place =
                  userId && canReadBeaconMeetingDetails(data, activity, userId)
                    ? data.places.find((row) => row.activity_id === activity.id)
                    : undefined;
                return (
                  <Pressable
                    key={activity.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${activity.title} Beacon`}
                    onPress={() => onBeacon(activity.id)}
                    style={({ pressed }) => [styles.row, resultRow, { opacity: pressed ? 0.74 : 1 }]}
                  >
                    <ActivityBadge category={activity.category} size={32} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={[styles.body, tokens.type.secondary, { fontWeight: "600" }]}
                      >
                        {activity.title}
                      </Text>
                      <Text style={[styles.muted, tokens.type.caption]}>
                        {beaconPreviewWhen(activity, now)}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.muted, { fontSize: 11 }]}
                      >
                        {place?.online_url
                          ? "Virtual"
                          : place?.label || "Meeting details restricted"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          {(compact || tab === "Beacons") &&
            matchingPublicBeacons
              .slice(
                0,
                compact || expanded || query
                  ? undefined
                  : Math.max(0, 3 - beacons.length),
              )
              .map((row) => (
                <Pressable
                  key={row.activity_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${row.title} public Beacon`}
                  onPress={() => onPublicBeacon?.(row.activity_id)}
                  style={({ pressed }) => [styles.row, resultRow, { opacity: pressed ? 0.74 : 1 }]}
                >
                  <ActivityBadge category={row.category} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.body, tokens.type.secondary, { fontWeight: "600" }]}>
                      {row.title}
                    </Text>
                    <Text style={[styles.muted, tokens.type.caption]}>
                      Public {"\u00b7"} {row.area_label}
                    </Text>
                  </View>
                </Pressable>
              ))}
          {(compact || tab === "Friends") &&
            matchingPeople
              .slice(0, compact || expanded || query ? undefined : 3)
              .map((person) => (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${person.name}'s profile`}
                  onPress={() => onPerson(person.id)}
                  style={({ pressed }) => [styles.row, resultRow, { opacity: pressed ? 0.74 : 1 }]}
                >
                  <ProfileAvatar profile={person} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.body, tokens.type.secondary, { fontWeight: "600" }]}
                    >
                      {person.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.muted}>
                      {userId
                        ? personDiscoveryReason(data, person, userId)
                        : ""}
                    </Text>
                  </View>
                </Pressable>
              ))}
          {!compact &&
            !query &&
            (tab === "Beacons"
              ? beacons.length + publicBeacons.length
              : people.length) > 3 && (
              <View style={{ alignSelf: "flex-start" }}>
                <Button
                  title={expanded ? "Show fewer" : "View all"}
                  secondary
                  compact
                  onPress={() => setExpanded(!expanded)}
                />
              </View>
            )}
          {!hasMatches && (
            <Text style={styles.muted}>No matching {tab.toLowerCase()}.</Text>
          )}
        </ScrollView>
      </MapTooltipShell>
      <ContextMenu
        title="Nearby"
        visible={infoOpen}
        anchorRef={infoAnchor}
        onClose={() => setInfoOpen(false)}
      >
        <Text style={styles.muted}>
          {beacons.length + publicBeacons.length} Beacons · {people.length}{" "}
          friends nearby. Proximity does not indicate attendance.
        </Text>
        <ActionRow
          label="Zoom to fit"
          icon={<Maximize2 size={18} color={colors.ink} />}
          onPress={() => {
            setInfoOpen(false);
            onFit();
          }}
        />
      </ContextMenu>
    </View>
  );
}
