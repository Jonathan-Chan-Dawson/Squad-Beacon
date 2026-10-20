import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Check, Plus } from "lucide-react-native";
import { CommunityAvatar } from "./CommunityAvatar";
import { useBeacon } from "@/src/shared/store";
import { Button, Field, useTheme } from "@/src/shared/ui";
import { matchesSearch } from "@/src/shared/search";
import type { SocialFriend } from "@/src/features/beacons/socialFriends";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { selectListPeople, type PeopleListSelection } from "../privateLists";
import { PrivateListsSheet } from "./PrivateListsSheet";
import { PrivateListAvatar } from "./PrivateListAvatar";
import {
  addShownRecipients,
  recipientCategory,
  recipientKey,
  selectableSocialGroups,
  socialCategories,
  undoShownRecipients,
  type RecipientKind,
  type SocialCategory,
  type SocialRecipient,
} from "../socialSelection";

/** Callers own selection and submission semantics; group membership is never expanded. */
export function SocialSelector({
  friends = [],
  selected,
  onChange,
  supportedKinds,
  multiple = true,
  bulk = false,
  renderFriend,
  renderFriendRows = true,
  onVisibleFriendIdsChange,
  eligibleGroupKeys,
  query: controlledQuery,
  onQueryChange,
  onCategoryChange,
  initialCategory = "All",
  list: controlledList,
  onListChange,
}: {
  friends?: SocialFriend[];
  selected: SocialRecipient[];
  onChange: (rows: SocialRecipient[]) => void;
  supportedKinds: readonly RecipientKind[];
  multiple?: boolean;
  bulk?: boolean;
  renderFriend?: (friend: SocialFriend) => React.ReactNode;
  renderFriendRows?: boolean;
  onVisibleFriendIdsChange?: (ids: string[]) => void;
  eligibleGroupKeys?: readonly string[];
  query?: string;
  onQueryChange?: (value: string) => void;
  onCategoryChange?: (value: SocialCategory) => void;
  initialCategory?: SocialCategory;
  list?: PeopleListSelection;
  onListChange?: (value: PeopleListSelection) => void;
}) {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const [localQuery, setLocalQuery] = useState("");
  const query = controlledQuery ?? localQuery;
  const setQuery = (value: string) => {
    setLocalQuery(value);
    onQueryChange?.(value);
  };
  const [category, updateCategory] = useState<SocialCategory>(initialCategory);
  const setCategory = (value: SocialCategory) => {
    updateCategory(value);
    onCategoryChange?.(value);
  };
  const [localList, setLocalList] = useState<PeopleListSelection>("friends");
  const list = controlledList ?? localList;
  const setList = (value: PeopleListSelection) => {
    setLocalList(value);
    onListChange?.(value);
  };
  const [manage, setManage] = useState(false);
  const [undoKeys, setUndoKeys] = useState<string[]>([]);
  const rail = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const [railWidth, setRailWidth] = useState(0);
  useEffect(() => {
    const layout = layouts.current[category];
    if (layout)
      rail.current?.scrollTo({
        x: Math.max(0, layout.x + layout.width / 2 - railWidth / 2),
        animated: true,
      });
  }, [category, railWidth]);
  const lists =
    data.viewer_id === userId
      ? data.lists
          .filter((row) => row.owner_id === userId)
          .sort(
            (a, b) =>
              Number(b.name.toLowerCase() === "close friends") -
                Number(a.name.toLowerCase() === "close friends") ||
              a.name.localeCompare(b.name),
          )
      : [];
  const effectiveList =
    list.startsWith("custom:") &&
    !lists.some((row) => `custom:${row.id}` === list)
      ? "friends"
      : list;
  const eligible = selectListPeople(
    data,
    userId,
    category === "Friends" ? effectiveList : "friends",
  );
  const visibleFriends =
    category === "All" || category === "Friends"
      ? friends.filter(
          (friend) =>
            eligible.has(friend.id) && matchesSearch(query, friend.name),
        )
      : [];
  const visibleKey = visibleFriends.map((row) => row.id).join("\u0000");
  useEffect(() => {
    onVisibleFriendIdsChange?.(visibleKey ? visibleKey.split("\u0000") : []);
  }, [visibleKey, onVisibleFriendIdsChange]);
  const groups = selectableSocialGroups(data, userId).filter(
    (row) =>
      (!eligibleGroupKeys || eligibleGroupKeys.includes(recipientKey(row))) &&
      (category === "All" || recipientCategory[row.kind] === category) &&
      matchesSearch(query, row.name),
  );
  const toggle = (row: SocialRecipient) => {
    if (!supportedKinds.includes(row.kind)) return;
    setUndoKeys((keys) => keys.filter((key) => key !== recipientKey(row)));
    onChange(
      selected.some((item) => recipientKey(item) === recipientKey(row))
        ? selected.filter((item) => recipientKey(item) !== recipientKey(row))
        : multiple
          ? [...selected, row]
          : [row],
    );
  };
  const tab = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      onPress={onPress}
      style={{
        flexShrink: 0,
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 12,
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.green : "transparent",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: active ? colors.green : colors.muted,
          fontSize: 14,
          fontWeight: active ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const control = (row: SocialRecipient) => {
    const checked = selected.some(
      (item) => recipientKey(item) === recipientKey(row),
    );
    return (
      <View
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: checked ? colors.green : colors.muted,
            backgroundColor: checked ? colors.green : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked ? (
            <Check size={16} color={colors.onPrimary} />
          ) : (
            <Plus size={16} color={colors.muted} />
          )}
        </View>
      </View>
    );
  };
  return (
    <View testID="social-selector" style={{ gap: 8 }}>
      <Field
        label="Search people and groups"
        placeholder="Search people and groups"
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView
        ref={rail}
        horizontal
        onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 6 }}
      >
        {socialCategories.map((value) => (
          <View
            key={value}
            onLayout={(event) => {
              layouts.current[value] = event.nativeEvent.layout;
            }}
          >
            {tab(value, category === value, () => setCategory(value))}
          </View>
        ))}
      </ScrollView>
      {category === "Friends" && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {tab("All Friends", effectiveList === "friends", () =>
              setList("friends"),
            )}
            {tab("Favorites", effectiveList === "favorites", () =>
              setList("favorites"),
            )}
          </ScrollView>
          <View
            testID="friends-private-lists"
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingTop: 4,
              gap: 4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={styles.muted}>Private Lists</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage Private Lists"
                onPress={() => setManage(true)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.green, fontSize: 13 }}>
                  Manage
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16 }}
            >
              {lists.map((row) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={row.name}
                  accessibilityState={{
                    selected: effectiveList === `custom:${row.id}`,
                  }}
                  aria-pressed={effectiveList === `custom:${row.id}`}
                  onPress={() => setList(`custom:${row.id}`)}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    flexShrink: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                    borderBottomWidth: 2,
                    borderBottomColor:
                      effectiveList === `custom:${row.id}`
                        ? colors.green
                        : "transparent",
                  }}
                >
                  <PrivateListAvatar id={row.id} name={row.name} />
                  <Text
                    style={{
                      color:
                        effectiveList === `custom:${row.id}`
                          ? colors.green
                          : colors.ink,
                      fontSize: 13,
                    }}
                  >
                    {row.name}
                  </Text>
                </Pressable>
              ))}
              {!lists.length && (
                <Text style={[styles.muted, { paddingVertical: 10 }]}>
                  No private lists yet.
                </Text>
              )}
            </ScrollView>
          </View>
        </>
      )}
      {(category === "All" || groups.length > 0) && (
        <Text style={styles.muted}>Your Groups</Text>
      )}
      {groups.map((row) => (
        <Pressable
          key={recipientKey(row)}
          accessibilityRole="checkbox"
          accessibilityLabel={`${row.name}, ${recipientCategory[row.kind]}`}
          accessibilityState={{
            checked: selected.some(
              (item) => recipientKey(item) === recipientKey(row),
            ),
            disabled: !supportedKinds.includes(row.kind),
          }}
          disabled={!supportedKinds.includes(row.kind)}
          onPress={() => toggle(row)}
          style={{
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            opacity: supportedKinds.includes(row.kind) ? 1 : 0.6,
          }}
        >
          <CommunityAvatar
            type={row.kind}
            size={36}
            iconKey={
              row.kind === "squad"
                ? data.squads.find((squad) => squad.id === row.id)?.icon_key
                : undefined
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.body}>{row.name}</Text>
            <Text style={styles.muted}>
              {recipientCategory[row.kind]}
              {!supportedKinds.includes(row.kind)
                ? " · Unavailable in this flow"
                : ""}
            </Text>
          </View>
          {control(row)}
        </Pressable>
      ))}
      {category === "All" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.muted}>Friends</Text>
          <Button
            compact
            secondary
            title="Private Lists"
            onPress={() => setCategory("Friends")}
          />
        </View>
      )}
      {bulk &&
        multiple &&
        supportedKinds.includes("friend") &&
        visibleFriends.length > 0 && (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              compact
              secondary
              title={`Select all shown (${visibleFriends.length})`}
              onPress={() => {
                const result = addShownRecipients(
                  selected,
                  visibleFriends.map((row) => ({ kind: "friend", id: row.id })),
                );
                setUndoKeys(result.addedKeys);
                onChange(result.selected);
              }}
            />
            {undoKeys.length > 0 && (
              <Button
                compact
                secondary
                title="Undo select all"
                onPress={() => {
                  onChange(undoShownRecipients(selected, undoKeys));
                  setUndoKeys([]);
                }}
              />
            )}
          </View>
        )}
      {renderFriendRows &&
        visibleFriends.map((friend) =>
          renderFriend ? (
            <React.Fragment key={friend.id}>
              {renderFriend(friend)}
            </React.Fragment>
          ) : (
            <Pressable
              key={friend.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`Select ${friend.name}`}
              accessibilityState={{
                checked: selected.some(
                  (row) => row.kind === "friend" && row.id === friend.id,
                ),
                disabled: !supportedKinds.includes("friend"),
              }}
              disabled={!supportedKinds.includes("friend")}
              onPress={() => toggle({ kind: "friend", id: friend.id })}
              style={{
                minHeight: 56,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
              }}
            >
              <ProfileAvatar
                profile={data.profiles.find((row) => row.id === friend.id)}
                size={36}
              />
              <Text numberOfLines={1} style={[styles.body, { flex: 1 }]}>
                {friend.name}
              </Text>
              {control({ kind: "friend", id: friend.id })}
            </Pressable>
          ),
        )}
      {!groups.length && !visibleFriends.length && (
        <Text style={styles.muted}>No matching people or groups.</Text>
      )}
      <PrivateListsSheet
        visible={manage}
        onClose={() => setManage(false)}
        onSelect={(value) => {
          setList(value);
          setCategory("Friends");
          setManage(false);
        }}
      />
    </View>
  );
}
