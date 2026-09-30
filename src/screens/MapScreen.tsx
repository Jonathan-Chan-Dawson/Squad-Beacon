import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SlidersHorizontal, Radio, LocateFixed } from "lucide-react-native";
import BeaconMap from "@/components/BeaconMap";
import { useBeacon } from "../store";
import { useNow } from "../useNow";
import { InboxButton } from "../InboxButton";
import { MapTooltip } from "../MapTooltip";
import { MapPanel } from "../MapPanel";
import { usePreferences } from "../preferences";
import { AvatarToggle } from "../AvatarToggle";
import { Button, Chips, Sheet, Txt, useTheme } from "../ui";
import { friendIds, locationIsFresh } from "../domain";
export default function MapScreen() {
  const { colors, styles } = useTheme();

  const { theme, setTheme } = usePreferences();
  const { data, userId } = useBeacon();
  const params = useLocalSearchParams<{ beacon?: string; person?: string }>();
  const insets = useSafeAreaInsets(),
    { height, width } = useWindowDimensions(),
    now = useNow();
  const [details, setDetails] = useState(false),
    [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [time, setTime] = useState("All"),
    [audience, setAudience] = useState("Everyone"),
    [category, setCategory] = useState("All categories");
  const [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [person, setPerson] = useState<string | null>(null),
    [expanded, setExpanded] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (params.beacon) {
        setDetails(false);
        setSelected(params.beacon);
        setPerson(null);
        setExpanded(false);
      }
      if (params.person) {
        setPerson(params.person);
        if (!params.beacon) setSelected(null);
      }
    }, [params.beacon, params.person]),
  );
  const friends = friendIds(data, userId!);
  const activities = data.activities
    .filter((a) => a.status === "scheduled" && Date.parse(a.ends_at) > now)
    .filter(
      (a) =>
        time === "All" ||
        (time === "Now"
          ? Date.parse(a.starts_at) <= now
          : Date.parse(a.starts_at) > now),
    )
    .filter((a) => category === "All categories" || category === a.category)
    .filter(
      (a) =>
        audience === "Everyone" ||
        (audience === "Friends"
          ? friends.includes(a.owner_id)
          : a.audience_id === audience),
    );
  const focusedBeacon = data.activities.find((a) => a.id === selected);
  const focusedPlace = data.places.find((p) => p.activity_id === selected);
  const focusedPerson = data.locations.find(
    (l) => l.owner_id === person && locationIsFresh(l),
  );
  const point = selected ? focusedPlace : focusedPerson;
  const focused =
    point?.latitude != null && point?.longitude != null
      ? { latitude: point.latitude, longitude: point.longitude }
      : null;
  const panel = !!selected || !!person;
  const panelHeight = Math.min(480, height * 0.53);
  const locations = data.locations.filter(
    (l) =>
      audience === "Everyone" ||
      (audience === "Friends"
        ? friends.includes(l.owner_id)
        : data.squad_members.some(
            (m) => m.user_id === l.owner_id && m.squad_id === audience,
          )),
  );
  function chooseBeacon(id: string) {
    setDetails(false);
    setAnchor(null);
    setSelected(id);
    setPerson(null);
    setExpanded(false);
  }
  function choosePerson(id: string) {
    setDetails(false);
    setAnchor(null);
    setPerson(id);
    setExpanded(false);
    const beacon =
      activities.find((a) => a.owner_id === id && a.mode === "solo") ??
      activities.find((a) =>
        data.rsvps.some(
          (r) =>
            r.activity_id === a.id && r.user_id === id && r.status === "going",
        ),
      ) ??
      activities.find((a) => a.owner_id === id);
    setSelected(beacon?.id ?? null);
  }
  return (
    <KeyboardAvoidingView
      testID="full-map-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <BeaconMap
        fullScreen
        controlsTop={insets.top + 76}
        panelHeight={panel && details ? panelHeight : 20}
        onAnchor={setAnchor}
        focused={focused}
        activities={
          focusedBeacon && !activities.some((a) => a.id === selected)
            ? [...activities, focusedBeacon]
            : activities
        }
        places={data.places}
        locations={locations}
        profiles={data.profiles}
        onActivity={chooseBeacon}
        onPerson={choosePerson}
      />
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + 12,
          left: 16,
          right: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View beacons"
            onPress={() => router.push("/activities")}
            style={{
              backgroundColor: colors.white + "ED",
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={styles.h2}>Map</Text>
            <Text style={styles.muted}>{activities.length} beacons</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Map filters"
          onPress={() => setFilters(true)}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
            elevation: 3,
          }}
        >
          <SlidersHorizontal size={20} color={colors.ink} />
        </Pressable>
        <InboxButton />
      </View>
      {!panel && (
        <View
          style={{
            position: "absolute",
            bottom: 24,
            left: 16,
            right: 16,
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          {!activities.length && (
            <View
              style={[styles.card, { backgroundColor: colors.white + "ED" }]}
            >
              <Text style={styles.h2}>Room for your next plan.</Text>
              <Txt muted>Change your filters or light up a beacon.</Txt>
              <Button
                title="Create a beacon"
                onPress={() => router.push("/create")}
              />
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage location sharing"
            onPress={() => router.push("/location")}
            style={[
              styles.row,
              { padding: 12, borderRadius: 22, backgroundColor: colors.white },
            ]}
          >
            <LocateFixed size={18} color={colors.green} />
            <Text style={styles.label}>Location sharing</Text>
          </Pressable>
          {data.activities.find(
            (a) =>
              a.status === "scheduled" &&
              Date.parse(a.ends_at) > now &&
              (a.owner_id === userId ||
                data.rsvps.some(
                  (r) =>
                    r.activity_id === a.id &&
                    r.user_id === userId &&
                    r.status === "going",
                )),
          ) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Focus my beacon"
              onPress={() =>
                chooseBeacon(
                  data.activities.find(
                    (a) =>
                      a.status === "scheduled" &&
                      Date.parse(a.ends_at) > now &&
                      (a.owner_id === userId ||
                        data.rsvps.some(
                          (r) =>
                            r.activity_id === a.id &&
                            r.user_id === userId &&
                            r.status === "going",
                        )),
                  )!.id,
                )
              }
              style={[
                styles.row,
                { padding: 12, borderRadius: 22, backgroundColor: colors.lime },
              ]}
            >
              <Radio size={18} color={colors.green} />
              <Text style={styles.label}>My beacon</Text>
            </Pressable>
          )}
        </View>
      )}
      {panel && !details && (
        <View
          testID="map-tooltip"
          style={{
            position: "absolute",
            width: Math.min(width - 88, 310),
            left: Math.max(
              12,
              Math.min(
                width - Math.min(width - 88, 310) - 70,
                (anchor?.x ?? width / 2) - Math.min(width - 88, 310) / 2,
              ),
            ),
            top: Math.max(
              insets.top + 85,
              Math.min(height - 360, (anchor?.y ?? height * 0.32) + 22),
            ),
          }}
        >
          <MapTooltip
            beaconId={selected}
            personId={person}
            pinned={!!focused}
            onDetails={() => {
              setDetails(true);
              setExpanded(false);
            }}
            onClose={() => {
              setSelected(null);
              setPerson(null);
              router.setParams({ beacon: undefined, person: undefined });
            }}
          />
        </View>
      )}
      {panel && details && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            ...(expanded ? { top: insets.top + 76 } : { height: panelHeight }),
          }}
        >
          <MapPanel
            key={`${selected}:${person}`}
            beaconId={selected}
            personId={person}
            onBeacon={chooseBeacon}
            expanded={expanded}
            onExpand={setExpanded}
            onClose={() => {
              setDetails(false);
              setExpanded(false);
            }}
          />
        </View>
      )}
      <Sheet
        title="Your kind of map"
        visible={filters}
        onClose={() => setFilters(false)}
      >
        <Chips
          options={["All", "Now", "Upcoming"]}
          value={time}
          onChange={setTime}
        />
        <Chips
          options={[
            "All categories",
            "Fitness",
            "Study",
            "Gaming",
            "Creative",
            "Social",
            "Other",
          ]}
          value={category}
          onChange={setCategory}
        />
        <Chips
          options={["Everyone", "Friends"]}
          value={audience}
          onChange={setAudience}
        />
        {data.squads.map((s) => (
          <Button
            key={s.id}
            title={s.name}
            secondary={audience !== s.id}
            onPress={() => setAudience(s.id)}
          />
        ))}
        <Text style={styles.h2}>Map mood</Text>
        <Chips
          options={["Mint", "Sunset", "Midnight"] as const}
          value={theme}
          onChange={setTheme}
        />
        <AvatarToggle />
        <Txt muted>
          Pins are meeting places. Avatars appear only for fresh locations
          shared with you.
        </Txt>
        <Button title="Done" onPress={() => setFilters(false)} />
      </Sheet>
    </KeyboardAvoidingView>
  );
}
