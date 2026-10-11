import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Maximize2, X } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { IconButton, useTheme } from "@/src/shared/ui";
import { clusterPeople } from "./mapDiscovery";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadBeaconMeetingDetails } from "./filtering";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { activityWhen } from "@/src/shared/domain";
import { matchesSearch } from "@/src/shared/search";

export function MapNearbyPanel({
  beaconIds,
  personIds,
  onClose,
  onBeacon,
  onPerson,
  onFit,
}: {
  beaconIds: string[];
  personIds: string[];
  onClose(): void;
  onBeacon(id: string): void;
  onPerson(id: string): void;
  onFit(): void;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors, tokens } = useTheme();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"Beacons" | "People">("Beacons");
  const beacons = userId
    ? data.activities.filter(
        (activity) =>
          beaconIds.includes(activity.id) &&
          canReadBeaconActivity(data, activity, userId),
      )
    : [];
  const people = clusterPeople(data, beaconIds, personIds, userId);
  return (
    <View
      testID="map-nearby-panel"
      style={[styles.card, { flex: 1, minHeight: 0 }]}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h2}>Nearby</Text>
          <Text style={styles.muted}>
            {beacons.length} Beacons · {people.length} People
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
        accessibilityLabel="Search nearby Beacons and people"
        value={query}
        onChangeText={setQuery}
        placeholder="Search this cluster"
        placeholderTextColor={colors.muted}
        style={[styles.input, { minHeight: tokens.layout.minTapTarget }]}
      />
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Nearby sections"
        style={styles.row}
      >
        {(["Beacons", "People"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={`${value}, ${value === "Beacons" ? beacons.length : people.length}`}
            aria-selected={tab === value}
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={{
              flex: 1,
              minHeight: tokens.layout.minTapTarget,
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
                  <ActivityBadge category={activity.category} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.body}>{activity.title}</Text>
                    <Text style={styles.muted}>
                      {activityWhen(activity, new Date(now))}
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
        {tab === "People" &&
          people
            .filter((person) =>
              matchesSearch(query, person.name, person.username),
            )
            .map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${person.name}'s profile`}
                onPress={() => onPerson(person.id)}
                style={[styles.row, { paddingVertical: tokens.space.sm }]}
              >
                <ProfileAvatar profile={person} />
                <Text style={[styles.body, { flex: 1 }]}>{person.name}</Text>
              </Pressable>
            ))}
        {!(
          tab === "Beacons"
            ? beacons.filter((activity) => matchesSearch(query, activity.title))
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
