import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewProps,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import type { Profile } from "@/src/shared/types";
import { Button, Field, Sheet } from "@/src/shared/ui";
import {
  Chip,
  GlassBar,
  useDesignTheme,
  useReducedMotion,
} from "@/src/shared/design-system";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { ProfileAvatar } from "../ProfileAvatar";
import { MiniAvatar } from "@/src/features/people/MiniAvatar";
import { uploadAvatar } from "../avatar";
import { ProfileSurveyContent } from "../ProfileSurvey";
import {
  EditorAspirations,
  EditorIdentity,
  EditorInterests,
} from "../components/ProfileEditorChoices";
import {
  profileEditorDraft,
  profileEditorPayload,
  requireProfileOwner,
  validateProfileEditor,
  type ProfileEditorDraft,
} from "../profileEditorDraft";

function EditorKeyboardFrame({ children, style, ...props }: ViewProps) {
  return (
    <ChatKeyboardFrame>
      <View {...props} style={[{ flex: 1 }, style]}>
        {children}
      </View>
    </ChatKeyboardFrame>
  );
}

export default function ProfileEditScreen() {
  const { data, userId, loading } = useBeacon();
  const { colors } = useDesignTheme();
  const profile = data.profiles.find((item) => item.id === userId);
  return profile ? (
    <Editor key={profile.id} profile={profile} />
  ) : (
    <View
      style={{
        flex: 1,
        padding: 16,
        justifyContent: "center",
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
        {loading ? "Your profile is loading." : "Your profile is unavailable."}
      </Text>
      <Button title="Close editor" secondary onPress={() => router.back()} />
    </View>
  );
}

function Editor({ profile }: { profile: Profile }) {
  const { data, userId, demo, act, refresh, getCurrentProfile } = useBeacon();
  const { colors } = useDesignTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const navigation = useNavigation();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [baseline, setBaseline] = useState(() => profileEditorDraft(profile));
  const [draft, setDraft] = useState(() => profileEditorDraft(profile));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowExit, setAllowExit] = useState(false);
  const [exitAction, setExitAction] = useState<NavigationAction | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [retakeConfirm, setRetakeConfirm] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyBusy, setSurveyBusy] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [entrance] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const actionLock = useRef(false);
  const active = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const focusedSection = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const locked = busy || surveyOpen;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (reducedMotion) entrance.setValue(1);
    else
      Animated.timing(entrance, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
  }, [entrance, reducedMotion]);
  usePreventRemove(
    !allowExit && (dirty || busy || surveyOpen),
    ({ data: pending }) => {
      if (actionLock.current || surveyBusy) return;
      if (surveyOpen) {
        setSurveyOpen(false);
        return;
      }
      setExitAction(pending.action);
      setDiscardOpen(true);
    },
  );
  useEffect(() => {
    if (allowExit) {
      if (exitAction) navigation.dispatch(exitAction);
      else if (router.canGoBack()) router.back();
      else router.replace("/profile");
    }
  }, [allowExit, exitAction, navigation]);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !dirty)
      return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  const update = <K extends keyof ProfileEditorDraft>(
    field: K,
    value: ProfileEditorDraft[K],
  ) => {
    if (!actionLock.current && !surveyOpen)
      setDraft((current) => ({ ...current, [field]: value }));
  };
  const focusSection = useCallback(
    (name: string, y: number) => {
      if (!focusedSection.current && name === section) {
        focusedSection.current = true;
        requestAnimationFrame(() =>
          scroll.current?.scrollTo({
            y: Math.max(0, y - 12),
            animated: !reducedMotion,
          }),
        );
      }
    },
    [reducedMotion, section],
  );
  const currentProfile = () =>
    requireProfileOwner(getCurrentProfile(), profile.id);
  async function save() {
    if (actionLock.current || surveyOpen) return;
    actionLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const validated = validateProfileEditor(draft);
      await act(
        "save_profile",
        profileEditorPayload(currentProfile(), baseline, validated),
      );
      if (active.current) {
        setBaseline(validated);
        setDraft(validated);
        setAllowExit(true);
      }
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not save your profile. Try again.",
        );
    } finally {
      actionLock.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function changePhoto() {
    if (actionLock.current || surveyOpen || demo || !supabase) return;
    actionLock.current = true;
    setBusy(true);
    setUploading(true);
    setError(null);
    try {
      const viewerId = currentProfile().id;
      const uploaded = await uploadAvatar(viewerId);
      if (!uploaded) return;
      await refresh();
      if (active.current && getCurrentProfile()?.id === viewerId)
        setDraft((current) => ({ ...current, avatar_style: "photo" }));
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not upload your photo.",
        );
    } finally {
      actionLock.current = false;
      if (active.current) {
        setBusy(false);
        setUploading(false);
      }
    }
  }
  function openSurvey() {
    if (actionLock.current) return;
    if (dirty) setRetakeConfirm(true);
    else setSurveyOpen(true);
  }
  function discardAndRetake() {
    try {
      const clean = profileEditorDraft(currentProfile());
      setBaseline(clean);
      setDraft(clean);
      setRetakeConfirm(false);
      setSurveyOpen(true);
    } catch (failure) {
      setRetakeConfirm(false);
      setError(
        failure instanceof Error
          ? failure.message
          : "Reopen your profile editor.",
      );
    }
  }
  const heading = (title: string, body?: string) => (
    <View style={{ gap: 4 }}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}
      >
        {title}
      </Text>
      {body && (
        <Text
          style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 22 }}
        >
          {body}
        </Text>
      )}
    </View>
  );
  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close editor"
      disabled={locked}
      onPress={() => {
        if (dirty) {
          setExitAction(null);
          setDiscardOpen(true);
        } else setAllowExit(true);
      }}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <X size={24} color={colors.textPrimary} />
    </Pressable>
  );
  const photoPreview = {
    ...profile,
    avatar_seed: draft.avatar_seed,
    avatar_style: draft.avatar_style,
  };
  return (
    <EditorKeyboardFrame
      testID="profile-editor"
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {closeButton}
        <Text
          accessibilityRole="header"
          style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}
        >
          Edit profile
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 32 }}
      >
        <Animated.View
          style={{
            gap: 24,
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
        >
          <View style={{ gap: 12 }}>
            {heading("Your avatar")}
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              {draft.avatar_style === "illustrated" ? (
                <MiniAvatar
                  seed={draft.avatar_seed}
                  size={96}
                  name="Your avatar preview"
                />
              ) : (
                <ProfileAvatar profile={photoPreview} size={96} />
              )}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                label="Styled avatar"
                selected={draft.avatar_style === "illustrated"}
                disabled={locked}
                onPress={() => update("avatar_style", "illustrated")}
              />
              {!demo && supabase && profile.avatar_updated_at && (
                <Chip
                  label="Profile photo"
                  selected={draft.avatar_style === "photo"}
                  disabled={locked}
                  onPress={() => update("avatar_style", "photo")}
                />
              )}
            </View>
            {draft.avatar_style === "illustrated" && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Chip
                  label="Next look"
                  disabled={locked}
                  onPress={() =>
                    update("avatar_seed", (draft.avatar_seed + 37) % 216)
                  }
                />
                <Chip
                  label="Skin tone"
                  disabled={locked}
                  onPress={() =>
                    update(
                      "avatar_seed",
                      Math.floor(draft.avatar_seed / 6) * 6 +
                        ((draft.avatar_seed + 1) % 6),
                    )
                  }
                />
                <Chip
                  label="Outfit"
                  disabled={locked}
                  onPress={() =>
                    update("avatar_seed", (draft.avatar_seed + 6) % 216)
                  }
                />
                <Chip
                  label="Hair"
                  disabled={locked}
                  onPress={() =>
                    update("avatar_seed", (draft.avatar_seed + 36) % 216)
                  }
                />
              </View>
            )}
            {!demo && !!supabase && (
              <Button
                title={uploading ? "Uploading…" : "Upload profile photo"}
                secondary
                disabled={locked}
                onPress={() => {
                  void changePhoto();
                }}
              />
            )}
            {!demo && !!supabase && (
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                Uploaded photos are saved immediately.
              </Text>
            )}
          </View>
          <View style={{ gap: 16 }}>
            {heading("Introduce yourself")}
            <Field
              label="Name"
              value={draft.name}
              onChangeText={(value) => update("name", value)}
              maxLength={80}
              editable={!locked}
              autoComplete="name"
            />
            <Field
              label="Bio"
              value={draft.bio}
              onChangeText={(value) => update("bio", value)}
              maxLength={500}
              multiline
              editable={!locked}
            />
            <Field
              label="Lives in (optional)"
              value={draft.home}
              onChangeText={(value) => update("home", value)}
              maxLength={120}
              editable={!locked}
            />
            <Field
              label="Birthday note (optional)"
              value={draft.birthday_note}
              onChangeText={(value) => update("birthday_note", value)}
              maxLength={80}
              editable={!locked}
            />
          </View>
          <View style={{ gap: 12 }}>
            {heading(
              "Identity badges",
              "Optional details you choose to share on your profile.",
            )}
            <Button
              title={
                identityOpen
                  ? "Hide identity choices"
                  : "Choose identity badges"
              }
              secondary
              disabled={locked}
              onPress={() => setIdentityOpen(!identityOpen)}
            />
            {identityOpen ? (
              <EditorIdentity
                values={draft.identity_tags}
                onChange={(value) => update("identity_tags", value)}
                disabled={locked}
              />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {draft.identity_tags.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    selected
                    disabled={locked}
                    accessibilityLabel={`Remove ${value} identity badge`}
                    onPress={() =>
                      update(
                        "identity_tags",
                        draft.identity_tags.filter((tag) => tag !== value),
                      )
                    }
                  />
                ))}
              </View>
            )}
          </View>
          <View
            onLayout={(event) =>
              focusSection("interests", event.nativeEvent.layout.y)
            }
            style={{ gap: 12 }}
          >
            {heading(
              "Interests",
              "Search the catalog or add something of your own.",
            )}
            <EditorInterests
              values={draft.interests}
              onChange={(value) => update("interests", value)}
              disabled={locked}
            />
          </View>
          <View
            onLayout={(event) =>
              focusSection("aspirations", event.nativeEvent.layout.y)
            }
            style={{ gap: 12 }}
          >
            {heading(
              "Aspirations",
              "Small weekly targets for things you want to make time for.",
            )}
            <EditorAspirations
              values={draft.aspiration_goals}
              onChange={(value) => update("aspiration_goals", value)}
              disabled={locked}
            />
            <Field
              label="Things I'd love to try"
              value={draft.aspirations}
              onChangeText={(value) => update("aspirations", value)}
              maxLength={500}
              multiline
              editable={!locked}
            />
          </View>
          <View style={{ gap: 16 }}>
            {heading("More about you", "These details are optional.")}
            <Field
              label="Personality"
              value={draft.personality}
              onChangeText={(value) => update("personality", value)}
              maxLength={80}
              editable={!locked}
            />
            <Field
              label="A quote I like"
              value={draft.quote}
              onChangeText={(value) => update("quote", value)}
              maxLength={300}
              multiline
              editable={!locked}
            />
            {heading("Featured Beacon")}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                label="Automatic"
                selected={!draft.hide_featured && !draft.featured_activity_id}
                disabled={locked}
                onPress={() => {
                  update("hide_featured", false);
                  update("featured_activity_id", null);
                }}
              />
              <Chip
                label="Hidden"
                selected={draft.hide_featured}
                disabled={locked}
                onPress={() => {
                  update("hide_featured", true);
                  update("featured_activity_id", null);
                }}
              />
              {data.activities
                .filter((activity) => activity.owner_id === userId)
                .map((activity) => (
                  <Chip
                    key={activity.id}
                    label={activity.title}
                    selected={
                      !draft.hide_featured &&
                      draft.featured_activity_id === activity.id
                    }
                    disabled={locked}
                    onPress={() => {
                      update("hide_featured", false);
                      update("featured_activity_id", activity.id);
                    }}
                  />
                ))}
            </View>
            <Button
              title="Retake profile survey"
              secondary
              disabled={locked}
              onPress={openSurvey}
            />
          </View>
        </Animated.View>
      </ScrollView>
      <GlassBar
        testID="profile-editor-save-bar"
        style={{
          borderRadius: 0,
          padding: 16,
          paddingBottom: Math.max(16, insets.bottom),
          gap: 8,
        }}
      >
        {error && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.textPrimary, fontSize: 16 }}
          >
            {error}
          </Text>
        )}
        <Button
          title={busy ? "Saving…" : "Save profile"}
          disabled={locked || !dirty || !draft.name.trim()}
          onPress={() => {
            void save();
          }}
        />
      </GlassBar>
      <Sheet
        title="Discard your changes?"
        visible={discardOpen}
        onClose={() => {
          setDiscardOpen(false);
          setExitAction(null);
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
          Your unsaved profile changes will be lost.
        </Text>
        <Button
          title="Keep editing"
          onPress={() => {
            setDiscardOpen(false);
            setExitAction(null);
          }}
        />
        <Button
          title="Discard changes"
          secondary
          onPress={() => {
            setDiscardOpen(false);
            setAllowExit(true);
          }}
        />
      </Sheet>
      <Sheet
        title="Retake profile survey?"
        visible={retakeConfirm}
        onClose={() => setRetakeConfirm(false)}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
          Discard the changes in this editor before starting the survey.
        </Text>
        <Button title="Keep editing" onPress={() => setRetakeConfirm(false)} />
        <Button
          title="Discard changes and retake"
          secondary
          onPress={discardAndRetake}
        />
      </Sheet>
      <Modal
        visible={surveyOpen}
        animationType={reducedMotion ? "none" : "slide"}
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (!surveyBusy) setSurveyOpen(false);
        }}
      >
        <EditorKeyboardFrame style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              paddingTop: insets.top,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: colors.textPrimary,
                fontSize: 24,
                fontWeight: "700",
              }}
            >
              Profile survey
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close survey"
              disabled={surveyBusy}
              onPress={() => setSurveyOpen(false)}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 16,
              paddingBottom: Math.max(24, insets.bottom),
              gap: 16,
            }}
          >
            {surveyOpen && (
              <ProfileSurveyContent
                key={profile.id}
                profile={profile}
                activities={data.activities}
                mode="retake"
                onSavingChange={setSurveyBusy}
                onSkip={() => setSurveyOpen(false)}
                onProfileSaved={(saved) => {
                  const clean = profileEditorDraft(saved);
                  setBaseline(clean);
                  setDraft(clean);
                  setSurveyOpen(false);
                }}
              />
            )}
          </ScrollView>
        </EditorKeyboardFrame>
      </Modal>
    </EditorKeyboardFrame>
  );
}
