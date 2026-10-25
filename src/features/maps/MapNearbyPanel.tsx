import type { PublicBeaconSummary } from "@/src/features/discovery/types";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Maximize2, X } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, IconButton, useTheme } from "@/src/shared/ui";
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
}: {
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
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"Beacons" | "Friends">(
    initialSection ?? (beaconIds.length ? "Beacons" : "Friends"),
  );
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
  return (
    <View
      testID="map-nearby-panel"
      style={[styles.card, { flex: 1, minHeight: 0, padding: 12, gap: 6 }]}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.h2, { fontSize: 16 }]}>
            Nearby {"\u00b7"}{" "}
            {beacons.length + publicBeacons.length + people.length}
          </Text>
          <Text style={styles.muted}>
            {beacons.length + publicBeacons.length} Beacons · {people.length}{" "}
            friends nearby
          </Text>
        </View>
        <IconButton label="Zoom to fit" onPress={onFit}>
          <Maximize2 size={18} color={colors.ink} />
        </IconButton>
        <IconButton label="Close Nearby" onPress={onClose}>
          <X size={20} color={colors.ink} />
        </IconButton>
      </View>
      <TextInput
        accessibilityLabel="Search nearby Beacons and friends"
        value={query}
        onChangeText={setQuery}
        placeholder="Search this cluster"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          { minHeight: 36, paddingVertical: 6, fontSize: 13 },
        ]}
      />
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Nearby sections"
        style={[styles.row, { justifyContent: "flex-start" }]}
      >
        {(["Beacons", "Friends"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={`${value}, ${value === "Beacons" ? beacons.length + publicBeacons.length : people.length}`}
            aria-selected={tab === value}
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={{
              paddingHorizontal: 14,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: tokens.radius.button,
              backgroundColor: tab === value ? colors.lime : colors.bg,
            }}
          >
            <Text style={styles.body}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: tokens.space.sm,
          paddingBottom: tokens.space.md,
        }}
      >
        {tab === "Beacons" &&
          beacons
            .filter((activity) => matchesSearch(query, activity.title))
            .slice(0, expanded || query ? undefined : 3)
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
                  style={[styles.row, { paddingVertical: tokens.space.sm }]}
                >
                  <ActivityBadge category={activity.category} size={28} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.body}>{activity.title}</Text>
                    <Text style={styles.muted}>
                      {beaconPreviewWhen(activity, now)}
                    </Text>
                    <Text style={styles.muted}>
                      {place?.online_url
                        ? "Virtual"
                        : place?.label || "Meeting details restricted"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
        {tab === "Beacons" &&
          publicBeacons
            .filter((row) => matchesSearch(query, row.title, row.area_label))
            .slice(
              0,
              expanded || query ? undefined : Math.max(0, 3 - beacons.length),
            )
            .map((row) => (
              <Pressable
                key={row.activity_id}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${row.title} public Beacon`}
                onPress={() => onPublicBeacon?.(row.activity_id)}
                style={[styles.row, { paddingVertical: tokens.space.sm }]}
              >
                <ActivityBadge category={row.category} size={28} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.body}>
                    {row.title}
                  </Text>
                  <Text style={styles.muted}>
                    Public {"\u00b7"} {row.area_label}
                  </Text>
                </View>
              </Pressable>
            ))}
        {tab === "Friends" &&
          people
            .filter((person) =>
              matchesSearch(query, person.name, person.username),
            )
            .slice(0, expanded || query ? undefined : 3)
            .map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${person.name}'s profile`}
                onPress={() => onPerson(person.id)}
                style={[styles.row, { paddingVertical: tokens.space.sm }]}
              >
                <ProfileAvatar profile={person} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.body}>{person.name}</Text>
                  <Text numberOfLines={1} style={styles.muted}>
                    {userId ? personDiscoveryReason(data, person, userId) : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
        {!query &&
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
        {!(
          tab === "Beacons"
            ? [...beacons, ...publicBeacons].filter((activity) =>
                matchesSearch(query, activity.title),
              )
            : people.filter((person) =>
                matchesSearch(query, person.name, person.username),
              )
        ).length && (
          <Text style={styles.muted}>No matching {tab.toLowerCase()}.</Text>
        )}
      </ScrollView>
    </View>
  );
}
