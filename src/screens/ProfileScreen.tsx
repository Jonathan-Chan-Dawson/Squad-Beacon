import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { ShieldCheck, Sparkles } from "lucide-react-native";
import { useBeacon } from "../store";
import { featuredActivity } from "../domain";
import { ProfileAvatar } from "../ProfileAvatar";
import { uploadAvatar } from "../avatar";
import { ActivityCard } from "../ActivityCard";
import { enablePush, stopDeviceLocation, clearPush } from "../device";
import { supabase } from "../supabase";
import {
  Action,
  Button,
  Chips,
  Field,
  Screen,
  Sheet,
  Txt,
  colors,
  styles,
} from "../ui";
export default function ProfileScreen() {
  const { data, userId, demo, act, signOut, refresh } = useBeacon(),
    profile = data.profiles.find((p) => p.id === userId)!;
  const [edit, setEdit] = useState(false),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState(""),
    [name, setName] = useState(profile.name),
    [bio, setBio] = useState(profile.bio),
    [interests, setInterests] = useState(profile.interests.join(", ")),
    [quietStart, setQuietStart] = useState(String(profile.quiet_start)),
    [quietEnd, setQuietEnd] = useState(String(profile.quiet_end));
  const [feature, setFeature] = useState(
    profile.hide_featured
      ? "Hidden"
      : (profile.featured_activity_id ?? "Automatic"),
  );
  const featured = featuredActivity(profile, data.activities);
  return (
    <Screen
      title="A work in progress."
      eyebrow="YOUR LITTLE CORNER"
      create={false}
    >
      <View style={[styles.card, { alignItems: "center", padding: 28 }]}>
        <ProfileAvatar profile={profile} size={84} />
        <Text style={styles.title}>{profile.name}</Text>
        <Txt muted>@{profile.username}</Txt>
        <Txt>{profile.bio || "Tell your people a little about yourself."}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {profile.interests.map((i) => (
            <Text key={i} style={[styles.chip, styles.chipText]}>
              {i}
            </Text>
          ))}
        </View>
        {!demo && (
          <Action
            secondary
            title="Change profile photo"
            run={async () => {
              await uploadAvatar(userId!);
              await refresh();
            }}
          />
        )}
        <Button secondary title="Edit profile" onPress={() => setEdit(true)} />
      </View>
      {featured && (
        <>
          <Text style={styles.h2}>What I’m up to</Text>
          <ActivityCard activity={featured} />
        </>
      )}
      <View style={styles.card}>
        <View style={styles.row}>
          <ShieldCheck color={colors.green} />
          <Text style={styles.h2}>You’re in control.</Text>
        </View>
        <Txt muted>
          Location is off unless you explicitly share it. Your birth date is
          private. Goals and habits are private until you choose an audience.
        </Txt>
        <Button
          title="Manage temporary location"
          secondary
          onPress={() => router.push("/location")}
        />
        <Action
          title="Enable push notifications"
          secondary
          run={async () => {
            if (demo)
              throw new Error(
                "Push is available with a real account on your phone.",
              );
            await enablePush();
          }}
        />
        <Action title="Disable this device’s push" secondary run={clearPush} />
      </View>
      <View style={styles.card}>
        <Sparkles color={colors.green} />
        <Text style={styles.h2}>The good stuff stays free.</Text>
        <Txt muted>
          Friends, squads, goals, habits, basic streaks, and privacy controls
          are free. Deeper insights and customization are planned for a future
          premium release.
        </Txt>
      </View>
      <Button
        secondary
        title="Privacy, safety & support"
        onPress={() => router.push("/legal")}
      />
      {data.is_moderator && (
        <Button
          title="Moderation inbox"
          secondary
          onPress={() => router.push("/moderation")}
        />
      )}
      <Action title={demo ? "Leave demo" : "Sign out"} run={signOut} />
      {!demo && (
        <Button
          secondary
          title="Delete my account"
          onPress={() => setDeleting(true)}
        />
      )}
      <Sheet title="Edit profile" visible={edit} onClose={() => setEdit(false)}>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline />
        <Field
          label="Interests · comma separated"
          value={interests}
          onChangeText={setInterests}
        />
        <Field
          label="Quiet hours start · 0–23"
          value={quietStart}
          onChangeText={setQuietStart}
          keyboardType="numeric"
        />
        <Field
          label="Quiet hours end · 0–23"
          value={quietEnd}
          onChangeText={setQuietEnd}
          keyboardType="numeric"
        />
        <Txt muted>
          Quiet hours follow {profile.timezone}. Equal hours disable quiet
          hours.
        </Txt>
        <Text style={styles.label}>FEATURED ACTIVITY</Text>
        <Chips
          options={["Automatic", "Hidden"]}
          value={feature}
          onChange={setFeature}
        />
        {data.activities
          .filter((a) => a.owner_id === userId)
          .map((a) => (
            <Button
              key={a.id}
              secondary={feature !== a.id}
              title={(feature === a.id ? "✓ " : "") + a.title}
              onPress={() => setFeature(a.id)}
            />
          ))}
        <Action
          title="Save profile"
          run={async () => {
            await act("save_profile", {
              name,
              bio,
              interests: interests
                .split(",")
                .map((i) => i.trim())
                .filter(Boolean),
              timezone: profile.timezone,
              quiet_start: Number(quietStart),
              quiet_end: Number(quietEnd),
              hide_featured: feature === "Hidden",
              featured_activity_id: ["Hidden", "Automatic"].includes(feature)
                ? null
                : feature,
            });
            setEdit(false);
          }}
        />
      </Sheet>
      <Sheet
        title="Delete your account"
        visible={deleting}
        onClose={() => setDeleting(false)}
      >
        <Txt>
          This permanently removes your profile, activities, goals, habits, and
          sharing sessions. Squads you own are removed too. Safety reports are
          retained under the published retention policy.
        </Txt>
        <Field
          label="Type DELETE to confirm"
          value={confirm}
          onChangeText={setConfirm}
        />
        <Action
          title="Permanently delete account"
          run={async () => {
            if (confirm !== "DELETE")
              throw new Error("Type DELETE to confirm.");
            await act("stop_location");
            await stopDeviceLocation();
            const { error } =
              await supabase!.functions.invoke("delete-account");
            if (error) throw error;
            await supabase!.auth.signOut({ scope: "local" });
          }}
        />
      </Sheet>
    </Screen>
  );
}
