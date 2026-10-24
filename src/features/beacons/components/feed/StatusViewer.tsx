import { currentActivity } from "../../livingActivity";
import { LivingActivitySection } from "./LivingActivitySection";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Radio,
  Vote,
  Dices,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Sheet, Txt, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { visibleSoloActivity } from "@/src/features/maps/soloActivity";
import {
  statusNoteText,
  visibleStatusAttachment,
} from "../../statusAttachments";
import { visibleCurrentBeacon } from "../../currentStatusBeacon";
import { StatusAttachmentPreview } from "./StatusAttachmentEditor";
import { NoteSpeechBubble } from "./StatusNoteBubble";
import { StatusReactionPicker } from "./StatusReactionPicker";
import { StatusActivityInteractions } from "./StatusActivityInteractions";
import {
  CurrentBeaconPreview,
  currentBeaconRoleLabel,
} from "./CurrentBeaconPreview";

function attachmentDeadlineLabel(deadline: string, now: number) {
  const minutes = Math.ceil((Date.parse(deadline) - now) / 60000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes <= 0) return "Awaiting draw";
  if (minutes < 60) return `${minutes}m left`;
  if (minutes < 1440) return `${Math.ceil(minutes / 60)}h left`;
  return `${Math.ceil(minutes / 1440)}d left`;
}

export function StatusBubble({
  personId,
  onPress,
  attached = false,
}: {
  personId: string;
  onPress(): void;
  attached?: boolean;
}) {
  const { data, userId } = useBeacon();
  const now = useNow(1000);
  const { colors } = useTheme();
  const access = selectPersonPreview(data, personId, userId, now);
  const status = access.canViewFullProfile
    ? visibleSoloActivity(data, personId, userId, now)
    : undefined;
  const text = statusNoteText(status);
  const attachment =
    data.capabilities?.living_activity || data.is_demo
      ? null
      : visibleStatusAttachment(data, status, userId, now);
  const currentBeacon =
    data.capabilities?.living_activity || data.is_demo
      ? null
      : visibleCurrentBeacon(data, status, userId, now);
  const mergedFeaturedCurrent =
    currentBeacon?.activity.id === attachment?.id &&
    attachment?.type === "beacon";
  if (!status || (!text && !attachment && !currentBeacon)) return null;
  return (
    <Pressable
      testID="profile-status-bubble"
      accessibilityRole="button"
      accessibilityLabel="Open shared Status"
      onPress={onPress}
      style={{
        maxWidth: attached ? "100%" : 156,
        minWidth: 96,
        minHeight: attached ? 44 : undefined,
        alignSelf: attached ? "stretch" : undefined,
      }}
    >
      {!!text && (
        <NoteSpeechBubble compact tailTowardIdentity={attached}>
          {!!text && (
            <Text
              numberOfLines={2}
              style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}
            >
              {text}
            </Text>
          )}
        </NoteSpeechBubble>
      )}
      {attachment && !mergedFeaturedCurrent && (
        <Text
          numberOfLines={1}
          style={{
            color: colors.green,
            fontSize: 11,
            textAlign: "center",
            paddingTop: 2,
          }}
        >
          {attachment.type === "vote"
            ? "Vote Council"
            : attachment.type[0].toUpperCase() + attachment.type.slice(1)}{" "}
          attached
        </Text>
      )}
      {currentBeacon && (
        <Text
          numberOfLines={1}
          style={{
            color: colors.green,
            fontSize: 10,
            textAlign: "center",
            paddingTop: 2,
          }}
        >
          {mergedFeaturedCurrent ? "Featured · " : ""}Happening now ·{" "}
          {currentBeacon.activity.title}
        </Text>
      )}
    </Pressable>
  );
}

export function StatusViewer({
  personId,
  visible,
  onClose,
  onDismiss,
  children,
}: {
  personId: string | null;
  visible: boolean;
  onClose(): void;
  onDismiss?(): void;
  children?: React.ReactNode;
}) {
  const { data, userId } = useBeacon();
  const now = useNow(visible ? 1000 : 30000);
  const { colors } = useTheme();
  const continuation = useRef<(() => void) | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const latest = useRef({ data, userId, now, personId });
  useEffect(() => {
    latest.current = { data, userId, now, personId };
  }, [data, userId, now, personId]);
  const access = personId
    ? selectPersonPreview(data, personId, userId, now)
    : null;
  const status =
    personId && access?.canViewFullProfile
      ? visibleSoloActivity(data, personId, userId, now)
      : undefined;
  const attachment = visibleStatusAttachment(data, status, userId, now);
  const sharedCurrent = personId
    ? currentActivity(data, personId, userId, now)
    : null;
  const currentBeacon =
    sharedCurrent?.type === "beacon"
      ? {
          activity: sharedCurrent.activity,
          role: sharedCurrent.role ?? "going",
        }
      : data.is_demo || data.capabilities?.living_activity
        ? null
        : visibleCurrentBeacon(data, status, userId, now);
  const mergedFeaturedCurrent =
    currentBeacon?.activity.id === attachment?.id &&
    attachment?.type === "beacon";
  const text = statusNoteText(status);
  const navigate = (callback: () => void) => {
    continuation.current = callback;
    onClose();
  };
  const openCurrentBeacon = (expectedId: string) => {
    const requestedPersonId = personId;
    const requestedViewerId = userId;
    if (!requestedPersonId || !requestedViewerId) return;
    navigate(() => {
      const snapshot = latest.current;
      if (
        snapshot.userId !== requestedViewerId ||
        snapshot.data.viewer_id !== requestedViewerId
      )
        return;
      const checkedAt = Date.now();
      const freshAccess = selectPersonPreview(
        snapshot.data,
        requestedPersonId,
        snapshot.userId,
        checkedAt,
      );
      if (!freshAccess.canViewFullProfile) return;
      const freshStatus = visibleSoloActivity(
        snapshot.data,
        requestedPersonId,
        snapshot.userId,
        checkedAt,
      );
      const freshCurrent =
        currentActivity(
          snapshot.data,
          requestedPersonId,
          snapshot.userId,
          checkedAt,
        ) ??
        visibleCurrentBeacon(
          snapshot.data,
          freshStatus,
          snapshot.userId,
          checkedAt,
        );
      if (freshCurrent?.activity.id !== expectedId) return;
      router.push({
        pathname: "/activity/[id]",
        params: { id: freshCurrent.activity.id },
      });
    });
  };
  const openActivity = (activity: { type: string; id: string }) => {
    if (
      activity.type === "beacon" &&
      activity.id === currentBeacon?.activity.id
    )
      return openCurrentBeacon(activity.id);
    navigate(() =>
      router.push(
        activity.type === "beacon"
          ? { pathname: "/activity/[id]", params: { id: activity.id } }
          : { pathname: "/council/[id]", params: { id: activity.id } },
      ),
    );
  };
  return (
    <Sheet
      title="Status & activity"
      visible={visible}
      onClose={onClose}
      onDismiss={() => {
        setMoreOpen(false);
        const callback = continuation.current;
        continuation.current = null;
        callback?.();
        onDismiss?.();
      }}
    >
      {access?.canViewFullProfile && access.profile ? (
        <View testID="expanded-status-viewer" style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${access.profile.name}'s profile`}
              onPress={() =>
                navigate(() =>
                  router.push({
                    pathname: "/person/[id]",
                    params: { id: personId! },
                  }),
                )
              }
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
              }}
            >
              <ProfileAvatar profile={access.profile} size={44} />
              <View style={{ gap: 3, flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: 19, fontWeight: "600", color: colors.ink }}
                >
                  {access.profile.name}
                </Text>
                <Txt muted>
                  {status
                    ? `${status.available ? "Available" : "Busy"} · Until ${new Date(status.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : "No availability shared"}
                </Txt>
              </View>
            </Pressable>
          </View>
          {!!text && (
            <NoteSpeechBubble>
              {!!text && (
                <Text
                  style={{ color: colors.ink, fontSize: 20, lineHeight: 28 }}
                >
                  {text}
                </Text>
              )}
              {!!text &&
                !!status?.description &&
                status.description.trim() !== text.trim() && (
                  <Txt>{status.description}</Txt>
                )}
            </NoteSpeechBubble>
          )}
          {!text && !attachment && !currentBeacon && (
            <Txt muted>No Status shared right now.</Txt>
          )}
          {attachment && (
            <View
              testID="featured-status-activity"
              style={{
                gap: 10,
                padding: 12,
                borderRadius: 16,
                backgroundColor: colors.green + "0C",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  {attachment.type === "vote" ? (
                    <Vote size={14} color={colors.green} />
                  ) : attachment.type === "draw" ? (
                    <Dices size={14} color={colors.green} />
                  ) : (
                    <Radio size={14} color={colors.green} />
                  )}
                  <Text
                    style={{
                      color: colors.green,
                      fontSize: 11,
                      fontWeight: "600",
                      letterSpacing: 0.6,
                    }}
                  >
                    {attachment.type === "vote"
                      ? "VOTE COUNCIL"
                      : attachment.type.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {mergedFeaturedCurrent
                    ? "Happening now"
                    : attachment.type === "beacon"
                      ? attachment.state
                      : attachmentDeadlineLabel(attachment.time, now)}
                </Text>
              </View>
              {mergedFeaturedCurrent && currentBeacon && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {currentBeaconRoleLabel(currentBeacon.role)}
                </Text>
              )}
              <StatusAttachmentPreview
                embedded
                activity={attachment}
                onPress={() => openActivity(attachment)}
              />
              <StatusActivityInteractions
                attachment={attachment}
                onOpen={() => openActivity(attachment)}
              />
            </View>
          )}
          <View
            testID="status-secondary-actions"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            {status &&
              !status.status_note_hidden &&
              status.status_sharing !== false && (
                <View testID="status-reaction-action">
                  <StatusReactionPicker
                    activityId={status.id}
                    compact
                    labeled
                  />
                </View>
              )}
            {access.canMessage && personId !== userId && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Message ${access.profile.name}`}
                onPress={() =>
                  navigate(() =>
                    router.push({
                      pathname: "/messages/[id]",
                      params: { id: personId! },
                    }),
                  )
                }
                style={{
                  minHeight: 44,
                  paddingHorizontal: 10,
                  justifyContent: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <MessageCircle size={18} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  Message
                </Text>
              </Pressable>
            )}
          </View>
          {sharedCurrent?.type === "activity_note" && personId ? (
            <LivingActivitySection
              personId={personId}
              showLower={false}
              sonar={false}
            />
          ) : currentBeacon && !mergedFeaturedCurrent ? (
            <CurrentBeaconPreview
              activity={currentBeacon.activity}
              role={currentBeacon.role}
              now={now}
              compact={!!attachment}
              onPress={() => openCurrentBeacon(currentBeacon.activity.id)}
            />
          ) : null}
          {children && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More Status actions"
              accessibilityState={{ expanded: moreOpen }}
              onPress={() => setMoreOpen((value) => !value)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "row",
                gap: 5,
              }}
            >
              <Text style={{ color: colors.muted }}>
                {moreOpen ? "Fewer options" : "More"}
              </Text>
              {moreOpen ? (
                <ChevronUp size={15} color={colors.muted} />
              ) : (
                <ChevronDown size={15} color={colors.muted} />
              )}
            </Pressable>
          )}
          {moreOpen && children && <View style={{ gap: 8 }}>{children}</View>}
        </View>
      ) : (
        <Txt muted>This shared Status is no longer available.</Txt>
      )}
    </Sheet>
  );
}
