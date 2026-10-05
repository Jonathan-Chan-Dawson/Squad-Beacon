import React, { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { Button, useTheme } from "@/src/shared/ui";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { usePreferences } from "@/src/shared/preferences";
import { searchWorldwidePlaces } from "./searchWorldwidePlaces";
import type { WorldwidePlace } from "./placeSearch";

export function WorldwidePlaceSearch({
  query,
  onChoose,
}: {
  query: string;
  // Only supply this callback where the map uses Google Maps.
  onChoose?: (place: WorldwidePlace) => void;
}) {
  const { colors, styles } = useTheme();
  const { resolvedAppearance } = usePreferences();
  const [places, setPlaces] = useState<WorldwidePlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [resultQuery, setResultQuery] = useState("");
  const current = resultQuery === query;
  const revision = useRef({ value: 0 });
  useEffect(() => {
    const state = revision.current;
    state.value++;
    return () => {
      state.value++;
    };
  }, [query]);
  return (
    <View style={{ gap: 8 }}>
      <Button
        compact
        secondary
        title={
          current && busy ? "Searching places…" : "Search worldwide places"
        }
        disabled={(current && busy) || query.trim().length < 3}
        onPress={() => {
          const requestRevision = ++revision.current.value;
          setResultQuery(query);
          setPlaces([]);
          setBusy(true);
          setError("");
          setSearched(false);
          void searchWorldwidePlaces(query)
            .then((result) => {
              if (requestRevision !== revision.current.value) return;
              setPlaces(result);
              setSearched(true);
            })
            .catch((failure: unknown) => {
              if (requestRevision === revision.current.value)
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Place search failed.",
                );
            })
            .finally(() => {
              if (requestRevision === revision.current.value) setBusy(false);
            });
        }}
      />
      <Text style={styles.label}>
        Only your typed place search is sent to Google. No live location.
      </Text>
      {current && error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {current && searched && !places.length ? (
        <Text style={styles.muted}>
          No places found. Try a city and country.
        </Text>
      ) : null}
      {current && places.length ? (
        <View style={[styles.card, { padding: 12, gap: 10 }]}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "400",
              color: resolvedAppearance === "dark" ? "#FFFFFF" : "#1F1F1F",
            }}
          >
            Google Maps
          </Text>
          {places.map((place) => (
            <View key={place.id} style={{ gap: 4 }}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={`${onChoose ? "Explore" : "Open in Google Maps"} ${place.label}`}
                onPress={() => {
                  if (onChoose) onChoose(place);
                  else if (place.googleMapsUri)
                    void Linking.openURL(place.googleMapsUri).catch(() =>
                      setError("Could not open Google Maps."),
                    );
                }}
                disabled={!onChoose && !place.googleMapsUri}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 48,
                  gap: 8,
                }}
              >
                <MapPin size={18} color={colors.green} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.body, { fontWeight: "700" }]}>
                    {place.label}
                  </Text>
                  <Text style={styles.muted}>{place.address}</Text>
                </View>
              </MotionPressable>
              {place.attributions.map((attribution, index) => (
                <Text
                  key={`${attribution.name}-${index}`}
                  style={styles.label}
                  onPress={
                    attribution.uri
                      ? () => {
                          void Linking.openURL(attribution.uri!).catch(() =>
                            setError("Could not open attribution."),
                          );
                        }
                      : undefined
                  }
                >
                  {attribution.name}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
