import React, { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SlidersHorizontal, Radio, LocateFixed } from "lucide-react-native";
import BeaconMap from "@/src/features/maps/components/BeaconMap";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { MapTooltip } from "@/src/features/maps/MapTooltip";
import { MapPanel } from "@/src/features/maps/MapPanel";
import { usePreferences } from "@/src/shared/preferences";
import { themeNames } from "@/src/shared/themes";
import { AvatarToggle } from "@/src/features/profile/AvatarToggle";
import {
  Button,
  Chips,
  InboxButton,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { activityWhen, friendIds, locationIsFresh } from "@/src/shared/domain";
import { crew } from "@/src/shared/browsing";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import type { MapPointGroup } from "@/src/features/maps/cluster";
export default function MapScreen() {
  const { colors, styles } = useTheme();

  const { theme, setTheme, showAvatars } = usePreferences();
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
  const [planFilter, setPlanFilter] = useState("All plans");
  const [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [person, setPerson] = useState<string | null>(null),
    [expanded, setExpanded] = useState(false);
  const [cluster, setCluster] = useState<MapPointGroup | null>(null);
  const [expandedBeacon, setExpandedBeacon] = useState<string | null>(null);
  const processedRouteSelection = useRef<string | null>(null);
  const snapshotReady = !!userId && data.viewer_id === userId;
  useFocusEffect(
    useCallback(() => {
      if (!snapshotReady) return;
      const staleParams: { beacon?: undefined; person?: undefined } = {};
      if (person && !canViewProfile(data, person, userId)) {
        setPerson(null);
        setDetails(false);
        if (params.person === person) staleParams.person = undefined;
      }
      if (
        selected &&
        !data.activities.some((activity) => activity.id === selected)
      ) {
        setSelected(null);
        setDetails(false);
        if (params.beacon === selected) staleParams.beacon = undefined;
      }
      if (Object.keys(staleParams).length) router.setParams(staleParams);

      const routeSelection = JSON.stringify([
        userId,
        params.beacon ?? "",
        params.person ?? "",
      ]);
      if (processedRouteSelection.current === routeSelection) return;
      processedRouteSelection.current = routeSelection;
      const hasBeaconParam = params.beacon != null;
      const hasPersonParam = params.person != null;
      if (!hasBeaconParam && !hasPersonParam) return;

      const validBeacon =
        !!params.beacon &&
        data.activities.some((activity) => activity.id === params.beacon);
      const validPerson =
        !!params.person && canViewProfile(data, params.person, userId);
      if (validBeacon || validPerson) {
        setCluster(null);
        setExpandedBeacon(null);
        setDetails(false);
        setSelected(validBeacon ? params.beacon! : null);
        setPerson(validPerson ? params.person! : null);
        setExpanded(false);
      } else {
        if (params.beacon && selected === params.beacon) setSelected(null);
        if (params.person && person === params.person) setPerson(null);
      }

      const staleRouteParams: { beacon?: undefined; person?: undefined } = {};
      if (hasBeaconParam && !validBeacon) staleRouteParams.beacon = undefined;
      if (hasPersonParam && !validPerson) staleRouteParams.person = undefined;
      if (Object.keys(staleRouteParams).length)
        router.setParams(staleRouteParams);
    }, [
      data,
      params.beacon,
      params.person,
      person,
      selected,
      snapshotReady,
      userId,
    ]),
  );
  const friends = friendIds(data, userId!);
  function clearRouteSelection() {
    processedRouteSelection.current = JSON.stringify([
      userId,
      params.beacon ?? "",
      params.person ?? "",
    ]);
    router.setParams({ beacon: undefined, person: undefined });
  }
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
    .filter((a) => planFilter === "All plans" || a.plan_id === planFilter)
    .filter(
      (a) =>
        audience === "Everyone" ||
        (audience === "Friends"
          ? friends.includes(a.owner_id)
          : a.audience_id === audience),
    );
  const planFilterOptions = data.plans.map((plan) => {
    const sameTitle = data.plans.filter((other) => other.title === plan.title);
    const sameDate = sameTitle.filter(
      (other) => other.start_date === plan.start_date,
    );
    return {
      id: plan.id,
      label:
        sameTitle.length === 1
          ? plan.title
          : `${plan.title} · ${plan.start_date}${sameDate.length > 1 ? ` · ${plan.id.slice(0, 8)}` : ""}`,
    };
  });
  const focusedBeacon = data.activities.find((a) => a.id === selected);
  const focusedPlace = data.places.find((p) => p.activity_id === selected);
  const focusedPerson = data.locations.find(
    (l) =>
      l.owner_id === person &&
      locationIsFresh(l) &&
      canViewProfile(data, l.owner_id, userId!),
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
      (audience === "Everyone" ||
        (audience === "Friends"
          ? friends.includes(l.owner_id)
          : data.squad_members.some(
              (m) => m.user_id === l.owner_id && m.squad_id === audience,
            ))) &&
      canViewProfile(data, l.owner_id, userId!),
  );
  const visibleCluster = cluster
    ? {
        ...cluster,
        members: cluster.members.filter((member) => {
          if (member.kind === "person")
            return (
              showAvatars &&
              locations.some(
                (location) =>
                  location.owner_id === member.id.slice("person:".length) &&
                  locationIsFresh(location, new Date(now)),
              )
            );
          const id = member.id.slice("beacon:".length);
          return (
            activities.some((activity) => activity.id === id) &&
            data.places.some(
              (place) =>
                place.activity_id === id &&
                place.latitude != null &&
                place.longitude != null,
            )
          );
        }),
      }
    : null;
  const activeCluster =
    visibleCluster && visibleCluster.members.length > 1 ? visibleCluster : null;
  function chooseBeacon(id: string) {
    clearRouteSelection();
    setCluster(null);
    setExpandedBeacon(null);
    setDetails(false);
    setAnchor(null);
    setSelected(id);
    setPerson(null);
    setExpanded(false);
  }
  function choosePerson(id: string) {
    if (!canViewProfile(data, id, userId!)) return;
    clearRouteSelection();
    setCluster(null);
    setExpandedBeacon(null);
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
        onCluster={(nextCluster) => {
          clearRouteSelection();
          setDetails(false);
          setExpanded(false);
          setSelected(null);
          setPerson(null);
          setExpandedBeacon(null);
          setCluster(nextCluster);
        }}
        onMapTap={() => {
          clearRouteSelection();
          setDetails(false);
          setExpanded(false);
          setSelected(null);
          setPerson(null);
          setCluster(null);
          router.setParams({ beacon: undefined, person: undefined });
        }}
        onViewportChange={() => {
          setCluster(null);
          setExpandedBeacon(null);
        }}
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
            <Text style={styles.muted}>
              {activities.length} beacons · {data.plans.length} plans
            </Text>
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
              clearRouteSelection();
              setSelected(null);
              setPerson(null);
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
      {activeCluster && (
        <View
          testID="map-cluster-panel"
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 10,
            maxHeight: Math.min(height * 0.62, 500),
            backgroundColor: colors.white,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 24,
            padding: 14,
            gap: 8,
            boxShadow: "0 8px 28px #142e3033",
          }}
        >
          <View style={styles.between}>
            <View>
              <Text style={styles.label}>NEARBY</Text>
              <Text style={styles.h2}>
                {
                  activeCluster.members.filter(
                    (member) => member.kind === "beacon",
                  ).length
                }{" "}
                Beacons ·{" "}
                {
                  activeCluster.members.filter(
                    (member) => member.kind === "person",
                  ).length
                }{" "}
                People
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close map cluster"
              onPress={() => setCluster(null)}
              style={{ padding: 8 }}
            >
              <Text style={styles.label}>CLOSE</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {!!activeCluster.members.some(
              (member) => member.kind === "beacon",
            ) && (
              <>
                <Text style={styles.label}>BEACONS</Text>
                {activeCluster.members
                  .filter((member) => member.kind === "beacon")
                  .map((member) => {
                    const activity = data.activities.find(
                      (item) => item.id === member.id.slice("beacon:".length),
                    );
                    if (!activity) return null;
                    const isExpanded = expandedBeacon === activity.id;
                    const visibleGoing = crew(data, activity).filter(
                      ({ person: profile, status }) =>
                        (status === "Going" || status === "Hosting") &&
                        canViewProfile(data, profile, userId!),
                    );
                    return (
                      <View
                        key={member.id}
                        style={[styles.card, { padding: 10, gap: 8 }]}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} ${activity.title} in map cluster`}
                          accessibilityState={{ expanded: isExpanded }}
                          onPress={() =>
                            setExpandedBeacon(isExpanded ? null : activity.id)
                          }
                          style={styles.between}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.body}>{activity.title}</Text>
                            <Text style={styles.muted} numberOfLines={1}>
                              {activityWhen(activity)} ·{" "}
                              {data.places.find(
                                (place) => place.activity_id === activity.id,
                              )?.label || "Place to be decided"}
                            </Text>
                          </View>
                          <Text style={styles.label}>
                            {isExpanded ? "HIDE PEOPLE" : "PEOPLE"}
                          </Text>
                        </Pressable>
                        {isExpanded && (
                          <>
                            {visibleGoing.map(({ person: profile, status }) => (
                              <Pressable
                                key={profile.id}
                                accessibilityRole="button"
                                accessibilityLabel={`View ${profile.name} on map`}
                                onPress={() => {
                                  setCluster(null);
                                  choosePerson(profile.id);
                                }}
                                style={styles.row}
                              >
                                <ProfileAvatar profile={profile} size={30} />
                                <Text style={styles.body}>{profile.name}</Text>
                                <Text style={styles.muted}>{status}</Text>
                              </Pressable>
                            ))}
                            {!visibleGoing.length && (
                              <Txt muted>
                                No visible people have joined yet.
                              </Txt>
                            )}
                            <Button
                              title="Open Beacon"
                              secondary
                              onPress={() => {
                                setCluster(null);
                                chooseBeacon(activity.id);
                              }}
                            />
                          </>
                        )}
                      </View>
                    );
                  })}
              </>
            )}
            {!!activeCluster.members.some(
              (member) => member.kind === "person",
            ) && (
              <>
                <Text style={styles.label}>PEOPLE</Text>
                {activeCluster.members
                  .filter((member) => member.kind === "person")
                  .map((member) => {
                    const id = member.id.slice("person:".length);
                    const profile = data.profiles.find(
                      (candidate) => candidate.id === id,
                    );
                    if (!profile || !canViewProfile(data, profile, userId!))
                      return null;
                    const statusBeacon = data.activities.find(
                      (activity) =>
                        activity.owner_id === id &&
                        activity.status === "scheduled" &&
                        Date.parse(activity.starts_at) <= now &&
                        Date.parse(activity.ends_at) > now,
                    );
                    return (
                      <Pressable
                        key={member.id}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${profile.name} on map`}
                        onPress={() => {
                          setCluster(null);
                          choosePerson(id);
                        }}
                        style={[styles.row, styles.card, { padding: 8 }]}
                      >
                        <ProfileAvatar profile={profile} size={30} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.body}>{profile.name}</Text>
                          <Text style={styles.muted}>
                            {statusBeacon?.title ?? "Sharing location"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
              </>
            )}
          </ScrollView>
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
        <Text style={styles.h2}>Plan</Text>
        <Chips
          options={[
            "All plans",
            ...planFilterOptions.map((plan) => plan.label),
          ]}
          value={
            planFilterOptions.find((plan) => plan.id === planFilter)?.label ??
            "All plans"
          }
          onChange={(label) =>
            setPlanFilter(
              planFilterOptions.find((plan) => plan.label === label)?.id ??
                "All plans",
            )
          }
        />
        <Button
          title="Open plans"
          secondary
          onPress={() => router.push("/plans")}
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
        <Chips options={themeNames} value={theme} onChange={setTheme} />
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
