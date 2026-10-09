import React, { useId, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GroupChatThread } from "@/src/features/organizations/GroupChatThread";
import { ChatIdentityHeader } from "@/src/features/people/previews/ChatIdentityHeader";
import { SquadProfilePreview } from "@/src/features/people/previews/SquadProfilePreview";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import { useBeacon } from "@/src/shared/store";
import { BackButton, Button, Sheet, Txt, useTheme } from "@/src/shared/ui";

export default function SquadChatRoute() {
  const { id, ping: requestedPing } = useLocalSearchParams<{
    id?: string;
    ping?: string;
  }>();
  const squadId = Array.isArray(id) ? id[0] : id;
  const focusedPingId = Array.isArray(requestedPing)
    ? requestedPing[0]
    : requestedPing;
  const router = useRouter();
  const { styles, colors } = useTheme();
  const { data, userId } = useBeacon();
  const [profileOpen, setProfileOpen] = useState(false);
  const [composerActionsOpen, setComposerActionsOpen] = useState(false);
  const pingSeed = useId();
  const composerIntent = useRef(0);
  const squad =
    squadId && activeSquadMembership(data, squadId, userId)
      ? data.squads.find((item) => item.id === squadId)
      : undefined;

  function navigateAfterComposerClose(navigate: () => void) {
    setComposerActionsOpen(false);
    setTimeout(navigate, 320);
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <View style={[styles.content, { flex: 1, paddingBottom: 12 }]}>
        {squad && squadId ? (
          <>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <BackButton />
              <View style={{ flex: 1, minWidth: 0 }}>
                <ChatIdentityHeader
                  name={squad.name}
                  subtitle={`${data.squad_members.filter((member) => member.squad_id === squadId).length} members · Squad info`}
                  avatar={
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: colors.lime,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.ink,
                          fontSize: 16,
                          fontWeight: "700",
                        }}
                      >
                        {squad.name
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </Text>
                    </View>
                  }
                  accessibilityLabel={`Open Squad profile for ${squad.name}`}
                  onPress={() => setProfileOpen(true)}
                />
              </View>
            </View>
            <GroupChatThread
              key={`${userId}:${squadId}`}
              scope="squad"
              squadId={squadId}
              focusedPingId={focusedPingId}
              onMoreActions={() => setComposerActionsOpen(true)}
            />
            <SquadProfilePreview
              key={`${squadId}:active-member`}
              squadId={squadId}
              visible={profileOpen}
              inChat
              onClose={() => setProfileOpen(false)}
            />
            <Sheet
              title="Add to Squad chat"
              visible={composerActionsOpen}
              onClose={() => setComposerActionsOpen(false)}
            >
              <Text style={styles.label}>ACTIVITY</Text>
              <Button
                title="Ping"
                onPress={() => {
                  const seed = `${pingSeed}-${++composerIntent.current}`;
                  navigateAfterComposerClose(() =>
                    router.push({
                      pathname: "/councils",
                      params: { squadId, newPing: "yes", pingSeed: seed },
                    }),
                  );
                }}
              />
              <Button
                secondary
                title="Create Beacon"
                onPress={() =>
                  navigateAfterComposerClose(() =>
                    router.push({
                      pathname: "/create",
                      params: { kind: "squad", squadId },
                    }),
                  )
                }
              />
              <Button
                secondary
                title="Plan"
                onPress={() => {
                  const seed = `${pingSeed}-plan-${++composerIntent.current}`;
                  navigateAfterComposerClose(() =>
                    router.push({
                      pathname: "/plans",
                      params: { squadId, create: "yes", planSeed: seed },
                    }),
                  );
                }}
              />
            </Sheet>
          </>
        ) : (
          <>
            <BackButton />
            <Txt muted>Only current Squad members can open this chat.</Txt>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
