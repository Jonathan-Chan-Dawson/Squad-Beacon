import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { UserPlus, FlaskConical } from "lucide-react-native";
import { useBeacon } from "@/src/store";
import { friendIds } from "@/src/domain";
import { ProfileAvatar } from "@/src/ProfileAvatar";
import { Action, Button, Field, Screen, Txt, useTheme } from "@/src/ui";
export default function FindFriends() {
  const { data, userId, demo, act } = useBeacon(),
    { colors, styles } = useTheme(),
    [query, setQuery] = useState("");
  const friends = friendIds(data, userId!);
  const people = data.profiles.filter(
    (p) =>
      p.id !== userId &&
      !friends.includes(p.id) &&
      `${p.name} ${p.username} ${p.interests.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <Screen
      title="Find your people"
      eyebrow="More hellos. More little adventures."
      create={false}
    >
      {demo ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.lime }]}>
            <View style={styles.row}>
              <FlaskConical color={colors.green} size={20} />
              <Text style={styles.h2}>Your testing neighborhood</Text>
            </View>
            <Txt muted>
              These people are fictional. Send a request, then simulate their
              reply to try the full friend loop.
            </Txt>
          </View>
          <Field
            label="Find test friends"
            placeholder="Name, username, or interest"
            value={query}
            onChangeText={setQuery}
          />
          {people.map((p) => {
            const pending = data.friendships.find(
              (f) =>
                f.status === "pending" &&
                (f.sender_id === p.id || f.recipient_id === p.id),
            );
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.row}>
                  <ProfileAvatar profile={p} size={68} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h2}>{p.name}</Text>
                    <Txt muted>@{p.username}</Txt>
                    <Txt muted>{p.interests.join(" / ")}</Txt>
                  </View>
                  <UserPlus color={colors.green} size={18} />
                </View>
                <Txt>{p.bio}</Txt>
                {pending ? (
                  <>
                    <Txt muted>Request sent. Waiting for their reply.</Txt>
                    <Action
                      title={`Simulate ${p.name.split(" ")[0]} accepting`}
                      secondary
                      run={() => act("accept_friend", { id: pending.id })}
                    />
                  </>
                ) : (
                  <Action
                    title={`Add ${p.name}`}
                    run={() => act("friend_request", { username: p.username })}
                  />
                )}
              </View>
            );
          })}
          {!people.length && (
            <Txt muted>
              No more matches. Try another interest, or find your new friends in
              Friends Now.
            </Txt>
          )}
        </>
      ) : (
        <>
          <Txt>
            Find someone you know by username, share your invitation link, or
            choose a contact on your phone.
          </Txt>
          <Button
            title="Open friend invitations"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/squads",
                params: { tab: "Friends" },
              })
            }
          />
        </>
      )}
      <Button
        title="Back to Friends Now"
        secondary
        onPress={() =>
          router.canGoBack()
            ? router.back()
            : router.replace("/(tabs)/activities")
        }
      />
    </Screen>
  );
}
