import React from "react";
import { isRunningInExpoGo } from "expo";
import { router } from "expo-router";
import { Platform, Text, View } from "react-native";
import { friendIds } from "@/src/shared/domain";
import { useBeacon } from "@/src/shared/store";
import { Button, Chips, Screen, Txt, useTheme } from "@/src/shared/ui";
import { useWidgetPreferences } from "@/src/features/widgets/preferences";
import type { CircleKey, CircleSource } from "@/src/features/widgets/types";

const circleKeys: CircleKey[] = ["circle1", "circle2", "circle3"];
const sourceOptions = [
  "Everyone",
  "One friend",
  "Squad",
  "Private list",
] as const;

export default function WidgetStudioScreen() {
  const { styles, colors } = useTheme();
  const { data, userId } = useBeacon();
  const { preferences, ready, error, updatePreferences } =
    useWidgetPreferences();
  const widgetsAvailable = Platform.OS === "ios" && !isRunningInExpoGo();
  const friends = friendIds(data, userId!)
    .map((id) => data.profiles.find((profile) => profile.id === id))
    .filter((profile) => !!profile)
    .sort((a, b) => a.name.localeCompare(b.name));
  const squads = data.squads.filter((squad) =>
    data.squad_members.some(
      (member) => member.squad_id === squad.id && member.user_id === userId,
    ),
  );
  const lists = data.lists.filter((list) => list.owner_id === userId);

  function setCircle(key: CircleKey, source: CircleSource) {
    updatePreferences({
      circles: { ...preferences.circles, [key]: source },
    });
  }
  function sourceType(source: CircleSource) {
    return source.kind === "all"
      ? "Everyone"
      : source.kind === "friend"
        ? "One friend"
        : source.kind === "squad"
          ? "Squad"
          : "Private list";
  }

  return (
    <Screen
      title="Widget Studio"
      eyebrow="Make your home screen yours"
      create={false}
    >
      {!widgetsAvailable ? (
        <View style={styles.card}>
          <Text style={styles.h2}>
            {Platform.OS === "ios"
              ? "Widgets are not available in Expo Go"
              : "Widgets are available on iOS"}
          </Text>
          <Txt muted>
            {Platform.OS === "ios"
              ? "Use a development build or installed iOS app to configure circles and widget privacy. Expo Go cannot install the widget extension."
              : "Use a development build or installed iOS app to configure circles and widget privacy. Widgets are not available on Android or web."}
          </Txt>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>A small window into your people</Text>
            <Txt muted>
              Widgets start Off and Discreet. Turn them On to send friend status
              to this device. Friends Now can show all accepted friends or one
              circle; Circle Beacons follows one of your three circles.
            </Txt>
            <Txt muted>
              Circles can be all accepted friends, one accepted friend, a squad
              (shown to accepted friends in it), or a private list (also
              intersected with accepted friends).
            </Txt>
          </View>

          {circleKeys.map((key, index) => {
            const source = preferences.circles[key];
            const type = sourceType(source);
            const entities =
              type === "One friend"
                ? friends.map((profile) => ({
                    id: profile.id,
                    label: `${profile.name} · @${profile.username}`,
                  }))
                : type === "Squad"
                  ? squads.map((squad) => ({ id: squad.id, label: squad.name }))
                  : type === "Private list"
                    ? lists.map((list) => ({ id: list.id, label: list.name }))
                    : [];
            const selected = entities.find(
              (entity) =>
                entity.id === (source.kind === "all" ? "" : source.id),
            );
            const entityLabels = entities.map((entity) => entity.label);
            const selectedLabel = selected?.label ?? entityLabels[0] ?? "";
            return (
              <View key={key} style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h2}>Circle {index + 1}</Text>
                    <Txt muted>
                      {type === "Everyone"
                        ? "All accepted friends"
                        : (selected?.label ?? `Choose a ${type.toLowerCase()}`)}
                    </Txt>
                  </View>
                  <Text style={[styles.label, { color: colors.green }]}>
                    {key.toUpperCase()}
                  </Text>
                </View>
                <Chips
                  options={sourceOptions}
                  value={type}
                  onChange={(value) => {
                    if (value === "Everyone") setCircle(key, { kind: "all" });
                    else if (value === "One friend")
                      setCircle(key, {
                        kind: "friend",
                        id: friends[0]?.id ?? "",
                      });
                    else if (value === "Squad")
                      setCircle(key, {
                        kind: "squad",
                        id: squads[0]?.id ?? "",
                      });
                    else
                      setCircle(key, { kind: "list", id: lists[0]?.id ?? "" });
                  }}
                />
                {entities.length > 0 && (
                  <>
                    <Txt muted>
                      {type === "One friend"
                        ? "Choose a friend"
                        : type === "Squad"
                          ? "Choose a squad"
                          : "Choose a private list"}
                    </Txt>
                    <Chips
                      options={entityLabels}
                      value={selectedLabel}
                      onChange={(label) => {
                        const entity = entities.find(
                          (item) => item.label === label,
                        );
                        if (entity && source.kind !== "all")
                          setCircle(key, { kind: source.kind, id: entity.id });
                      }}
                    />
                  </>
                )}
                {type !== "Everyone" && entities.length === 0 && (
                  <Txt muted>
                    {type === "One friend"
                      ? "Accept a friend request to use this circle."
                      : type === "Squad"
                        ? "Join or create a squad to use this circle."
                        : "Create a private list from Squads to use this circle."}
                  </Txt>
                )}
              </View>
            );
          })}

          <View style={styles.card}>
            <Text style={styles.h2}>Widget privacy</Text>
            <Txt muted>
              Discreet is the default and hides names and beacon titles. Choose
              Full details to show names and shared beacon titles on Home Screen
              widgets.
            </Txt>
            <Chips
              options={["Full details", "Discreet"] as const}
              value={
                preferences.privacy === "full" ? "Full details" : "Discreet"
              }
              onChange={(value) =>
                updatePreferences({
                  privacy: value === "Discreet" ? "discreet" : "full",
                })
              }
            />
            <Txt muted>
              Lock Screen widgets always use generic labels and counts, even
              when Full details is selected for Home Screen widgets.
            </Txt>
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>Widgets on this device</Text>
            <Txt muted>
              When off, Squad Beacon clears widget content from this device.
              Your circles stay saved.
            </Txt>
            <Chips
              options={["On", "Off"] as const}
              value={preferences.enabled ? "On" : "Off"}
              onChange={(value) =>
                updatePreferences({ enabled: value === "On" })
              }
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>Add a widget</Text>
            <Txt muted>
              Widgets are available on iOS in a development or installed app
              build; they do not appear in Expo Go. Long-press your Home Screen,
              tap Edit, then Add Widget and choose Squad Beacon. On iOS 17 or
              later, long-press a Friends Now widget and edit it to pick All
              Friends or Circle 1, 2, or 3. Circle Beacons lets you choose
              Circle 1, 2, or 3.
            </Txt>
          </View>
          {!ready && <Txt muted>Loading your saved circles…</Txt>}
          {!!error && <Txt muted>{error}</Txt>}
        </>
      )}
      <Button title="Back to profile" secondary onPress={() => router.back()} />
    </Screen>
  );
}
