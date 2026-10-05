import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, Trash2 } from "lucide-react-native";
import {
  Action,
  Button,
  Chips,
  Field,
  Screen,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import type { Activity, AspirationGoal, Profile } from "@/src/shared/types";
import {
  copyAspirationGoalsForSurvey,
  getAspirationProgress,
} from "@/src/features/profile/aspirations";
import {
  IDENTITY_CATALOG,
  INTEREST_CATALOG,
} from "@/src/shared/interestCatalog";
import { ProfileAvatar } from "./ProfileAvatar";

export type { AspirationGoal } from "@/src/shared/types";
export { getAspirationProgress } from "@/src/features/profile/aspirations";

type SurveyProfile = Profile & {
  identity_tags?: string[];
  aspiration_goals?: AspirationGoal[];
  onboarding_survey_status?: "pending" | "skipped" | "completed";
};

type SurveyProps = {
  profile: SurveyProfile;
  activities?: Activity[];
  mode?: "onboarding" | "retake";
  onComplete?: () => void;
  onSkip?: () => void;
};

function tagKey(group: string, tag: string) {
  return `${group}: ${tag}`;
}

function savedIdentityTags(profile: SurveyProfile) {
  const tags = profile.identity_tags ?? [];
  const legacyPersonality = profile.personality?.trim();
  if (!legacyPersonality) return tags;
  const legacyTag = tagKey("Personality", legacyPersonality);
  return tags.includes(legacyTag) || tags.includes(legacyPersonality)
    ? tags
    : [...tags, legacyTag];
}

function SurveyChip({
  label,
  selected,
  onPress,
  remove = false,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  remove?: boolean;
  disabled?: boolean;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${selected ? "Remove" : "Choose"} ${label}`}
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          minHeight: 42,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: selected ? colors.ink : colors.white,
          borderColor: selected ? colors.ink : colors.line,
          paddingVertical: 8,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {selected ? (
        <Check size={14} color={colors.white} />
      ) : remove ? (
        <Trash2 size={14} color={colors.muted} />
      ) : null}
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.white : colors.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ProfileSurveyBody({
  profile,
  activities = [],
  mode = "onboarding",
  onComplete,
  onSkip,
}: SurveyProps) {
  const { styles, colors } = useTheme();
  const { act, userId } = useBeacon();
  const [step, setStep] = useState(0);
  const [showIdentity, setShowIdentity] = useState(mode === "retake");
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [identityTags, setIdentityTags] = useState<string[]>(
    savedIdentityTags(profile),
  );
  const [identityGroup, setIdentityGroup] = useState(
    IDENTITY_CATALOG[0]?.name ?? "Personality",
  );
  const [identityCustom, setIdentityCustom] = useState("");
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [interestCategory, setInterestCategory] = useState(
    INTEREST_CATALOG[0]?.name ?? "Sports",
  );
  const [interestSubcategory, setInterestSubcategory] = useState(
    INTEREST_CATALOG[0]?.subcategories[0]?.name ?? "",
  );
  const [interestSearch, setInterestSearch] = useState("");
  const [interestCustom, setInterestCustom] = useState("");
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [aspirations, setAspirations] = useState<AspirationGoal[]>(
    copyAspirationGoalsForSurvey(profile.aspiration_goals),
  );
  const [aspirationTitle, setAspirationTitle] = useState("");
  const [aspirationCategory, setAspirationCategory] = useState("Fitness");
  const [aspirationTarget, setAspirationTarget] = useState("3");
  const [savingProfile, setSavingProfile] = useState(false);

  const categories = INTEREST_CATALOG.map((category) => category.name);
  const currentInterestCategory = INTEREST_CATALOG.find(
    (category) => category.name === interestCategory,
  );
  const currentSubcategories = currentInterestCategory?.subcategories ?? [];
  const selectedInterests = useMemo(
    () => (showAllInterests ? interests : interests.slice(0, 12)),
    [interests, showAllInterests],
  );
  const matchingInterests = useMemo(() => {
    const query = interestSearch.trim().toLocaleLowerCase();
    const visible = INTEREST_CATALOG.flatMap((category) =>
      category.subcategories.flatMap((subcategory) =>
        subcategory.interests.map((interest) => ({
          interest,
          category: category.name,
          subcategory: subcategory.name,
        })),
      ),
    );
    return visible.filter((entry) => {
      if (query)
        return `${entry.interest} ${entry.category} ${entry.subcategory}`
          .toLocaleLowerCase()
          .includes(query);
      return (
        entry.category === interestCategory &&
        entry.subcategory === interestSubcategory
      );
    });
  }, [interestCategory, interestSearch, interestSubcategory]);

  function toggleValue(
    values: string[],
    setValues: (next: string[]) => void,
    value: string,
  ) {
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  }

  function updateAspiration(id: string, updates: Partial<AspirationGoal>) {
    setAspirations((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  async function saveSurvey(status: "completed" | "skipped") {
    setSavingProfile(true);
    try {
      if (status === "completed" && !name.trim())
        throw new Error("Add your name so your friends recognize you.");
      await act("save_profile", {
        ...profile,
        name: status === "skipped" ? profile.name : name.trim(),
        bio: status === "skipped" ? profile.bio : bio.trim(),
        identity_tags:
          status === "skipped" ? (profile.identity_tags ?? []) : identityTags,
        interests: status === "skipped" ? (profile.interests ?? []) : interests,
        aspiration_goals:
          status === "skipped" ? (profile.aspiration_goals ?? []) : aspirations,
        onboarding_survey_status: status,
      });
      if (status === "completed") onComplete?.();
      else onSkip?.();
    } finally {
      setSavingProfile(false);
    }
  }

  const stepCopy = [
    {
      label: "You",
      title: "A little introduction.",
      body: "Start with your name. About me and identity badges are optional; you can change everything later.",
    },
    {
      label: "Interests",
      title: "What do you like doing?",
      body: "Your interests help people find shared beacons and plans. Pick a few now, or search the full catalog and add your own.",
    },
    {
      label: "Aspirations",
      title: "What would you like to make time for?",
      body: "Set a small weekly target. You can connect beacons to an aspiration when you create them and track your progress here.",
    },
  ][step];

  return (
    <View style={{ gap: 14 }}>
      <View style={[styles.card, { gap: 12 }]}>
        <Text style={styles.label}>
          PART {step + 1} OF 3 · {stepCopy.label.toUpperCase()}
        </Text>
        <Text style={styles.h2}>{stepCopy.title}</Text>
        <Txt muted>{stepCopy.body}</Txt>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[0, 1, 2].map((number) => (
            <View
              key={number}
              style={{
                height: 5,
                flex: 1,
                borderRadius: 4,
                backgroundColor: number <= step ? colors.green : colors.line,
              }}
            />
          ))}
        </View>
      </View>

      {step === 0 && (
        <View style={styles.card}>
          <View style={{ alignItems: "center" }}>
            <ProfileAvatar profile={profile} size={64} />
          </View>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
          <Field
            label="About me (optional)"
            value={bio}
            onChangeText={setBio}
            maxLength={280}
            multiline
          />
          <Button
            compact
            secondary
            title={
              showIdentity
                ? "Hide identity badges"
                : "Identity badges (optional)"
            }
            onPress={() => setShowIdentity(!showIdentity)}
          />
        </View>
      )}
      {step === 0 && showIdentity && (
        <View style={styles.card}>
          <Text style={styles.h2}>Identity badges</Text>
          <Txt muted>
            Add badges that help friends understand who you are. Every choice is
            optional.
          </Txt>
          <Chips
            options={IDENTITY_CATALOG.map((group) => group.name)}
            value={identityGroup}
            onChange={setIdentityGroup}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {IDENTITY_CATALOG.find(
              (group) => group.name === identityGroup,
            )?.tags.map((tag) => {
              const value = tagKey(identityGroup, tag);
              return (
                <SurveyChip
                  key={value}
                  label={tag}
                  selected={identityTags.includes(value)}
                  disabled={
                    !identityTags.includes(value) && identityTags.length >= 50
                  }
                  onPress={() =>
                    toggleValue(identityTags, setIdentityTags, value)
                  }
                />
              );
            })}
          </View>
          <Field
            label="Add your own identity tag"
            value={identityCustom}
            onChangeText={setIdentityCustom}
            placeholder="A detail you want people to know"
            maxLength={53}
            returnKeyType="done"
          />
          <Button
            secondary
            title="Add identity tag"
            disabled={!identityCustom.trim() || identityTags.length >= 50}
            onPress={() => {
              const value = tagKey("Other", identityCustom.trim());
              if (!identityTags.includes(value))
                setIdentityTags([...identityTags, value]);
              setIdentityCustom("");
            }}
          />
          {identityTags.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>YOUR SELECTED TAGS</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {identityTags.map((tag) => (
                  <SurveyChip
                    key={tag}
                    label={tag}
                    selected
                    remove
                    onPress={() =>
                      setIdentityTags(
                        identityTags.filter((item) => item !== tag),
                      )
                    }
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {step === 1 && (
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text style={styles.h2}>Interest badges</Text>
            <Text style={[styles.label, { alignSelf: "center" }]}>
              {interests.length} SELECTED
            </Text>
          </View>
          {identityTags.length >= 50 && (
            <Txt muted>You can choose up to 50 identity tags.</Txt>
          )}
          <Field
            label="Search interests"
            value={interestSearch}
            onChangeText={setInterestSearch}
            placeholder="Try hiking, jazz, volunteering…"
            autoCapitalize="none"
          />
          {!interestSearch.trim() && (
            <>
              <Text style={styles.label}>CATEGORY</Text>
              <Chips
                options={categories}
                value={interestCategory}
                onChange={(category) => {
                  setInterestCategory(category);
                  setInterestSubcategory(
                    INTEREST_CATALOG.find((entry) => entry.name === category)
                      ?.subcategories[0]?.name ?? "",
                  );
                }}
              />
              <Text style={styles.label}>EXPLORE</Text>
              <Chips
                options={currentSubcategories.map(
                  (subcategory) => subcategory.name,
                )}
                value={interestSubcategory}
                onChange={setInterestSubcategory}
              />
            </>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {matchingInterests.slice(0, 80).map((entry) => (
              <SurveyChip
                key={`${entry.category}:${entry.interest}`}
                label={entry.interest}
                selected={interests.includes(entry.interest)}
                disabled={
                  !interests.includes(entry.interest) && interests.length >= 500
                }
                onPress={() =>
                  toggleValue(interests, setInterests, entry.interest)
                }
              />
            ))}
          </View>
          {matchingInterests.length > 80 && (
            <Txt muted>Keep typing to narrow these results.</Txt>
          )}
          <Field
            label="Add an interest that is not listed"
            value={interestCustom}
            onChangeText={setInterestCustom}
            placeholder="Your own interest"
            maxLength={80}
            returnKeyType="done"
          />
          <Button
            secondary
            title="Add custom interest"
            disabled={!interestCustom.trim() || interests.length >= 500}
            onPress={() => {
              const value = interestCustom.trim();
              if (!interests.includes(value))
                setInterests([...interests, value]);
              setInterestCustom("");
            }}
          />
          {interests.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>SELECTED · TAP TO REMOVE</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {selectedInterests.map((interest) => (
                  <SurveyChip
                    key={interest}
                    label={interest}
                    selected
                    remove
                    onPress={() =>
                      setInterests(
                        interests.filter((item) => item !== interest),
                      )
                    }
                  />
                ))}
                {!showAllInterests && interests.length > 12 && (
                  <Button
                    compact
                    secondary
                    title={`Show ${interests.length - 12} more`}
                    onPress={() => setShowAllInterests(true)}
                  />
                )}
                {showAllInterests && interests.length > 12 && (
                  <Button
                    compact
                    secondary
                    title="Show fewer"
                    onPress={() => setShowAllInterests(false)}
                  />
                )}
              </View>
            </View>
          )}
          {interests.length >= 500 && (
            <Txt muted>You can save up to 500 interests.</Txt>
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.h2}>Aspirations</Text>
          <Txt muted>
            Choose a goal and a pace that feels doable. Beacons linked to these
            goals count toward your weekly progress.
          </Txt>
          {!!profile.aspirations?.trim() && (
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: colors.lime,
                paddingLeft: 10,
              }}
            >
              <Txt muted>
                Your existing aspiration note will stay on your profile:
              </Txt>
              <Txt>{profile.aspirations}</Txt>
            </View>
          )}
          {aspirations.map((aspiration) => {
            const progress = userId
              ? getAspirationProgress(
                  aspiration,
                  activities,
                  userId,
                  profile.timezone ||
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                )
              : { count: 0, streak: 0 };
            return (
              <View
                key={aspiration.id}
                style={[styles.card, { backgroundColor: colors.bg }]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text style={styles.label}>
                    {aspiration.category.toUpperCase()}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${aspiration.title}`}
                    onPress={() =>
                      setAspirations(
                        aspirations.filter((item) => item.id !== aspiration.id),
                      )
                    }
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 size={18} color={colors.muted} />
                  </Pressable>
                </View>
                <Field
                  label="Aspiration"
                  value={aspiration.title}
                  onChangeText={(title) =>
                    updateAspiration(aspiration.id, { title })
                  }
                  maxLength={80}
                />
                <Text style={styles.label}>PACE · TIMES PER WEEK</Text>
                <Chips
                  options={["1", "2", "3", "4", "5", "6", "7"] as const}
                  value={String(aspiration.target_per_week)}
                  onChange={(value) =>
                    updateAspiration(aspiration.id, {
                      target_per_week: Number(value),
                    })
                  }
                />
                <Txt muted>
                  {progress.count}/{aspiration.target_per_week} linked beacons
                  this week
                  {progress.streak > 0
                    ? ` · ${progress.streak}-week streak`
                    : ""}
                </Txt>
              </View>
            );
          })}
          <Field
            label="A new aspiration"
            value={aspirationTitle}
            onChangeText={setAspirationTitle}
            placeholder="For example, go for a run"
            maxLength={80}
            returnKeyType="done"
          />
          <Text style={styles.label}>CATEGORY</Text>
          <Chips
            options={categories}
            value={aspirationCategory}
            onChange={setAspirationCategory}
          />
          <Text style={styles.label}>TIMES PER WEEK</Text>
          <Chips
            options={["1", "2", "3", "4", "5", "6", "7"] as const}
            value={aspirationTarget}
            onChange={setAspirationTarget}
          />
          <Button
            secondary
            title="Add aspiration"
            disabled={!aspirationTitle.trim() || aspirations.length >= 20}
            onPress={() => {
              setAspirations([
                ...aspirations,
                {
                  id: `asp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  title: aspirationTitle.trim(),
                  category: aspirationCategory,
                  target_per_week: Number(aspirationTarget),
                },
              ]);
              setAspirationTitle("");
            }}
          />
          {aspirations.length >= 20 && (
            <Txt muted>You can save up to 20 aspirations.</Txt>
          )}
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {step > 0 && (
          <View style={{ flex: 1 }}>
            <Button secondary title="Back" onPress={() => setStep(step - 1)} />
          </View>
        )}
        {step < 2 ? (
          <View style={{ flex: 1 }}>
            <Button title="Continue" onPress={() => setStep(step + 1)} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Action
              title={mode === "onboarding" ? "Finish profile" : "Save profile"}
              disabled={savingProfile}
              run={() => saveSurvey("completed")}
            />
          </View>
        )}
      </View>
      {mode === "onboarding" && (
        <Action
          secondary
          title="Skip for now"
          disabled={savingProfile}
          run={() => saveSurvey("skipped")}
        />
      )}
      {step === 0 && mode === "retake" && (
        <Txt muted>
          You can update these choices again whenever you like from your
          profile.
        </Txt>
      )}
    </View>
  );
}

export function ProfileSurveyContent(props: SurveyProps) {
  return <ProfileSurveyBody {...props} />;
}

export function ProfileSurvey(props: SurveyProps) {
  return (
    <Screen
      title="Get started with your profile"
      eyebrow="OPTIONAL PROFILE SETUP"
      create={false}
    >
      <Txt muted>
        Help your people find shared interests and make plans together. Your
        profile survey is optional and never changes location sharing.
      </Txt>
      <ProfileSurveyBody {...props} />
    </Screen>
  );
}
