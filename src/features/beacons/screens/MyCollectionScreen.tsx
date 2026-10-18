import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  Bookmark,
  CalendarDays,
  ChevronRight,
  FolderOpen,
  LayoutTemplate,
  Star,
  UsersRound,
  X,
} from "lucide-react-native";
import { Screen, Button, Empty, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { useDesignTheme, Skeleton } from "@/src/shared/design-system";
import { personalCollections, collectionTitles } from "../personalCollections";
import { SavedBeaconArtwork } from "../components/SavedBeaconArtwork";

export default function MyCollectionScreen() {
  const { data, userId, loading, act } = useBeacon();
  const { colors } = useDesignTheme();
  const { styles } = useTheme();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = ["saved", "friends", "squads", "templates"].includes(
    params.section ?? "",
  )
    ? params.section
    : undefined;
  const groups = personalCollections(data, userId);
  const mutationLock = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const templates =
    data.viewer_id === userId
      ? data.templates.filter((row) => row.owner_id === userId)
      : [];
  const kind =
    section === "saved" || section === "friends" || section === "squads"
      ? section
      : null;
  const title = kind
    ? collectionTitles[kind]
    : section === "templates"
      ? "My Templates"
      : "My Collection";
  const recent = [...groups.saved].sort((a, b) => {
    const date = (id: string) =>
      data.beacon_favorites.find(
        (row) => row.owner_id === userId && row.activity_id === id,
      )?.created_at ?? "";
    return date(b.id).localeCompare(date(a.id));
  });
  const mutate = async (
    id: string,
    action: string,
    payload: Record<string, string | boolean>,
  ) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(id);
    setError("");
    try {
      await act(action, payload);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update your collection.",
      );
    } finally {
      mutationLock.current = false;
      setBusy(null);
    }
  };
  const destinations = [
    {
      label: "Saved Beacons",
      detail: `${groups.saved.length} saved`,
      icon: Bookmark,
      section: "saved",
    },
    {
      label: "My Plans",
      detail: "Your upcoming sequences",
      icon: CalendarDays,
      path: "/plans" as const,
    },
    {
      label: "Favorite Friends",
      detail: `${groups.friends.length} favorites`,
      icon: Star,
      section: "friends",
    },
    {
      label: "Favorite Squads",
      detail: `${groups.squads.length} favorites`,
      icon: UsersRound,
      section: "squads",
    },
    {
      label: "My Templates",
      detail: `${templates.length} ready to reuse`,
      icon: LayoutTemplate,
      section: "templates",
    },
    {
      label: "Library",
      detail: "Checklists, notes & resources",
      icon: FolderOpen,
      path: "/library" as const,
    },
  ];
  const savedCard = (
    activity: (typeof groups.saved)[number],
    removable = false,
  ) => (
    <View
      key={activity.id}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${activity.title}`}
        onPress={() =>
          router.push({
            pathname: "/activity/[id]",
            params: { id: activity.id },
          })
        }
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          padding: 12,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <SavedBeaconArtwork activity={activity} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            numberOfLines={2}
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {activity.title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {activity.category} ·{" "}
            {new Date(activity.starts_at).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      </Pressable>
      {removable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Unsave ${activity.title}`}
          disabled={!!busy}
          onPress={() =>
            void mutate(activity.id, "save_beacon", {
              activity_id: activity.id,
              saved: false,
            })
          }
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
  return (
    <Screen
      title={title}
      eyebrow="BEACONS"
      compactHeader
      scrollStateKey={section ?? "collection"}
    >
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      {loading ? (
        <>
          <Skeleton height={82} />
          <Skeleton height={82} />
          <Skeleton height={82} />
        </>
      ) : (
        <>
          {!section && (
            <>
              <View style={{ paddingVertical: 8, gap: 8 }}>
                <Text style={[styles.h2, { fontSize: 26 }]}>
                  Keep the good stuff close.
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    lineHeight: 21,
                  }}
                >
                  Your saved places to be, favorite people, and ideas for next
                  time.
                </Text>
              </View>
              <View
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {destinations.map(
                  ({ label, detail, icon: Icon, section: target, path }) => (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      onPress={() =>
                        path
                          ? router.push(path)
                          : router.push(
                              `/my-collection?section=${target}` as Href,
                            )
                      }
                      style={({ pressed }) => ({
                        minHeight: 72,
                        paddingHorizontal: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Icon size={21} color={colors.accent} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontSize: 15,
                            fontWeight: "600",
                          }}
                        >
                          {label}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          {detail}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </Pressable>
                  ),
                )}
              </View>
              <Text accessibilityRole="header" style={styles.h2}>
                Recently Saved
              </Text>
              {recent.length ? (
                recent.slice(0, 4).map((row) => savedCard(row))
              ) : (
                <Empty
                  title="A little inspiration, saved"
                  body="Bookmark a Beacon and it will be waiting here."
                />
              )}
            </>
          )}
          {kind === "saved" &&
            (recent.length ? (
              recent.map((row) => savedCard(row, true))
            ) : (
              <Empty
                title="No Saved Beacons Yet"
                body="Use the bookmark on any Beacon to keep it here."
              />
            ))}
          {(kind === "friends" || kind === "squads") && (
            <>
              {!groups[kind].length && (
                <Empty
                  title="No Favorites Yet"
                  body="Add favorites from a friend or Squad’s page."
                />
              )}
              {groups[kind].map((row) => (
                <View
                  key={row.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${row.name}`}
                    onPress={() =>
                      router.push({
                        pathname:
                          kind === "friends" ? "/person/[id]" : "/squad/[id]",
                        params: { id: row.id },
                      })
                    }
                    style={{
                      flex: 1,
                      minHeight: 64,
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <Star size={20} color={colors.accent} />
                    <Text style={{ color: colors.textPrimary, flex: 1 }}>
                      {row.name}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove favorite ${row.name}`}
                    disabled={!!busy}
                    onPress={() =>
                      void mutate(row.id, "favorite", {
                        id: row.id,
                        kind: kind === "friends" ? "friend" : "squad",
                        add: false,
                      })
                    }
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </>
          )}
          {section === "templates" && (
            <>
              <Button
                title="New Template"
                onPress={() =>
                  router.push({
                    pathname: "/create",
                    params: { editTemplate: "yes" },
                  })
                }
              />
              {!templates.length && (
                <Empty
                  title="Start With Something You Love"
                  body="Save a regular coffee, study session, or game as a template."
                />
              )}
              {templates.map((row) => (
                <View key={row.id} style={[styles.card, { gap: 10 }]}>
                  <Text style={styles.h2}>{row.name}</Text>
                  <Text style={styles.muted}>
                    {row.title} · {row.minutes} min
                  </Text>
                  <Button
                    title={`Use ${row.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/create",
                        params: { template: row.id },
                      })
                    }
                  />
                  <Button
                    secondary
                    title={`Edit ${row.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/create",
                        params: { template: row.id, editTemplate: "yes" },
                      })
                    }
                  />
                  <Button
                    secondary
                    disabled={!!busy}
                    title={`Delete ${row.name}`}
                    onPress={() =>
                      void mutate(row.id, "delete_template", { id: row.id })
                    }
                  />
                </View>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
