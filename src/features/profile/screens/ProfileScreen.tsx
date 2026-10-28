import React, { useState } from "react";
import { Modal, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { Pencil, QrCode, Settings, Sparkles, X } from "lucide-react-native";
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

function ProfileScreenBody() {
  const { data, userId, loading, refresh } = useBeacon();
  const { semanticColors: colors, styles } = useTheme();
  const reducedMotion = useReducedMotion();
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyBusy, setSurveyBusy] = useState(false);
  const [surveyScrollRequest, setSurveyScrollRequest] = useState<{
    y: number;
    sequence: number;
  }>();
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("Overview");
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
    <Screen
      title="Profile"
      eyebrow=""
      compactHeader
      create={false}
      scrollStateKey={`${userId}:${tab}`}
      headerAction={
        <IconButton label="Settings" onPress={() => router.push("/settings")}>
          <Settings size={22} color={colors.textPrimary} />
        </IconButton>
      }
    >
      {profile ? (
        <ProfileExperience
          key={profile.id}
          profile={profile}
          tab={tab}
          onTabChange={setTab}
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
  );
}
