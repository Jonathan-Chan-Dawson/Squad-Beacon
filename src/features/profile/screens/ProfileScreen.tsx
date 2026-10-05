import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { Settings } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { featuredActivity } from "@/src/shared/domain";
import { MiniAvatar } from "@/src/features/people/MiniAvatar";
import { avatarSeed } from "@/src/features/profile/avatarArt";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { uploadAvatar } from "@/src/features/profile/avatar";
import {
  canReadMemory,
  type BeaconMemory,
} from "@/src/features/beacons/models";
import type { Profile } from "@/src/shared/types";
import {
  getAspirationProgress,
  ProfileSurveyContent,
  type AspirationGoal,
} from "@/src/features/profile/ProfileSurvey";
import {
  Action,
  Button,
  Field,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

export default function ProfileScreen() {
  const { data, userId, loading } = useBeacon();
  const profile = data.profiles.find((item) => item.id === userId);
  if (!profile)
    return (
      <Screen title="Profile" eyebrow="YOUR SPACE" create={false}>
        <Txt muted>
          {loading
            ? "Your profile is loading."
            : "Your profile is unavailable right now."}
        </Txt>
      </Screen>
    );
  return <ProfileContent key={profile.id} profile={profile} />;
}

function ProfileContent({ profile }: { profile: Profile }) {
  const { styles, colors } = useTheme();
  const { data, userId, demo, act, refresh } = useBeacon();
  const [edit, setEdit] = useState(false);
  const [survey, setSurvey] = useState(false);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [feature, setFeature] = useState(
    profile.hide_featured
      ? "Hidden"
      : (profile.featured_activity_id ?? "Automatic"),
  );
  const [home, setHome] = useState(profile.home ?? "");
  const [birthday, setBirthday] = useState(profile.birthday_note ?? "");
  const [aspirations, setAspirations] = useState(profile.aspirations ?? "");
  const [personality, setPersonality] = useState(profile.personality ?? "");
  const [quote, setQuote] = useState(profile.quote ?? "");
  const [avatar, setAvatar] = useState(false);
  const [seed, setSeed] = useState(
    profile.avatar_seed ?? avatarSeed(profile.id),
  );

  const featured = featuredActivity(profile, data.activities);
  const memories = data.beacon_memories
    .filter((memory) => memory.author_id === userId)
    .flatMap((memory: BeaconMemory) => {
      const activity = data.activities.find(
        (item) => item.id === memory.activity_id,
      );
      return activity && userId && canReadMemory(data, activity, memory, userId)
        ? [{ memory, activity }]
        : [];
    })
    .sort((left, right) =>
      right.memory.created_at.localeCompare(left.memory.created_at),
    )
    .slice(0, 3);
  const journalCount = data.beacon_notes.filter(
    (note) => note.author_id === userId,
  ).length;
  const listCount = data.library_saved_checklists.filter(
    (list) => list.owner_id === userId,
  ).length;

  const openBeacon = (activityId: string) =>
    router.push(`/activity/${activityId}` as Href);

  return (
    <Screen
      title="Profile"
      eyebrow="YOUR SPACE"
      create={false}
      headerAction={
        <IconButton
          label="Settings"
          onPress={() => router.push("/settings" as Href)}
        >
          <Settings size={20} color={colors.ink} />
        </IconButton>
      }
    >
      <View style={[styles.card, { gap: 12 }]}>
        <View style={[styles.row, { alignItems: "flex-start", gap: 14 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Style mini"
            onPress={() => setAvatar(true)}
            style={{ width: 72, height: 72 }}
          >
            <ProfileAvatar profile={profile} size={72} />
          </Pressable>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.h2}>{profile.name}</Text>
            <Txt muted>@{profile.username}</Txt>
          </View>
        </View>
        <Text style={styles.body}>
          {profile.bio || "Tell your people a little about yourself."}
        </Text>
        <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
          <Button compact title="Edit profile" onPress={() => setEdit(true)} />
          <Button
            compact
            secondary
            title="Retake profile survey"
            onPress={() => setSurvey(true)}
          />
        </View>
      </View>

      {(!!profile.interests.length || !!profile.identity_tags?.length) && (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.h2}>A little more about me</Text>
          {!!profile.identity_tags?.length && (
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>IDENTITY</Text>
              <View style={[styles.row, { flexWrap: "wrap", gap: 7 }]}>
                {profile.identity_tags.slice(0, 6).map((tag) => (
                  <Text key={tag} style={[styles.chip, styles.chipText]}>
                    {tag}
                  </Text>
                ))}
                {profile.identity_tags.length > 6 && (
                  <Txt muted>+{profile.identity_tags.length - 6} more</Txt>
                )}
              </View>
            </View>
          )}
          {!!profile.interests.length && (
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>INTERESTS</Text>
              <View style={[styles.row, { flexWrap: "wrap", gap: 7 }]}>
                {profile.interests.slice(0, 6).map((interest) => (
                  <Text key={interest} style={[styles.chip, styles.chipText]}>
                    {interest}
                  </Text>
                ))}
                {profile.interests.length > 6 && (
                  <Txt muted>+{profile.interests.length - 6} more</Txt>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {!!profile.aspiration_goals?.length && (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.h2}>Things I want to make time for</Text>
          <Txt muted>
            Finished Beacons linked to an aspiration count toward its weekly
            target.
          </Txt>
          {profile.aspiration_goals
            .slice(0, 3)
            .map((aspiration: AspirationGoal) => {
              const progress = getAspirationProgress(
                aspiration,
                data.activities,
                userId!,
                profile.timezone ||
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
              );
              return (
                <View key={aspiration.id} style={{ gap: 3 }}>
                  <Text style={[styles.body, { fontWeight: "700" }]}>
                    {aspiration.title}
                  </Text>
                  <Txt muted>
                    {progress.count}/{aspiration.target_per_week} this week
                    {progress.streak > 0
                      ? ` · ${progress.streak}-week streak`
                      : ""}
                  </Txt>
                </View>
              );
            })}
          {profile.aspiration_goals.length > 3 && (
            <Txt muted>
              +{profile.aspiration_goals.length - 3} more aspirations
            </Txt>
          )}
        </View>
      )}

      {(profile.home ||
        profile.birthday_note ||
        profile.aspirations ||
        profile.personality ||
        profile.quote) && (
        <View style={[styles.card, { gap: 6 }]}>
          <Text style={styles.h2}>About me</Text>
          {[
            profile.home && `Lives in ${profile.home}`,
            profile.birthday_note && `Birthday · ${profile.birthday_note}`,
            profile.aspirations,
            profile.personality,
            profile.quote && `“${profile.quote}”`,
          ]
            .filter(Boolean)
            .map((value, index) => (
              <Txt key={index}>{value}</Txt>
            ))}
        </View>
      )}

      {featured && (
        <View style={[styles.card, { gap: 7 }]}>
          <Text style={styles.h2}>What I’m up to</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open Beacon ${featured.title}`}
            onPress={() => openBeacon(featured.id)}
            style={({ pressed }) => ({
              minHeight: 48,
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text style={[styles.body, { fontWeight: "700" }]}>
              {featured.title}
            </Text>
            <Txt muted>
              {featured.category} ·{" "}
              {new Date(featured.starts_at).toLocaleString()}
            </Txt>
          </Pressable>
        </View>
      )}

      <View style={[styles.card, { gap: 6 }]}>
        <View style={styles.between}>
          <Text style={styles.h2}>Beacon Memories</Text>
          <Text style={styles.label}>FROM YOUR BEACONS</Text>
        </View>
        <Txt muted>
          Photos and videos stay connected to the Beacon where they were shared.
        </Txt>
        {!memories.length && (
          <Txt muted>Your Beacon Memories will appear here.</Txt>
        )}
        {memories.map(({ memory, activity }) => (
          <Pressable
            key={memory.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${memory.media_type} memory from ${activity.title}`}
            onPress={() => openBeacon(activity.id)}
            style={({ pressed }) => ({
              minHeight: 54,
              paddingVertical: 7,
              paddingHorizontal: 9,
              borderRadius: 12,
              backgroundColor: colors.bg,
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={[styles.body, { fontWeight: "700" }]}
            >
              {memory.caption ||
                (memory.media_type === "image" ? "Photo" : "Video")}
            </Text>
            <Txt muted>
              {activity.title} ·{" "}
              {new Date(memory.created_at).toLocaleDateString()}
            </Txt>
          </Pressable>
        ))}
        <Button
          compact
          secondary
          title="See past Beacons"
          onPress={() =>
            router.push({
              pathname: "/(tabs)/activities",
              params: { filter: "Past" },
            })
          }
        />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Your library</Text>
        <Txt muted>Keep Beacon Notes and reusable checklists close.</Txt>
        <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
          <Button
            compact
            secondary
            title={`Journals · ${journalCount}  ›`}
            onPress={() =>
              router.push({
                pathname: "/library",
                params: { kind: "journal" },
              } as Href)
            }
          />
          <Button
            compact
            secondary
            title={`Lists · ${listCount}  ›`}
            onPress={() =>
              router.push({
                pathname: "/library",
                params: { kind: "checklist" },
              } as Href)
            }
          />
        </View>
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.h2}>Friends & lists</Text>
        <Txt muted>Review friend requests, Squad invitations, and your private lists.</Txt>
        <Button
          compact
          secondary
          title="Open Friends & Lists"
          onPress={() => router.push({ pathname: "/(tabs)/squads", params: { peopleLists: "yes" } } as Href)}
        />
      </View>

      <View style={[styles.card, { gap: 7 }]}>
        <View style={styles.between}>
          <Text style={styles.h2}>Widget Studio</Text>
          <Text style={styles.label}>OPTIONAL TOOLS</Text>
        </View>
        <Txt muted>
          Choose a Friends Now or circle summary for your Home Screen.
        </Txt>
        <Button
          compact
          secondary
          title="Open Widget Studio"
          onPress={() => router.push("/widgets" as Href)}
        />
      </View>

      {data.is_moderator && (
        <Button
          title="Moderation inbox"
          secondary
          onPress={() => router.push("/moderation")}
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
        {!demo ? (
          <Action
            secondary
            compact
            title="Change profile photo"
            run={async () => {
              await uploadAvatar(userId!);
              await refresh();
            }}
          />
        ) : null}
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline />
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
        <Text style={styles.label}>FEATURED BEACON</Text>
        <Button
          secondary={feature !== "Automatic"}
          title={`${feature === "Automatic" ? "✓ " : ""}Automatic`}
          onPress={() => setFeature("Automatic")}
        />
        <Button
          secondary={feature !== "Hidden"}
          title={`${feature === "Hidden" ? "✓ " : ""}Hidden`}
          onPress={() => setFeature("Hidden")}
        />
        {data.activities
          .filter((activity) => activity.owner_id === userId)
          .map((activity) => (
            <Button
              key={activity.id}
              secondary={feature !== activity.id}
              title={`${feature === activity.id ? "✓ " : ""}${activity.title}`}
              onPress={() => setFeature(activity.id)}
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
        title="Profile survey"
        visible={survey}
        onClose={() => setSurvey(false)}
      >
        <ProfileSurveyContent
          mode="retake"
          profile={profile}
          activities={data.activities}
          onComplete={() => setSurvey(false)}
        />
      </Sheet>
    </Screen>
  );
}
