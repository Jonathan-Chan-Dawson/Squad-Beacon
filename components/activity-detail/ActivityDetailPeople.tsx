import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Check, UserMinus, UserRound, X } from "lucide-react-native";
import type { Profile } from "@/src/shared/types";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import {
  Card,
  EmptyState,
  useDesignTheme,
  useReducedMotion,
  uiHaptics,
} from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";

export type SafeRsvpRow = {
  userId: string;
  name: string;
  profile?: Profile;
  isSelf: boolean;
};

type ActivityDetailPeopleProps = {
  going: SafeRsvpRow[];
  maybe: SafeRsvpRow[];
  requested: SafeRsvpRow[];
  viewerUserId: string | null;
  canAdmit: boolean;
  onProfile: (userId: string) => void;
  onApprove: (userId: string) => void | Promise<unknown>;
  onDeny: (userId: string) => void | Promise<unknown>;
  canRemove: (userId: string) => boolean;
  onRemove: (userId: string) => void | Promise<unknown>;
};

export function ActivityDetailPeople({
  going,
  maybe,
  requested,
  viewerUserId,
  canAdmit,
  onProfile,
  onApprove,
  onDeny,
  canRemove,
  onRemove,
}: ActivityDetailPeopleProps) {
  const { colors, tokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const visibleRequested = canAdmit
    ? requested
    : requested.filter((row) => row.isSelf || row.userId === viewerUserId);
  const hasPeople = going.length + maybe.length + visibleRequested.length > 0;

  if (!hasPeople) {
    return (
      <Card style={{ padding: 0 }}>
        <EmptyState
          icon={
            <UserRound size={tokens.iconSize.lg} color={colors.textSecondary} />
          }
          title="No participant details to show yet"
          body="People will appear here when they respond to the Beacon."
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.lg, padding: space.md }}>
      {going.length ? (
        <PeopleSection
          title="Going"
          rows={going}
          viewerUserId={viewerUserId}
          onProfile={onProfile}
          removeAction={{ onRemove, canRemove }}
        />
      ) : null}
      {maybe.length ? (
        <PeopleSection
          title="Maybe"
          rows={maybe}
          viewerUserId={viewerUserId}
          onProfile={onProfile}
          removeAction={{ onRemove, canRemove }}
        />
      ) : null}
      {visibleRequested.length ? (
        <PeopleSection
          title="Requested"
          rows={visibleRequested}
          viewerUserId={viewerUserId}
          onProfile={onProfile}
          admissionActions={
            canAdmit ? { onApprove, onDeny, reducedMotion } : undefined
          }
        />
      ) : null}
    </Card>
  );
}

function PeopleSection({
  title,
  rows,
  viewerUserId,
  onProfile,
  admissionActions,
  removeAction,
}: {
  title: "Going" | "Maybe" | "Requested";
  rows: SafeRsvpRow[];
  viewerUserId: string | null;
  onProfile: (userId: string) => void;
  admissionActions?: {
    onApprove: (userId: string) => void | Promise<unknown>;
    onDeny: (userId: string) => void | Promise<unknown>;
    reducedMotion: boolean;
  };
  removeAction?: {
    onRemove: (userId: string) => void | Promise<unknown>;
    canRemove: (userId: string) => boolean;
  };
}) {
  const { colors } = useDesignTheme();

  return (
    <View style={{ gap: space.xs }}>
      <View
        style={{
          minHeight: 32,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.textPrimary, ...type.headline }}>
          {title}
        </Text>
        <Text
          accessibilityLabel={`${rows.length} ${rows.length === 1 ? "person" : "people"}`}
          style={{ color: colors.textSecondary, ...type.secondary }}
        >
          {rows.length}
        </Text>
      </View>
      {rows.map((row) => (
        <PersonRow
          key={row.userId}
          row={row}
          viewerUserId={viewerUserId}
          onProfile={onProfile}
          admissionActions={
            title === "Requested" ? admissionActions : undefined
          }
          removeAction={title === "Requested" ? undefined : removeAction}
        />
      ))}
    </View>
  );
}

function PersonRow({
  row,
  viewerUserId,
  onProfile,
  admissionActions,
  removeAction,
}: {
  row: SafeRsvpRow;
  viewerUserId: string | null;
  onProfile: (userId: string) => void;
  admissionActions?: {
    onApprove: (userId: string) => void | Promise<unknown>;
    onDeny: (userId: string) => void | Promise<unknown>;
    reducedMotion: boolean;
  };
  removeAction?: {
    onRemove: (userId: string) => void | Promise<unknown>;
    canRemove: (userId: string) => boolean;
  };
}) {
  const { colors } = useDesignTheme();
  const swipeableRef = useRef<React.ComponentRef<typeof Swipeable>>(null);
  const runningRef = useRef(false);
  const [busyAction, setBusyAction] = useState<
    "approve" | "deny" | "remove" | null
  >(null);
  const [error, setError] = useState("");
  const name =
    row.isSelf || row.userId === viewerUserId
      ? "You"
      : row.name.trim() || "Participant";
  const actions =
    admissionActions && !row.isSelf && row.userId !== viewerUserId
      ? admissionActions
      : undefined;
  const removal =
    removeAction &&
    removeAction.canRemove(row.userId) &&
    !row.isSelf &&
    row.userId !== viewerUserId
      ? removeAction
      : undefined;
  const busy = busyAction !== null;

  const runAction = async (action: "approve" | "deny" | "remove") => {
    const callback =
      action === "approve"
        ? actions?.onApprove
        : action === "deny"
          ? actions?.onDeny
          : removal?.onRemove;
    if (!callback || runningRef.current) return;
    runningRef.current = true;
    setBusyAction(action);
    setError("");
    try {
      await callback(row.userId);
      if (action === "approve") {
        await uiHaptics.success();
      } else {
        await uiHaptics.light();
      }
      swipeableRef.current?.close();
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message.trim()
          ? failure.message
          : action === "approve"
            ? "Could not approve this request. Try again."
            : action === "deny"
              ? "Could not open the request options. Try again."
              : "Could not open participant removal options. Try again.",
      );
    } finally {
      runningRef.current = false;
      setBusyAction(null);
    }
  };

  const rowView = (
    <View
      style={{
        minHeight: 60,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingHorizontal: space.xs,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name === "You" ? "your" : `${name}'s`} profile`}
        onPress={() => onProfile(row.userId)}
        style={({ pressed }) => ({
          minHeight: 56,
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          opacity: pressed ? 0.76 : 1,
        })}
      >
        <ProfileAvatar profile={row.profile} size={40} />
        <Text
          numberOfLines={1}
          style={{ color: colors.textPrimary, ...type.body, flex: 1 }}
        >
          {name}
        </Text>
      </Pressable>
      {actions ? (
        <>
          <ActionButton
            label={`Approve ${name}'s request`}
            backgroundColor={colors.surface}
            disabled={busy}
            busy={busyAction === "approve"}
            busyColor={colors.accent}
            onPress={() => void runAction("approve")}
          >
            <Check size={19} color={colors.accent} />
          </ActionButton>
          <ActionButton
            label={`Deny ${name}'s request`}
            backgroundColor={colors.surface}
            disabled={busy}
            busy={busyAction === "deny"}
            busyColor={colors.danger}
            onPress={() => void runAction("deny")}
          >
            <X size={19} color={colors.danger} />
          </ActionButton>
        </>
      ) : null}
      {removal ? (
        <ActionButton
          label={`Remove ${name} from participants`}
          accessibilityHint="Opens a confirmation before removing this participant."
          backgroundColor={colors.surface}
          disabled={busy}
          busy={busyAction === "remove"}
          busyColor={colors.danger}
          onPress={() => void runAction("remove")}
        >
          <UserMinus size={19} color={colors.danger} />
        </ActionButton>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: error ? space.xs : 0 }}>
      {actions && !actions.reducedMotion ? (
        <Swipeable
          ref={swipeableRef}
          overshootLeft={false}
          overshootRight={false}
          leftThreshold={52}
          rightThreshold={52}
          friction={2}
          renderLeftActions={() => (
            <SwipeAction
              label="Approve"
              color={colors.accent}
              backgroundColor={colors.surface}
              disabled={busy}
              onPress={() => void runAction("approve")}
            >
              <Check size={19} color={colors.accent} />
            </SwipeAction>
          )}
          renderRightActions={() => (
            <SwipeAction
              label="Deny"
              color={colors.danger}
              backgroundColor={colors.surface}
              disabled={busy}
              onPress={() => void runAction("deny")}
            >
              <X size={19} color={colors.danger} />
            </SwipeAction>
          )}
        >
          {rowView}
        </Swipeable>
      ) : (
        rowView
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            color: colors.danger,
            ...type.caption,
            paddingHorizontal: space.sm,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ActionButton({
  label,
  accessibilityHint,
  backgroundColor,
  disabled,
  busy,
  busyColor,
  onPress,
  children,
}: {
  label: string;
  accessibilityHint?: string;
  backgroundColor: string;
  disabled: boolean;
  busy: boolean;
  busyColor: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.sm,
        backgroundColor,
        opacity: disabled ? 0.56 : pressed ? 0.74 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={busyColor} /> : children}
    </Pressable>
  );
}

function SwipeAction({
  label,
  color,
  backgroundColor,
  disabled,
  onPress,
  children,
}: {
  label: string;
  color: string;
  backgroundColor: string;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} request`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 76,
        minHeight: 60,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        backgroundColor,
        opacity: disabled ? 0.56 : pressed ? 0.74 : 1,
      })}
    >
      {children}
      <Text style={{ color, ...type.caption }}>{label}</Text>
    </Pressable>
  );
}
