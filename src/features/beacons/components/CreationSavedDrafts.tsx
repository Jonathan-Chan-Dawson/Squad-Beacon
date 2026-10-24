import React, { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Sheet, Txt, useTheme } from "@/src/shared/ui";
import {
  discardCreationDraft,
  listCreationDraftSummaries,
  type CreationDraftSummary,
} from "../creationDraftStorage";

export function CreationSavedDrafts({ savedToken }: { savedToken?: string }) {
  const { userId, getViewerEpoch } = useBeacon();
  const { styles, colors } = useTheme();
  const [rows, setRows] = useState<CreationDraftSummary[]>([]),
    [notice, setNotice] = useState("");
  const [all, setAll] = useState(false);
  const [removing, setRemoving] = useState<{
    row: CreationDraftSummary;
    epoch: number;
  } | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!userId) return;
    const id = ++request.current,
      epoch = getViewerEpoch();
    try {
      const result = await listCreationDraftSummaries(userId);
      if (request.current === id && getViewerEpoch() === epoch) {
        setRows(result);
        setNotice(
          result.some((row) => row.status === "unavailable")
            ? "Some saved drafts could not be verified. Their data is protected."
            : "",
        );
      }
    } catch (error) {
      if (request.current === id && getViewerEpoch() === epoch)
        setNotice(
          error instanceof Error
            ? error.message
            : "Drafts could not be loaded. Retry without replacing saved data.",
        );
    }
  }, [userId, getViewerEpoch]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current++;
      };
    }, [load]),
  );
  function resume(row: CreationDraftSummary) {
    if (row.status === "unavailable") {
      setNotice(
        "This draft could not be verified. Its saved data is protected. Retry loading it before continuing.",
      );
      void load();
      return;
    }
    router.push({ pathname: "/create", params: { resumeDraft: row.token } });
  }
  function pill(row: CreationDraftSummary, full = false) {
    return (
      <View
        key={row.token}
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: full ? "100%" : 220,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.status === "recovery" ? "Resume recovery" : row.status === "unavailable" ? "Retry loading" : "Resume draft"}: ${row.title}`}
          onPress={() => resume(row)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            justifyContent: "center",
            paddingLeft: 12,
            paddingVertical: 6,
          }}
        >
          <Text
            numberOfLines={1}
            style={[styles.body, { fontSize: 13, fontWeight: "600" }]}
          >
            ✎ {row.title}
          </Text>
          {row.status !== "draft" ? (
            <Text style={[styles.muted, { fontSize: 11 }]}>
              {row.status === "recovery"
                ? "Recovery required"
                : "Unavailable · Retry"}
            </Text>
          ) : null}
        </Pressable>
        {row.status === "draft" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete draft: ${row.title}`}
            onPress={() => {
              setAll(false);
              setRemoving({ row, epoch: getViewerEpoch() });
            }}
            style={{
              minWidth: 44,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={styles.muted}>×</Text>
          </Pressable>
        ) : (
          <View style={{ width: 12 }} />
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {savedToken ? (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          Draft saved on this device
        </Text>
      ) : null}
      {notice ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {notice}
          </Text>
          <Button
            compact
            secondary
            title="Retry saved drafts"
            onPress={() => void load()}
          />
        </View>
      ) : null}
      {rows.length ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.label}>Saved Drafts</Text>
            {rows.length > 3 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all saved drafts"
                onPress={() => setAll(true)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Txt>See All ({rows.length})</Txt>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: 8,
              paddingVertical: 4,
              paddingHorizontal: 2,
            }}
          >
            {rows.slice(0, 3).map((row) => pill(row))}
          </ScrollView>
        </>
      ) : null}
      <Sheet
        title="Saved drafts"
        visible={all}
        onClose={() => setAll(false)}
        footer={<Button title="Done" onPress={() => setAll(false)} />}
      >
        {rows.map((row) => pill(row, true))}
      </Sheet>
      <Sheet
        title="Delete saved draft?"
        visible={!!removing}
        onClose={() => setRemoving(null)}
        footer={
          <Button
            secondary
            title="Keep draft"
            onPress={() => setRemoving(null)}
          />
        }
      >
        <Txt>Delete “{removing?.row.title}” from this device?</Txt>
        <Txt muted>
          This removes only this saved draft. It does not affect templates or
          published Beacons.
        </Txt>
        <Action
          title="Delete draft"
          run={async () => {
            if (!userId || !removing) return;
            const { row, epoch } = removing;
            await discardCreationDraft(
              userId,
              row.token,
              () => getViewerEpoch() === epoch,
            );
            if (getViewerEpoch() !== epoch) return;
            setRemoving(null);
            await load();
          }}
        />
      </Sheet>
    </View>
  );
}
