import { usePreferences } from "../preferences";
import { MiniAvatar } from "../MiniAvatar";
import { avatarSeed } from "../avatarArt";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { useBeacon } from "../store";
import { featuredActivity } from "../domain";
import { ProfileAvatar } from "../ProfileAvatar";
import { AvatarToggle } from "../AvatarToggle";
import { uploadAvatar } from "../avatar";
import { ActivityCard } from "../ActivityCard";
import WidgetAdviceTip from "../widgets/WidgetAdviceTip";
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
  useTheme,
} from "../ui";
export default function ProfileScreen() {
  const { styles, colors } = useTheme();

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
  const [home, setHome] = useState(profile.home ?? ""),
    [birthday, setBirthday] = useState(profile.birthday_note ?? ""),
    [aspirations, setAspirations] = useState(profile.aspirations ?? ""),
    [personality, setPersonality] = useState(profile.personality ?? ""),
    [quote, setQuote] = useState(profile.quote ?? ""),
    [sharing, setSharing] = useState(profile.default_audience ?? "friends");
  const { theme, setTheme } = usePreferences();
  const [avatar, setAvatar] = useState(false),
    [seed, setSeed] = useState(profile.avatar_seed ?? avatarSeed(profile.id));
  const featured = featuredActivity(profile, data.activities);
  return (
    <Screen title="Profile" eyebrow="Your profile and settings" create={false}>
      <Button
        title="Your memories"
        secondary
        onPress={() =>
          router.push({
            pathname: "/(tabs)/activities",
            params: { filter: "Past" },
          })
        }
      />
      <Button
        title="Widget Studio"
        secondary
        onPress={() => router.push("/widgets" as Href)}
      />
      <WidgetAdviceTip />
      <View style={styles.card}>
        <Text style={styles.h2}>Make it feel like you</Text>
        <Chips
          options={["Mint", "Sunset", "Midnight"] as const}
          value={theme}
          onChange={setTheme}
        />
        <AvatarToggle description />
      </View>
      <View style={[styles.card, { alignItems: "center" }]}>
        <ProfileAvatar profile={profile} size={96} />
        <Button
          title="Style my mini"
          secondary
          onPress={() => setAvatar(true)}
        />
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
        {[
          profile.home,
          profile.birthday_note,
          profile.aspirations,
          profile.personality,
          profile.quote,
        ]
          .filter(Boolean)
          .map((value, i) => (
            <Txt key={i}>{value}</Txt>
          ))}
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
          <Text style={styles.h2}>Privacy and notifications</Text>
        </View>
        <Txt muted>
          Location is off unless you explicitly share it. Your birth date is
          private. Only an optional birthday note is shown on your profile.
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
      <Button
        secondary
        title="Privacy, safety & support"
        onPress={() => router.push("/legal")}
      />
      <Button
        secondary
        title="Help & tutorial"
        onPress={() => router.push("/help" as Href)}
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
      <Sheet
        title="Style your mini"
        visible={avatar}
        onClose={() => setAvatar(false)}
      >
        <View style={{ alignItems: "center" }}>
          <MiniAvatar seed={seed} size={150} name="Your mini preview" />
        </View>
        <Txt muted>
          A little illustrated you. Pick a look, then make it your own.
        </Txt>
        <Button
          title="Next look"
          secondary
          onPress={() => setSeed((seed + 37) % 216)}
        />
        <Button
          title="Change skin tone"
          secondary
          onPress={() => setSeed(Math.floor(seed / 6) * 6 + ((seed + 1) % 6))}
        />
        <Button
          title="Change outfit"
          secondary
          onPress={() => setSeed((seed + 6) % 216)}
        />
        <Button
          title="Change hair"
          secondary
          onPress={() => setSeed((seed + 36) % 216)}
        />
        <Action
          title="Use this mini"
          run={async () => {
            await act("save_profile", {
              ...profile,
              avatar_seed: seed,
              avatar_style: "illustrated",
            });
            setAvatar(false);
          }}
        />
        {profile.avatar_updated_at && (
          <Action
            title="Use my photo"
            secondary
            run={async () => {
              await act("save_profile", { ...profile, avatar_style: "photo" });
              setAvatar(false);
            }}
          />
        )}
      </Sheet>
      <Sheet title="Edit profile" visible={edit} onClose={() => setEdit(false)}>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline />
        <Field
          label="Interests · comma separated"
          value={interests}
          onChangeText={setInterests}
        />
        <Field
          label="Lives in (optional)"
          value={home}
          onChangeText={setHome}
          maxLength={120}
        />
        <Field
          label="Birthday note (optional, shown on profile)"
          value={birthday}
          onChangeText={setBirthday}
          maxLength={80}
          placeholder="October 12"
        />
        <Field
          label="Things I'd love to try"
          value={aspirations}
          onChangeText={setAspirations}
          maxLength={500}
          multiline
        />
        <Field
          label="Personality (optional)"
          value={personality}
          onChangeText={setPersonality}
          maxLength={80}
        />
        <Field
          label="A quote I like (optional)"
          value={quote}
          onChangeText={setQuote}
          maxLength={300}
        />
        <Txt muted>Default beacon sharing</Txt>
        <Chips
          options={["friends", "private"] as const}
          value={sharing}
          onChange={setSharing}
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
              ...profile,
              name,
              bio,
              home,
              birthday_note: birthday,
              aspirations,
              personality,
              quote,
              default_audience: sharing,
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
          This permanently removes your profile, beacons, messages, and sharing
          sessions. Squads you own are removed too. Safety reports are retained
          under the published retention policy.
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
