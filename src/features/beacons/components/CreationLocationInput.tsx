import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { MapPin } from "lucide-react-native";
import { Field, IconButton, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import {
  demoWorldwidePlaces,
  type WorldwidePlace,
} from "@/src/features/maps/placeSearch";
import { searchWorldwidePlaces } from "@/src/features/maps/searchWorldwidePlaces";

export function CreationLocationInput({
  value,
  selected,
  onChange,
  onChoose,
  onPickMap,
}: {
  value: string;
  selected: boolean;
  onChange: (value: string) => void;
  onChoose: (place: WorldwidePlace) => void;
  onPickMap: () => void;
}) {
  const { colors, styles } = useTheme();
  const { demo, userId } = useBeacon();
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<{
    query: string;
    rows: WorldwidePlace[];
    busy: boolean;
    error: string;
  }>({ query: "", rows: [], busy: false, error: "" });
  const provider = Platform.OS === "android" ? "google" : "osm";
  useEffect(() => {
    if (!focused || selected || value.trim().length < 3) return;
    let active = true;
    const timer = setTimeout(() => {
      setState({ query: value, rows: [], busy: true, error: "" });
      void (
        demo
          ? Promise.resolve(demoWorldwidePlaces(value))
          : searchWorldwidePlaces(value, provider)
      )
        .then((rows) => {
          if (active) setState({ query: value, rows, busy: false, error: "" });
        })
        .catch((error) => {
          if (active)
            setState({
              query: value,
              rows: [],
              busy: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Place search is unavailable. Choose a point on the map.",
            });
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, selected, demo, provider, userId, focused]);
  const visible =
    !selected && value.trim().length >= 3 && state.query === value;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Choose location (optional)"
            placeholder="Search a place or address"
            value={value}
            onFocus={() => setFocused(true)}
            onChangeText={(text) => {
              setFocused(true);
              onChange(text);
            }}
            maxLength={160}
          />
        </View>
        <View style={{ paddingBottom: 6 }}>
          <IconButton label="Choose location on Map" onPress={onPickMap}>
            <MapPin size={20} color={colors.primary} />
          </IconButton>
        </View>
      </View>
      {visible && state.busy && (
        <ActivityIndicator
          accessibilityLabel="Searching places"
          color={colors.primary}
        />
      )}
      {visible && state.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {state.error}
        </Text>
      ) : null}
      {visible && !state.busy && !state.error && !state.rows.length ? (
        <Text style={styles.muted}>
          No places found. Try another search or choose a point on the Map.
        </Text>
      ) : null}
      {visible && state.rows.length > 0 && (
        <View style={{ gap: 5 }}>
          <Text style={styles.muted}>
            {demo
              ? "Demo city examples. No search leaves your device."
              : provider === "google"
                ? "Google Maps"
                : "OpenStreetMap"}
          </Text>
          {state.rows.map((place) => (
            <View key={place.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choose ${place.label}`}
                onPress={() => onChoose(place)}
                style={{ minHeight: 48, paddingVertical: 6, gap: 2 }}
              >
                <Text style={styles.body}>{place.label}</Text>
                <Text style={styles.muted}>{place.address}</Text>
              </Pressable>
              {place.attributions.map((credit, index) => (
                <Text
                  key={index}
                  style={styles.muted}
                  onPress={
                    credit.uri
                      ? () => {
                          void Linking.openURL(credit.uri!).catch(() => {});
                        }
                      : undefined
                  }
                >
                  {credit.name}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
