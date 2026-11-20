import {
  PremiumHeaderButton,
  PersonalMembershipSummary,
} from "../components/PremiumEntry";
import React, { useCallback, useRef, useState } from "react";
import { Modal, Pressable, Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pencil, QrCode, RadioTower, Settings, Sparkles, X } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import {
  Button,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { Skeleton, Toast, useReducedMotion } from "@/src/shared/design-system";
import { templates, type BeaconTemplate } from "@/src/shared/templates";
import { startCreationDraft, setCreationDraftField } from "@/src/features/beacons/socialPlanningSession";
import { formatDurationLabel } from "@/src/features/beacons/createTiming";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { ProfileSurveyContent } from "../ProfileSurvey";
import { InviteQR } from "@/src/features/people/InviteQR";
import {
  ProfileExperience,
  type ProfileTab,
} from "../components/ProfileExperience";
export default function ProfileScreen() {
  const { userId, viewerEpoch, demo } = useBeacon();
  return <ProfileScreenBody key={`${userId}:${viewerEpoch}:${demo}`} />;
}

const dotColors = ["#8EDDB5", "#AAB8FF", "#F5C481", "#F1A6CF", "#82D7EA"];
const dotQuips = [
  "Tiny Beacon. Big main-character energy.",
  "You found the button with no job description.",
  "The Beacon has changed outfits.",
  "Congrats. You’ve picked up a signal.",
];

function ProfileScreenBody() {
  const { data, userId, loading, refresh } = useBeacon();
  const { semanticColors: colors, styles } = useTheme();
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
  const taps = useRef(0);
  const [dotColor, setDotColor] = useState(dotColors[0]);
  const [dotToast, setDotToast] = useState<{ message: string; recipe?: BeaconTemplate } | null>(null);
  const dismissDotToast = useCallback(() => setDotToast(null), []);
  function tapDot() {
    const roll = Math.random();
    setDotColor((previous) => {
      const choices = dotColors.filter((color) => color !== previous);
      return choices[Math.floor(roll * choices.length)];
    });
    taps.current += 1;
    if (taps.current % 4 !== 0) return;
    if (taps.current % 8 === 0) {
      const recipe = templates[Math.floor(Math.random() * templates.length)];
      setDotToast({ message: `Plot twist: ${recipe.title}?`, recipe });
    } else {
      setDotToast({ message: dotQuips[Math.floor(Math.random() * dotQuips.length)] });
    }
  }
  function openSurpriseDraft(recipe: BeaconTemplate) {
    const token = startCreationDraft(userId);
    if (!token) return;
    setCreationDraftField(userId, token, "selectedRecipe", recipe);
    setCreationDraftField(userId, token, "title", recipe.title);
    setCreationDraftField(userId, token, "category", recipe.category);
    setCreationDraftField(userId, token, "duration", formatDurationLabel(recipe.minutes));
    dismissDotToast();
    router.push({ pathname: "/create", params: { editor: "yes", planSession: token } });
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
          noteAccessory={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tap the tiny Beacon"
              onPress={tapDot}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <View testID="profile-tiny-beacon" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <RadioTower size={15} color={dotColor} strokeWidth={2} />
              </View>
            </Pressable>
          }
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
              <IconButton
                label="Show profile invitation QR code"
                onPress={() => setShareOpen(true)}
              >
                <QrCode size={21} color={colors.textPrimary} />
              </IconButton>
              <View
                testID="profile-membership-section"
                style={{
                  width: "100%",
                  marginTop: 8,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <PersonalMembershipSummary />
              </View>
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
        <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 57, right: 12, width: 252, zIndex: 10 }}>
          <Toast visible message={dotToast.message} onDismiss={dismissDotToast}
            duration={dotToast.recipe ? 4500 : undefined}
            action={dotToast.recipe ? {
              label: "Open surprise draft",
              onPress: () => { if (dotToast.recipe) openSurpriseDraft(dotToast.recipe); },
            } : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}
