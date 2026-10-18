import React, { useState } from "react";
import { Share, View } from "react-native";
import { router } from "expo-router";
import { Pencil, QrCode, Settings } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import {
  Button,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { Skeleton } from "@/src/shared/design-system";
import { InviteQR } from "@/src/features/people/InviteQR";
import {
  ProfileExperience,
  type ProfileTab,
} from "../components/ProfileExperience";

export default function ProfileScreen() {
  const { data, userId, loading, refresh } = useBeacon();
  const { semanticColors: colors } = useTheme();
  const [shareOpen, setShareOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("Overview");
  const profile =
    data.viewer_id === userId
      ? data.profiles.find((p) => p.id === userId)
      : undefined;
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
