import React from "react";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { Text, View } from "react-native";
import { Button, Screen, Txt, useTheme } from "@/src/shared/ui";

export default function HelpScreen() {
  const { styles } = useTheme();

  return (
    <Screen title="A friendly field guide" eyebrow="HELP & TUTORIAL" create={false}>
      <Txt muted>
        Quick pointers for finding your people, making plans, and choosing what
        to share.
      </Txt>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Now, Beacons & Starred Friends</Text>
        <Txt>
          The Map shows nearby shared Beacons. Activities separates what’s
          happening Now, what’s Upcoming, and what’s Past. Friends Now helps you
          see who is free; Starred Friends keeps selected people easy to find.
          Open a Beacon to see details and RSVP.
        </Txt>
        <Button
          title="Open Activities"
          secondary
          onPress={() => router.push("/(tabs)/activities" as Href)}
        />
        <Button title="Open the Map" onPress={() => router.push("/(tabs)" as Href)} />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Make a Beacon</Text>
        <Txt>
          Add the when and what, choose who can see it, then invite people so
          they can RSVP.
        </Txt>
        <Button
          title="Create a Beacon"
          onPress={() =>
            router.push({ pathname: "/create", params: { kind: "beacon" } })
          }
        />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Pings, Votes & Draws</Text>
        <Txt>
          A Ping checks interest in one suggested Beacon. A Vote compares
          options, and a Draw picks among them. Open a response to see the plan
          and take the next step.
        </Txt>
        <Button
          title="Open Pings & Decisions"
          onPress={() => router.push("/councils" as Href)}
        />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Beacon Plans & Routines</Text>
        <Txt>
          A Beacon Plan keeps related scheduled Beacons together as a multi-day
          itinerary. Join a Squad Beacon Plan separately from RSVP: each Beacon
          still has its own response. A Routine repeats a Beacon Plan on chosen
          weekdays, reusing its Beacon times and places for each new occurrence.
          Its server schedule must be deployed for automatic creation and reminder
          notices; device push delivery also depends on notification permission.
        </Txt>
        <Button
          title="Open Beacon Plans"
          secondary
          onPress={() => router.push("/plans" as Href)}
        />
        <Button
          title="Open Routines"
          secondary
          onPress={() => router.push("/routines" as Href)}
        />
        <Button
          title="Browse Beacon Plan templates"
          secondary
          onPress={() =>
            router.push({ pathname: "/plans", params: { templates: "yes" } })
          }
        />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Friends, Squads & Organizations</Text>
        <Txt>
          Friends are one-to-one connections. Squads bring a crew and its
          conversations together. Organizations provide a home for multiple
          Squads. Private Lists let you choose a smaller audience for a Beacon.
        </Txt>
        <Button
          title="Open Squads"
          secondary
          onPress={() => router.push("/(tabs)/squads" as Href)}
        />
        <Button
          title="Find friends"
          secondary
          onPress={() => router.push("/find-friends" as Href)}
        />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Sonar, privacy & Beacon tools</Text>
        <Txt>
          Sonar is optional temporary location sharing: choose accepted friends
          and a duration. It stays off otherwise, ends automatically, and does
          not keep location history. Stop a session from its location screen.
          Sonar is not an emergency or safety-monitoring service.
        </Txt>
        <Txt>
          Beacon tools such as Notes, checklists, and Memories appear when the
          Beacon host enables them. Beacon Memories remain linked to their
          source Beacon.
        </Txt>
        <Button
          title="Manage temporary location"
          secondary
          onPress={() => router.push("/location" as Href)}
        />
        <Button
          title="Profile visibility & settings"
          secondary
          onPress={() => router.push("/settings" as Href)}
        />
        <Button
          title="Privacy, safety & support"
          secondary
          onPress={() => router.push("/legal" as Href)}
        />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Widget Studio</Text>
        <Txt>
          Set up optional Friends Now or circle widgets. They start Off and
          Discreet and are available in an iOS development build or installed
          app, not Expo Go, Android, or web. Lock Screen widgets keep generic
          labels and counts.
        </Txt>
        <Button
          title="Open Widget Studio"
          onPress={() => router.push("/widgets" as Href)}
        />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Need help?</Text>
        <Txt>
          Push access and quiet hours are in Settings. For an account, privacy,
          or safety question, use the support details under Privacy, safety &
          support.
        </Txt>
        <Button
          title="Open Settings"
          secondary
          onPress={() => router.push("/settings" as Href)}
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
