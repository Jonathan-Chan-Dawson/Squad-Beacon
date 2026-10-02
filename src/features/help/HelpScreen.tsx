import React from "react";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { Text, View } from "react-native";
import { Button, Screen, Txt, useTheme } from "@/src/shared/ui";

export default function HelpScreen() {
  const { styles } = useTheme();

  return (
    <Screen
      title="A friendly field guide"
      eyebrow="HELP & TUTORIAL"
      create={false}
    >
      <Txt muted>
        A few quick pointers for making plans, finding your people, and staying
        in control of what you share.
      </Txt>

      <View style={styles.card}>
        <Text style={styles.h2}>1. Find your people</Text>
        <Txt>
          Start with a profile, then connect with people you know. Accepted
          friends can see friend-only beacons and appear in your friends list.
          Invitations are in Squads and in your inbox.
        </Txt>
        <Button
          title="Find friends"
          onPress={() => router.push("/find-friends" as Href)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>2. Friends, squads & private lists</Text>
        <Txt>
          Friends are your one-to-one connections. Squads keep a crew, its
          members, and its shared plans together. Private lists are smaller,
          hand-picked circles for sharing a beacon with just the people you
          choose.
        </Txt>
        <Button
          title="Open friends & squads"
          secondary
          onPress={() => router.push("/(tabs)/squads" as Href)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>3. Make a beacon</Text>
        <Txt>
          A beacon is a plan people can join: add the when and what, then choose
          friends, a squad, a private list, or just yourself as its audience.
          Invitees can RSVP so everyone knows who is in.
        </Txt>
        <Button
          title="Create a beacon"
          onPress={() =>
            router.push({ pathname: "/create", params: { kind: "beacon" } })
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>4. Map, RSVPs & messages</Text>
        <Txt>
          The map is the home for nearby shared plans. Open a beacon to see its
          details and RSVP. Use the inbox for updates and direct conversations;
          messages also live on a friend’s profile.
        </Txt>
        <Button
          title="Open the map"
          secondary
          onPress={() => router.push("/(tabs)" as Href)}
        />
        <Button
          title="Open your inbox"
          secondary
          onPress={() =>
            router.push({ pathname: "/(tabs)", params: { inbox: "yes" } })
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>5. Privacy & location</Text>
        <Txt>
          Your location is off unless you explicitly start sharing it for a
          session. Choose an audience for each beacon, and stop location sharing
          whenever you like from Profile. Squad Beacon is not an emergency or
          safety-monitoring service.
        </Txt>
        <Button
          title="Manage temporary location"
          secondary
          onPress={() => router.push("/location" as Href)}
        />
        <Button
          title="Privacy, safety & support"
          secondary
          onPress={() => router.push("/legal" as Href)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>6. Optional iOS widgets</Text>
        <Txt>
          Add friend status or a circle summary to your Home Screen from Widget
          Studio. Widgets are off until you opt in and start discreet. They need
          an iOS development build or installed app; they are not available in
          Expo Go, Android, or web. Lock Screen summaries always stay discreet.
        </Txt>
        <Button
          title="Open Widget Studio"
          onPress={() => router.push("/widgets" as Href)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>7. Missing an update?</Text>
        <Txt>
          Reopen the app while online to refresh your plans and inbox. If push
          alerts are missing, check your device’s notification settings and
          enable them from Profile. This guide will never ask for notification
          permission. For account, privacy, or safety questions, use the support
          details in Privacy, safety & support.
        </Txt>
        <Button
          title="Open Profile settings"
          secondary
          onPress={() => router.push("/(tabs)/profile" as Href)}
        />
        <Button
          title="Contact support & read policies"
          secondary
          onPress={() => router.push("/legal" as Href)}
        />
      </View>
    </Screen>
  );
}
