import React, { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { ChatThread } from "@/src/features/messages/ChatThread";
import { BackButton, Txt, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ChatIdentityHeader } from "@/src/features/people/previews/ChatIdentityHeader";
import { PersonProfilePreview } from "@/src/features/people/previews/PersonProfilePreview";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { useNow } from "@/src/shared/useNow";
export default function Messages() {
  const { colors, styles } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId } = useBeacon();
  const [previewVisible, setPreviewVisible] = useState(false);
  const selection = selectPersonPreview(data, id, userId, useNow());
  const name = selection.canViewFullProfile
    ? (selection.profile?.name ?? "Friend")
    : selection.canMessage
      ? "Friend"
      : "Conversation";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.content, { flex: 1 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <BackButton />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ChatIdentityHeader
              name={name}
              subtitle={
                selection.availability === "available"
                  ? "Available now"
                  : selection.availability === "ending-soon"
                    ? "Wrapping up soon"
                    : selection.availability === "unavailable"
                      ? "Not available right now"
                      : undefined
              }
              avatar={
                <ProfileAvatar
                  profile={
                    selection.canViewFullProfile ? selection.profile : undefined
                  }
                  size={42}
                />
              }
              accessibilityLabel={
                selection.canMessage
                  ? `View ${name}'s profile`
                  : "Profile preview unavailable"
              }
              onPress={() => setPreviewVisible(true)}
            />
          </View>
        </View>
        {selection.canMessage ? (
          <ChatThread key={`${userId}:${id}`} personId={id} />
        ) : (
          <Txt>
            This conversation is unavailable. A current friendship is required
            to send and read messages.
          </Txt>
        )}
      </View>
      <PersonProfilePreview
        personId={id}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />
    </SafeAreaView>
  );
}
