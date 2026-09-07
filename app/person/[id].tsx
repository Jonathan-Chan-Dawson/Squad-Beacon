import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/store";
import { featuredActivity, habitStats } from "@/src/domain";
import { ActivityCard } from "@/src/ActivityCard";
import { ProfileAvatar } from "@/src/ProfileAvatar";
import {
  Action,
  Button,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  styles,
} from "@/src/ui";
export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { data, act, userId } = useBeacon(),
    person = data.profiles.find((p) => p.id === id),
    [report, setReport] = useState(false),
    [reason, setReason] = useState(""),
    [block, setBlock] = useState(false);
  if (!person)
    return (
      <Screen title="Profile unavailable" eyebrow="YOUR PEOPLE" create={false}>
        <Empty
          title="This profile is private."
          body="Connect through an accepted friendship or a shared squad."
        />
        <Button
          title="Back to squads"
          onPress={() => router.replace("/(tabs)/squads")}
        />
      </Screen>
    );
  const featured = featuredActivity(person, data.activities);
  return (
    <Screen title={person.name} eyebrow={"@" + person.username} create={false}>
      <View style={styles.card}>
        <ProfileAvatar profile={person} size={76} />
        <Txt>{person.bio}</Txt>
        <Txt muted>{person.interests.join(" · ")}</Txt>
      </View>
      {featured && <ActivityCard activity={featured} />}
      <Text style={styles.h2}>Working toward</Text>
      {data.goals
        .filter((g) => g.owner_id === id)
        .map((g) => (
          <View style={styles.card} key={g.id}>
            <Text style={styles.h2}>{g.title}</Text>
            <Txt muted>{g.description}</Txt>
            <Txt>{g.progress}%</Txt>
          </View>
        ))}
      <Text style={styles.h2}>Building a rhythm</Text>
      {data.habits
        .filter((h) => h.owner_id === id)
        .map((h) => (
          <View style={styles.card} key={h.id}>
            <Txt>{h.title}</Txt>
            <Txt muted>
              {habitStats(h, data.checkins).streak}{" "}
              {habitStats(h, data.checkins).unit} streak
            </Txt>
          </View>
        ))}
      <Txt muted>Only information shared with you appears here.</Txt>
      {id !== userId && (
        <>
          <Button
            secondary
            title="Report account"
            onPress={() => setReport(true)}
          />
          <Button
            secondary
            title="Block account"
            onPress={() => setBlock(true)}
          />
          <Action
            secondary
            title="Remove friendship"
            run={() => act("remove_friend", { user_id: id })}
          />
        </>
      )}
      <Sheet
        title="Report account"
        visible={report}
        onClose={() => setReport(false)}
      >
        <Field
          label="What happened?"
          value={reason}
          onChangeText={setReason}
          multiline
        />
        <Action
          title="Send report"
          run={async () => {
            if (reason.trim().length < 5)
              throw new Error("Please include a little more detail.");
            await act("report", { id, reason });
            setReport(false);
          }}
        />
      </Sheet>
      <Sheet
        title={"Block " + person.name + "?"}
        visible={block}
        onClose={() => setBlock(false)}
      >
        <Txt>
          This ends your friendship and direct sharing. Their comments and
          location will be hidden, including in shared squads.
        </Txt>
        <Action
          title="Confirm block"
          run={async () => {
            await act("block", { id });
            setBlock(false);
            router.replace("/(tabs)/squads");
          }}
        />
      </Sheet>
    </Screen>
  );
}
