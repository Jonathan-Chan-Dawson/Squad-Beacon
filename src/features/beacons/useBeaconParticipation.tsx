import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Check, CircleHelp, LogOut, X } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { Sheet, Txt } from "@/src/shared/ui";
import { ActionRow } from "@/src/shared/ContextMenu";
import { useDesignTheme } from "@/src/shared/design-system";
import { useNow } from "@/src/shared/useNow";
import { HomeAction } from "./components/HomeAction";
import {
  beaconParticipation,
  participationPayload,
  type ParticipationIntent,
} from "./participation";

type Operation = {
  busy: boolean;
  error: string;
  intent?: ParticipationIntent;
  requestId?: string;
  uncertain?: boolean;
  confirmed?: boolean;
};
const idle: Operation = { busy: false, error: "" };
const operations = new Map<string, Operation>();
const listeners = new Set<() => void>();
function update(key: string, value: Operation) {
  operations.set(key, value);
  listeners.forEach((listener) => listener());
}
export function useBeaconParticipation(id: string) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const { colors } = useDesignTheme();
  const now = useNow();
  const latest = useRef({ data, userId, act, getViewerEpoch, id });
  useLayoutEffect(() => {
    latest.current = { data, userId, act, getViewerEpoch, id };
  }, [data, userId, act, getViewerEpoch, id]);
  const key = `${userId}:${id}`;
  const operation = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => operations.get(key) ?? idle,
    () => idle,
  );
  const state = beaconParticipation(data, userId, id, now);
  const [choicesKey, setChoicesKey] = useState<string | null>(null);
  const choices = choicesKey === key;
  const setChoices = (open: boolean) => setChoicesKey(open ? key : null);
  const [confirmationState, setConfirmationState] = useState<{
    key: string;
    intent: ParticipationIntent;
  } | null>(null);
  const confirmation =
    confirmationState?.key === key ? confirmationState.intent : null;
  const setConfirmation = (intent: ParticipationIntent | null) =>
    setConfirmationState(intent ? { key, intent } : null);
  const continuation = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      continuation.current = null;
    },
    [key],
  );
  const perform = async (
    intent: ParticipationIntent,
    confirmed = false,
  ): Promise<boolean> => {
    const current = latest.current;
    if (current.userId !== userId || current.id !== id) return false;
    const existing = operations.get(key) ?? idle;
    if (existing.busy) return false;
    if (existing.uncertain && existing.intent !== intent) {
      update(key, {
        ...existing,
        error: "Retry the previous response before changing it.",
      });
      return false;
    }
    const canonical = beaconParticipation(current.data, current.userId, id);
    if (!canonical?.allowed.includes(intent)) {
      // An ambiguous reply may already have committed. Retrying its same request
      // is safe even when the canonical response has moved to the result state.
      if (!existing.uncertain) {
        update(key, {
          ...idle,
          error:
            "Your response or access changed. Refresh and review this Beacon.",
        });
        return false;
      }
    }
    if (
      !confirmed &&
      canonical?.going &&
      (intent === "leave" || intent === "maybe") &&
      canonical.reasons.length
    ) {
      setConfirmation(intent);
      return false;
    }
    const requestId = existing.uncertain ? existing.requestId! : randomUUID();
    const epoch = current.getViewerEpoch();
    update(key, { busy: true, error: "", intent, requestId, confirmed });
    try {
      await current.act("rsvp", participationPayload(id, intent), requestId);
      if (
        latest.current.userId !== userId ||
        current.getViewerEpoch() !== epoch
      )
        return false;
      update(key, idle);
      return true;
    } catch (failure) {
      const definitive =
        (failure as { definitive?: boolean })?.definitive === true;
      update(key, {
        busy: false,
        intent,
        requestId,
        uncertain: !definitive,
        confirmed,
        error:
          failure instanceof Error
            ? failure.message
            : "Could not update your response. Try again.",
      });
      return false;
    } finally {
      if (operations.get(key)?.busy)
        update(key, { ...operations.get(key)!, busy: false });
    }
  };
  const afterChoices = (action: () => void) => {
    continuation.current = action;
    setChoices(false);
  };
  const dialogs = (
    <>
      <Sheet
        title="Your RSVP"
        visible={choices && !!state}
        onClose={() => setChoices(false)}
        onDismiss={() => {
          const action = continuation.current;
          continuation.current = null;
          action?.();
        }}
      >
        <Txt>{state?.primary}</Txt>
        <ParticipationActions
          state={state}
          busy={operation.busy}
          onPerform={perform}
          after={afterChoices}
        />
      </Sheet>
      <Sheet
        title={confirmation === "maybe" ? "Change to Maybe?" : "Leave Beacon?"}
        visible={!!confirmation && !!state}
        onClose={() => setConfirmation(null)}
      >
        {state?.reasons.map((reason) => (
          <Txt key={reason}>{reason}</Txt>
        ))}
        <Txt muted>Rejoining depends on access and available places.</Txt>
        <HomeAction
          title={confirmation === "maybe" ? "Change to Maybe" : "Leave Beacon"}
          primary
          disabled={operation.busy}
          onPress={() => {
            const intent = confirmation!;
            setConfirmation(null);
            void perform(intent, true);
          }}
        />
        <HomeAction
          title="Keep my response"
          onPress={() => setConfirmation(null)}
        />
      </Sheet>
    </>
  );
  const feedback = operation.error ? (
    <View>
      <Text
        accessibilityRole="alert"
        style={{ color: colors.danger, fontSize: 12 }}
      >
        {operation.error}
      </Text>
      {operation.intent ? (
        <HomeAction
          title="Retry response"
          onPress={() => {
            void perform(operation.intent!, operation.confirmed === true);
          }}
          disabled={operation.busy}
        />
      ) : null}
    </View>
  ) : null;
  return {
    state,
    operation,
    perform,
    dialogs,
    feedback,
    openChoices: () => setChoices(true),
  };
}
export type ParticipationController = ReturnType<typeof useBeaconParticipation>;

export function ParticipationButtons({
  controller,
  onOpen,
  stretch = false,
  showMaybe = true,
}: {
  controller: ParticipationController;
  onOpen: () => void;
  stretch?: boolean;
  showMaybe?: boolean;
}) {
  const { state, operation, perform, openChoices } = controller;
  if (!state) return null;
  const primaryEnabled =
    state.hosting || state.choices || state.allowed.includes("join");
  return (
    <View style={{ flex: stretch ? 1 : undefined, minWidth: 0, gap: 2 }}>
      {showMaybe && state.invitationPair && state.allowed.includes("maybe") ? (
        <View style={{ alignSelf: "flex-start" }}>
          <HomeAction
            title="Maybe"
            plain
            disabled={operation.busy}
            onPress={() => {
              void perform("maybe");
            }}
          />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <View style={{ flex: stretch ? 1 : undefined, minWidth: 88 }}>
          <HomeAction
            title={operation.busy ? "Updating…" : state.primary}
            label={state.primary}
            stretch={stretch}
            primary={!state.choices && primaryEnabled}
            disabled={operation.busy || !primaryEnabled}
            onPress={() =>
              state.hosting
                ? onOpen()
                : state.choices
                  ? openChoices()
                  : void perform("join")
            }
          />
        </View>
        {state.invitationPair ? (
          <View style={{ flex: stretch ? 1 : undefined, minWidth: 88 }}>
            <HomeAction
              title="I’m Out"
              stretch={stretch}
              disabled={operation.busy}
              onPress={() => {
                void perform("decline");
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function BeaconParticipation({
  activityId,
  onOpen,
  stretch = false,
}: {
  activityId: string;
  onOpen: () => void;
  stretch?: boolean;
}) {
  const controller = useBeaconParticipation(activityId);
  return (
    <View style={{ flex: stretch ? 1 : undefined, minWidth: 0 }}>
      <ParticipationButtons
        controller={controller}
        onOpen={onOpen}
        stretch={stretch}
      />
      {controller.feedback}
      {controller.dialogs}
    </View>
  );
}

export function ParticipationActions({
  state,
  busy,
  onPerform,
  after,
  omitJoin = false,
}: {
  state: ReturnType<typeof beaconParticipation>;
  busy: boolean;
  onPerform: (intent: ParticipationIntent) => Promise<boolean>;
  after: (action: () => void) => void;
  omitJoin?: boolean;
}) {
  const { colors } = useDesignTheme();
  return (
    <>
      {state?.allowed
        .filter((intent) => !omitJoin || intent !== "join")
        .map((intent) => {
          const label =
            intent === "join"
              ? state.row?.status === "invited"
                ? "I’m In"
                : state.request
                  ? "Request to Join"
                  : "Join"
              : intent === "maybe"
                ? "Maybe"
                : intent === "decline"
                  ? "Can’t Go"
                  : intent === "leave"
                    ? "Leave Beacon"
                    : intent === "cancel_request"
                      ? "Cancel request"
                      : "Remove Maybe";
          const Icon =
            intent === "leave"
              ? LogOut
              : ["decline", "cancel_request", "remove_maybe"].includes(intent)
                ? X
                : intent === "maybe"
                  ? CircleHelp
                  : Check;
          return (
            <ActionRow
              key={intent}
              label={label}
              icon={<Icon size={18} color={colors.textSecondary} />}
              disabled={busy}
              onPress={() =>
                after(() => {
                  void onPerform(intent);
                })
              }
            />
          );
        })}
    </>
  );
}
