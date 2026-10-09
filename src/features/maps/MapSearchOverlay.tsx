import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MapPin, Search, Clock3 } from "lucide-react-native";
import type { Activity, ActivityPlace, Profile } from "@/src/shared/types";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { Button, useTheme } from "@/src/shared/ui";

type PlaceResult = ActivityPlace & { label: string };

function SearchSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export function MapSearchOverlay({
  visible,
  query,
  beacons,
  people,
  places,
  recentQueries,
  onSelectBeacon,
  onSelectPerson,
  onSelectPlace,
  onSelectRecent,
  onChoosePlaceForNewBeacon,
  onStartPickingLocation,
}: {
  visible: boolean;
  query: string;
  beacons: Activity[];
  people: Profile[];
  places: PlaceResult[];
  recentQueries: string[];
  onSelectBeacon: (activity: Activity) => void;
  onSelectPerson: (profile: Profile) => void;
  onSelectPlace: (place: PlaceResult) => void;
  onSelectRecent: (query: string) => void;
  onChoosePlaceForNewBeacon: (place: PlaceResult) => void;
  onStartPickingLocation: () => void;
}) {
  const { colors, styles } = useTheme();
  const term = query.trim();
  if (!visible) return null;

  return (
    <View
      testID="map-search-results"
      style={{
        width: "100%",
        maxHeight: 430,
        marginTop: 7,
        padding: 12,
        gap: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white + "F5",
        boxShadow: "0 8px 28px #142e3033",
      }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {!!beacons.length && (
          <SearchSection title="Beacons">
            {beacons.slice(0, 5).map((activity) => (
              <Pressable
                key={activity.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${activity.title} Beacon`}
                onPress={() => onSelectBeacon(activity)}
                style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, borderRadius: 13 }}
              >
                <ActivityBadge category={activity.category} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{activity.title}</Text>
                  <Text numberOfLines={1} style={styles.muted}>Beacon</Text>
                </View>
              </Pressable>
            ))}
          </SearchSection>
        )}

        {!!people.length && (
          <SearchSection title="People">
            {people.slice(0, 5).map((profile) => (
              <Pressable
                key={profile.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${profile.name} on map`}
                onPress={() => onSelectPerson(profile)}
                style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, borderRadius: 13 }}
              >
                <ProfileAvatar profile={profile} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{profile.name}</Text>
                  <Text numberOfLines={1} style={styles.muted}>{profile.username ? `@${profile.username}` : "Person"}</Text>
                </View>
              </Pressable>
            ))}
          </SearchSection>
        )}

        {!!places.length && (
          <SearchSection title="Places">
            {places.slice(0, 6).map((place) => (
              <View key={`${place.activity_id}:${place.latitude}:${place.longitude}`} style={{ gap: 2 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Explore ${place.label}`}
                  onPress={() => onSelectPlace(place)}
                  style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, borderRadius: 13 }}
                >
                  <MapPin size={19} color={colors.green} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{place.label}</Text>
                    <Text numberOfLines={1} style={styles.muted}>Beacon place</Text>
                  </View>
                </Pressable>
                <Button title={`Use ${place.label} for a new Beacon`} secondary compact onPress={() => onChoosePlaceForNewBeacon(place)} />
              </View>
            ))}
          </SearchSection>
        )}

        {!term && recentQueries.length ? (
          <SearchSection title="Recent searches">
            {recentQueries.map((recent) => (
              <Pressable key={recent.toLocaleLowerCase()} accessibilityRole="button" accessibilityLabel={`Search for ${recent}`} onPress={() => onSelectRecent(recent)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, borderRadius: 13 }}>
                <Clock3 size={17} color={colors.muted} />
                <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{recent}</Text>
                <Search size={15} color={colors.muted} />
              </Pressable>
            ))}
          </SearchSection>
        ) : null}

        {term && !beacons.length && !people.length && !places.length ? (
          <Text style={[styles.muted, { paddingVertical: 8 }]}>No matching Beacons, people or places yet.</Text>
        ) : null}
        <Button title="Choose a point on the map" secondary onPress={onStartPickingLocation} />
      </ScrollView>
    </View>
  );
}
