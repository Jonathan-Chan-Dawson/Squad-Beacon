import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { featuredActivity, friendIds } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ActivityCard } from "@/src/features/beacons/ActivityCard";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import type { AspirationGoal } from "@/src/features/profile/ProfileSurvey";
import {
  Action,
  Button,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
export default function Person() {
  const { styles } = useTheme();

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
  const canViewFullProfile = canViewProfile(data, person, userId);
  if (!canViewFullProfile) {
    const isFriend = !!userId && friendIds(data, userId).includes(id);
    return (
      <Screen title={person.name} eyebrow="PROFILE DETAILS PRIVATE" create={false}>
        <View style={styles.card}>
          <ProfileAvatar profile={person} size={76} />
          <Text style={styles.title}>{person.name}</Text>
          <Txt muted>@{person.username}</Txt>
          <Txt muted>
            They keep their profile details private. You can still connect directly.
          </Txt>
        </View>
        {id !== userId &&
          (isFriend ? (
            <Button
              title="Message"
              onPress={() =>
                router.push({ pathname: "/messages/[id]", params: { id } })
              }
            />
          ) : (
            <Action
              title="Add friend"
              run={() => act("friend_request", { username: person.username })}
            />
          ))}
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
            {isFriend && (
              <Action
                secondary
                title="Remove friendship"
                run={() => act("remove_friend", { user_id: id })}
              />
            )}
          </>
        )}
        <Button secondary title="Back" onPress={() => router.back()} />
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
          title={`Block ${person.name}?`}
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
  const featured = featuredActivity(person, data.activities);
  return (
    <Screen title={person.name} eyebrow={"@" + person.username} create={false}>
      <View style={styles.card}>
        <ProfileAvatar profile={person} size={76} />
        <Txt>{person.bio}</Txt>
        {!!person.identity_tags?.length && (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>IDENTITY</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {person.identity_tags.slice(0, 6).map((tag) => (
                <Text key={tag} style={[styles.chip, styles.chipText]}>
                  {tag}
                </Text>
              ))}
              {person.identity_tags.length > 6 && (
                <Txt muted>+{person.identity_tags.length - 6} more</Txt>
              )}
            </View>
          </View>
        )}
        {!!person.interests.length && (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>INTERESTS</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {person.interests.slice(0, 8).map((interest) => (
                <Text key={interest} style={[styles.chip, styles.chipText]}>
                  {interest}
                </Text>
              ))}
              {person.interests.length > 8 && (
                <Txt muted>+{person.interests.length - 8} more</Txt>
              )}
            </View>
          </View>
        )}
      </View>
      {featured && <ActivityCard activity={featured} />}
      {!!person.aspiration_goals?.length && (
        <View style={styles.card}>
          <Text style={styles.h2}>Goals I’m making time for</Text>
          {person.aspiration_goals.map((aspiration: AspirationGoal) => {
            return (
              <View key={aspiration.id} style={{ gap: 4 }}>
                <Text style={styles.body}>
                  {aspiration.title} · {aspiration.category}
                </Text>
                <Txt muted>
                  Aiming for {aspiration.target_per_week} linked beacons per week
                </Txt>
              </View>
            );
          })}
        </View>
      )}
      {[
        person.home,
        person.birthday_note,
        person.aspirations,
        person.personality,
        person.quote,
      ]
        .filter(Boolean)
        .map((text, i) => (
          <Txt key={i}>{text}</Txt>
        ))}
      {id !== userId &&
        (friendIds(data, userId!).includes(id) ? (
          <Button
            title="Message"
            onPress={() =>
              router.push({ pathname: "/messages/[id]", params: { id } })
            }
          />
        ) : (
          <Action
            title="Add friend"
            run={() => act("friend_request", { username: person.username })}
          />
        ))}
      <Text style={styles.h2}>Past beacons</Text>
      {data.activities
        .filter((a) => a.owner_id === id && a.status === "completed")
        .map((a) => (
          <ActivityCard key={a.id} activity={a} />
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
