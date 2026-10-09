import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { friendIds } from "@/src/shared/domain";
import { startDeviceLocation, stopDeviceLocation } from "@/src/platform/device";
import { Action, Button, Chips, Empty, Screen, Txt, useTheme } from "@/src/shared/ui";
import { locationShareExpiry, MAX_LOCATION_SHARE_MS, type LocationShareDuration } from "@/src/features/maps/sessionHelpers";
export default function LocationScreen() {
  const { styles, colors } = useTheme();

  const { data, userId, act, demo } = useBeacon(),
    params = useLocalSearchParams<{ extend?: string }>(),
    [selected, setSelected] = useState<string[]>(() => params.extend === "yes" ? [...(data.location_recipients ?? [])] : []),
    [duration, setDuration] = useState<LocationShareDuration>("15 minutes"),
    [activity, setActivity] = useState(""),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const friends = friendIds(data, userId!),
    session = data.locations.find(
      (l) => l.owner_id === userId && Date.parse(l.expires_at) > now,
    ),
    extensionMode = params.extend === "yes" && !!session,
    extensionAtLimit = extensionMode && Date.parse(session!.expires_at) >= now + MAX_LOCATION_SHARE_MS,
    eligible = data.activities.filter(
      (a) =>
        a.status === "scheduled" &&
        Date.parse(a.ends_at) > (extensionMode ? Date.parse(session!.expires_at) : now) &&
        (a.owner_id === userId ||
          data.rsvps.some(
            (r) =>
              r.activity_id === a.id &&
              r.user_id === userId &&
              r.status === "going",
          )),
    );
  return (
    <Screen
      title="Share a little of your now."
      eyebrow="TEMPORARY LOCATION"
      create={false}
    >
      <View style={styles.hero}>
        <Text style={[styles.h2, { color: "white" }]}>
          {session
            ? "Your location sharing is on."
            : "Your location sharing is off."}
        </Text>
        <Text style={{ color: "#C7D8CC", lineHeight: 23 }}>
          Only selected, accepted friends can see you. No location history is
          kept. Sharing ends automatically.
        </Text>
        {session && (
          <>
            <Txt muted>
              Sharing with:{" "}
              {(data.location_recipients ?? [])
                .map(
                  (id) =>
                    data.profiles.find((p) => p.id === id)?.name ??
                    "Selected friend",
                )
                .join(", ")}
            </Txt>
            <Text style={{ color: colors.lime }}>
              Ends {new Date(session.expires_at).toLocaleTimeString()}
            </Text>
            <Txt muted>
              {session.updated_at
                ? "Last update: " +
                  new Date(session.updated_at).toLocaleTimeString()
                : "Waiting for a device update"}
            </Txt>
            <Action
              title="Stop sharing now"
              secondary
              run={async () => {
                await stopDeviceLocation();
                await act("stop_location");
              }}
            />
          </>
        )}
      </View>
        <Text style={styles.h2}>{extensionMode ? "Confirm who can still see you" : "Choose your people"}</Text>
      {extensionMode ? (
        <Txt muted>
          {extensionAtLimit
            ? "This session has reached the four-hour limit from now and cannot be extended yet."
            : "Your current recipients are selected. You can update them. The chosen duration is added to the current expiry, up to four hours from now."}
        </Txt>
      ) : null}
      {data.profiles
        .filter((p) => friends.includes(p.id))
        .map((p) => (
          <Button
            key={p.id}
            secondary={!selected.includes(p.id)}
            title={(selected.includes(p.id) ? "✓ " : "") + p.name}
            onPress={() =>
              setSelected((prev) =>
                prev.includes(p.id)
                  ? prev.filter((id) => id !== p.id)
                  : [...prev, p.id],
              )
            }
          />
        ))}
      {!friends.length && (
        <Empty
          title="Friends first."
          body="Add and accept a friend before sharing your live location."
        />
      )}
      <Text style={styles.h2}>For a little while</Text>
      <Chips
        options={["15 minutes", "1 hour", "Until activity ends"]}
        value={duration}
        onChange={setDuration}
      />
      {duration === "Until activity ends" && (
        <>
          <Txt muted>
            {extensionMode ? "Extends to the earlier of the activity end and four hours from now." : "Sharing lasts until the earlier of the activity end and four hours from now."}
          </Txt>
          {eligible.map((a) => (
            <Button
              key={a.id}
              secondary={activity !== a.id}
              title={a.title}
              onPress={() => setActivity(a.id)}
            />
          ))}
        </>
      )}
      <Action
        title={extensionAtLimit ? "Sharing limit reached" : extensionMode ? "Extend sharing" : session ? "Replace sharing session" : "Start temporary sharing"}
        disabled={extensionAtLimit}
        run={async () => {
          if (demo)
            throw new Error(
              "The demo never shares your device location. Use a real account and mobile development build.",
            );
          if (!selected.length) throw new Error("Select at least one friend.");
          const selectedActivity = duration === "Until activity ends"
            ? eligible.find((candidate) => candidate.id === activity)
            : undefined;
          if (duration === "Until activity ends" && !selectedActivity)
            throw new Error("Choose an activity.");
          const end = locationShareExpiry(
            duration,
            Date.now(),
            extensionMode ? session?.expires_at : undefined,
            selectedActivity?.ends_at,
          );
          if (!end) {
            throw new Error(duration === "Until activity ends"
              ? extensionMode
                ? "Choose an activity that ends after your current expiry."
                : "Choose an activity that ends within four hours from now."
              : "The session has reached the four-hour limit from now.");
          }
          const result = await act("start_location", {
            recipients: selected,
            expires_at: new Date(end).toISOString(),
          });
          try {
            await startDeviceLocation({
              id: String(result.id),
              expires_at: String(result.expires_at),
            });
          } catch (error) {
            await act("stop_location");
            throw error;
          }
        }}
      />
      <Txt muted>
        Location updates depend on your phone’s permissions, battery settings,
        and app state. Old positions disappear after five minutes. If you are
        offline, stopping turns off device updates immediately; reconnect to
        revoke server access before the session expires.
      </Txt>
    </Screen>
  );
}
