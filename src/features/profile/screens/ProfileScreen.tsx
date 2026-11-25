import {
  PremiumHeaderButton,
  PersonalMembershipSummary,
} from "../components/PremiumEntry";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pencil, Settings, Sparkles, X } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import {
  Button,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { Skeleton, useReducedMotion } from "@/src/shared/design-system";
import type { BeaconTemplate } from "@/src/shared/templates";
import { useSpontaneityEntry } from "@/src/features/beacons/spontaneity/SpontaneityEntry";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { ProfileSurveyContent } from "../ProfileSurvey";
import { InviteQR } from "@/src/features/people/InviteQR";
import { MiniBeaconControls } from "../components/MiniBeaconControls";
import { beaconScoreTier } from "../beaconScore";
import { useBeaconScore } from "../useBeaconScore";
import {
  ProfileExperience,
  type ProfileTab,
} from "../components/ProfileExperience";
export default function ProfileScreen() {
  const { userId, viewerEpoch, demo } = useBeacon();
  return <ProfileScreenBody key={`${userId}:${viewerEpoch}:${demo}`} />;
}

function ProfileScreenBody() {
  const { data, userId, loading, refresh, demo } = useBeacon();
  const { semanticColors: colors, styles, tokens } = useTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyBusy, setSurveyBusy] = useState(false);
  const [surveyScrollRequest, setSurveyScrollRequest] = useState<{
    y: number;
    sequence: number;
  }>();
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const score = useBeaconScore(userId, demo);
  const { index: stageIndex } = beaconScoreTier(score.points);
  const [dotToast, setDotToast] = useState<{ message: string; recipe?: BeaconTemplate } | null>(null);
  const dismissDotToast = useCallback(() => setDotToast(null), []);
  const openSpontaneity = useSpontaneityEntry();
  useEffect(() => {
    if (!dotToast) return;
    const timeout = setTimeout(dismissDotToast, dotToast.recipe ? 4500 : 2800);
    return () => clearTimeout(timeout);
  }, [dotToast, dismissDotToast]);
  const announcedStage = useRef<number | null>(null);
  useEffect(() => {
    if (!score.synced) return;
    const frame = requestAnimationFrame(() => {
      const previous = announcedStage.current;
      announcedStage.current = stageIndex;
      if (previous !== null && stageIndex > previous)
        setDotToast({ message: `Level ${stageIndex + 1} unlocked` });
    });
    return () => cancelAnimationFrame(frame);
  }, [score.synced, stageIndex]);
  function openToastQuest() {
    dismissDotToast();
    openSpontaneity();
  }
  const params = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<ProfileTab>(
    params.section === "aspirations" ? "About" : "Overview",
  );
  const [sectionScroll, setSectionScroll] = useState<{
    y: number;
    sequence: number;
  }>();
  const displayedTab = params.section === "aspirations" ? "About" : tab;
  const focusAspirations = useCallback(
    (y: number) => {
      if (params.section !== "aspirations") return;
      setTab("About");
      setSectionScroll({ y, sequence: Date.now() });
      router.setParams({ section: undefined });
    },
    [params.section],
  );
  const profile =
    data.viewer_id === userId
      ? data.profiles.find((p) => p.id === userId)
      : undefined;
  const personalizationEntry =
    profile && profile.onboarding_survey_status !== "completed" ? (
      <View
        testID="profile-personalization-entry"
        style={[styles.card, { gap: 8 }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Sparkles size={20} color={colors.accent} />
          <Text style={styles.h2}>Make it yours</Text>
        </View>
        <Txt muted>Add interests and goals whenever you’re ready.</Txt>
        <Button
          compact
          secondary
          title="Personalize Profile"
          onPress={() => {
            setSaved(false);
            setSurveyOpen(true);
          }}
        />
      </View>
    ) : null;
  return (
    <View style={{ flex: 1 }}>
    <Screen
      title="Profile"
      eyebrow=""
      compactHeader
      create={false}
      scrollStateKey={`${userId}:${tab}`}
      scrollRequest={sectionScroll}
      headerAction={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PremiumHeaderButton />
          <IconButton label="Settings" onPress={() => router.push("/settings")}>
            <Settings size={22} color={colors.textPrimary} />
          </IconButton>
        </View>
      }
    >
      {profile ? (
        <ProfileExperience
          key={profile.id}
          profile={profile}
          tab={displayedTab}
          onTabChange={setTab}
          onAspirationPosition={focusAspirations}
          progression={<MiniBeaconControls />}
          overviewAccessory={<View testID="profile-membership-section"><PersonalMembershipSummary /></View>}
          actions={
            <>
              <Button
                title="Edit profile"
                compact
                icon={<Pencil size={16} color={colors.onAccent} />}
                onPress={() => router.push("/profile/edit")}
              />
              <Button
                title="Share profile"
                compact
                secondary
                onPress={() => setShareOpen(true)}
              />
              {personalizationEntry && (
                <View style={{ width: "100%", minWidth: 0 }}>
                  {personalizationEntry}
                </View>
              )}
            </>
          }
        />
      ) : loading ? (
        <View style={{ gap: 18 }} accessibilityLabel="Loading profile">
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Skeleton width={96} height={96} borderRadius={48} />
            <View style={{ flex: 1, gap: 10 }}>
              <Skeleton height={30} />
              <Skeleton height={18} width="60%" />
            </View>
          </View>
          <Skeleton height={70} />
          <Skeleton height={100} />
          <Skeleton height={246} />
        </View>
      ) : (
        <>
          <Txt muted>Your profile is unavailable right now.</Txt>
          <Button title="Retry profile" onPress={() => void refresh()} />
        </>
      )}
      {saved && (
        <View accessibilityLiveRegion="polite">
          <Txt>Your profile is looking good.</Txt>
        </View>
      )}
      <Modal
        visible={surveyOpen && !!profile}
        animationType={reducedMotion ? "none" : "slide"}
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (!surveyBusy) setSurveyOpen(false);
        }}
      >
        <ChatKeyboardFrame>
          <Screen
            title="Personalize profile"
            eyebrow="OPTIONAL"
            compactHeader
            create={false}
            scrollRequest={surveyScrollRequest}
            headerAction={
              <IconButton
                label="Close personalization"
                disabled={surveyBusy}
                onPress={() => setSurveyOpen(false)}
              >
                <X size={22} color={colors.textPrimary} />
              </IconButton>
            }
          >
            <Txt muted>
              Your profile, your pace. These choices never turn on location
              sharing.
            </Txt>
            {surveyOpen && profile && (
              <ProfileSurveyContent
                profile={profile}
                activities={data.activities}
                mode="retake"
                onSavingChange={setSurveyBusy}
                onStepChange={() =>
                  setSurveyScrollRequest((current) => ({
                    y: 0,
                    sequence: (current?.sequence ?? 0) + 1,
                  }))
                }
                onSkip={() => setSurveyOpen(false)}
                onComplete={() => {
                  setSurveyOpen(false);
                  setSaved(true);
                }}
              />
            )}
          </Screen>
        </ChatKeyboardFrame>
      </Modal>
      <Sheet
        title="Share profile"
        visible={shareOpen && !!profile}
        onClose={() => setShareOpen(false)}
      >
        {profile && (
          <>
            <InviteQR username={profile.username} />
            <Txt muted>Invite someone to connect with @{profile.username}.</Txt>
            <Button
              title="Share invitation link"
              onPress={() => {
                const link =
                  "squadbeacon://invite?username=" +
                  encodeURIComponent(profile.username);
                void Share.share({ message: link, url: link });
              }}
            />
          </>
        )}
      </Sheet>
    </Screen>
      {dotToast ? (
        <View pointerEvents="box-none" style={{ position: "absolute", bottom: insets.bottom + tokens.layout.tabBarHeight + 16, left: 16, right: 16, alignItems: "center", zIndex: 10 }}>
          <Pressable
            accessibilityLiveRegion="polite"
            accessibilityRole="button"
            accessibilityLabel={`${dotToast.message}. Open Spontaneity Machine`}
            onPress={openToastQuest}
            style={({ pressed }) => ({
              maxWidth: 360, minHeight: 44, justifyContent: "center", paddingHorizontal: 14,
              paddingVertical: 8, borderRadius: 18, backgroundColor: colors.surfaceRaised,
              borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text numberOfLines={dotToast.recipe ? 1 : 2} style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>
              {dotToast.message}
            </Text>
            {dotToast.recipe && (
              <Text style={{ color: colors.accent, fontSize: 13, textAlign: "center", paddingVertical: 8 }}>
                Open Spontaneity Machine
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
