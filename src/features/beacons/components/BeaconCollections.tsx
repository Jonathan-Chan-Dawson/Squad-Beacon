import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Bookmark, Star, X } from "lucide-react-native";
import { Sheet, Txt } from "@/src/shared/ui";
import { ActionRow } from "@/src/shared/ContextMenu";
import { useDesignTheme } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import {
  collectionTitles,
  personalCollections,
  type BeaconCollection,
} from "../personalCollections";
import { HomeAction } from "./HomeAction";
export function BeaconCollections({
  collection,
  onClose,
}: {
  collection: BeaconCollection | null;
  onClose: () => void;
}) {
  const { data, userId, act } = useBeacon();
  const { colors } = useDesignTheme();
  const [last, setLast] = useState<BeaconCollection>("saved");
  if (collection && collection !== last) setLast(collection);
  const kind = collection ?? last;
  const groups = personalCollections(data, userId);
  const entries =
    kind === "saved"
      ? groups.saved.map((row) => ({ id: row.id, label: row.title }))
      : kind === "friends"
        ? groups.friends.map((row) => ({ id: row.id, label: row.name }))
        : groups.squads.map((row) => ({ id: row.id, label: row.name }));
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const continuation = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      continuation.current = null;
    },
    [],
  );
  const open = (id: string) => {
    if (busy) return;
    continuation.current = () =>
      router.push(
        kind === "saved"
          ? { pathname: "/activity/[id]", params: { id } }
          : kind === "friends"
            ? { pathname: "/person/[id]", params: { id } }
            : { pathname: "/squad/[id]", params: { id } },
      );
    onClose();
  };
  const remove = async (id: string) => {
    if (lock.current || !entries.some((entry) => entry.id === id)) return;
    lock.current = true;
    setBusy(id);
    setError("");
    try {
      if (kind === "saved")
        await act("save_beacon", { activity_id: id, saved: false });
      else
        await act("favorite", {
          id,
          kind: kind === "friends" ? "friend" : "squad",
          add: false,
        });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update this collection.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  return (
    <Sheet
      title={collectionTitles[kind]}
      visible={!!collection}
      onClose={() => {
        if (!busy) onClose();
      }}
      onDismiss={() => {
        const next = continuation.current;
        continuation.current = null;
        next?.();
      }}
    >
      <Txt muted>
        {kind === "saved"
          ? "Beacons you’ve bookmarked."
          : kind === "friends"
            ? "Your private favorite friends."
            : "Your private favorite Squads."}
      </Txt>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      {!entries.length ? (
        <Txt muted>
          {kind === "saved"
            ? "Save a Beacon from its bookmark to find it here."
            : "Nothing favorited here yet."}
        </Txt>
      ) : null}
      {entries.map((entry) => (
        <View
          key={entry.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <ActionRow
              label={entry.label}
              icon={
                kind === "saved" ? (
                  <Bookmark size={18} color={colors.textSecondary} />
                ) : (
                  <Star size={18} color={colors.textSecondary} />
                )
              }
              disabled={!!busy}
              onPress={() => open(entry.id)}
            />
          </View>
          <HomeAction
            plain
            label={`${kind === "saved" ? "Unsave" : "Remove favorite"} ${entry.label}`}
            disabled={!!busy}
            onPress={() => void remove(entry.id)}
            icon={<X size={17} color={colors.textSecondary} />}
          />
        </View>
      ))}
    </Sheet>
  );
}
