import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useBeacon } from "@/src/store";
import { friendIds } from "@/src/domain";
import { startDeviceLocation, stopDeviceLocation } from "@/src/device";
import {
  Action,
  Button,
  Chips,
  Empty,
  Screen,
  Txt,
  colors,
  styles,
} from "@/src/ui";
export default function LocationScreen() {
  const { data, userId, act, demo } = useBeacon(),
    [selected, setSelected] = useState<string[]>([]),
    [duration, setDuration] = useState("15 minutes"),
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
    eligible = data.activities.filter(
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
      <Text style={styles.h2}>Choose your people</Text>
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
            Maximum four hours. Choose a current or upcoming activity.
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
        title={session ? "Replace sharing session" : "Start temporary sharing"}
        run={async () => {
          if (demo)
            throw new Error(
              "The demo never shares your device location. Use a real account and mobile development build.",
            );
          if (!selected.length) throw new Error("Select at least one friend.");
          let end = Date.now() + (duration === "15 minutes" ? 15 : 60) * 60000;
          if (duration === "Until activity ends") {
            const a = eligible.find((a) => a.id === activity);
            if (!a) throw new Error("Choose an activity.");
            end = Math.min(Date.parse(a.ends_at), Date.now() + 4 * 3600000);
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
