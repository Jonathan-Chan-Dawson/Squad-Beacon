import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { Button, Field, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { CommunityAvatar } from "./CommunityAvatar";
import { PrivateListAvatar } from "./PrivateListAvatar";
import { PrivateListsSheet } from "./PrivateListsSheet";
import { SocialChoiceRow } from "@/src/shared/SocialChoiceRow";
import { filteredFriendIds } from "../friendGroupFilters";
import {
  recipientCategory,
  recipientKey,
  selectableSocialGroups,
  type SocialRecipient,
} from "../socialSelection";
import type { PeopleListSelection } from "../privateLists";

type Category =
  | "Friends"
  | "Private Lists"
  | "Squads"
  | "Organizations"
  | "Networks"
  | "Selected";
/** Groups and lists are browsing filters. Only explicit person taps change recipients. */
export function FriendFilterSelector({
  selected,
  onChange,
  disabled = false,
  eligibleIds,
  maxSelected,
  selectionLabel = "Select",
  bulk = false,
}: {
  selected: SocialRecipient[];
  onChange(rows: SocialRecipient[]): void;
  disabled?: boolean;
  eligibleIds?: readonly string[];
  maxSelected?: number;
  selectionLabel?: string;
  bulk?: boolean;
}) {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Friends");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<PeopleListSelection>("friends");
  const [manage, setManage] = useState(false);
  const [shown, setShown] = useState(30);
  const groups = selectableSocialGroups(data, userId);
  const lists =
    data.viewer_id === userId
      ? data.lists.filter((row) => row.owner_id === userId)
      : [];
  const selectedIds = selected
    .filter((row) => row.kind === "friend")
    .map((row) => row.id);
  const group = groups.find((row) => recipientKey(row) === groupKey);
  const list = lists.find((row) => `list:${row.id}` === groupKey);
  const effectiveList =
    listFilter.startsWith("custom:") &&
    !lists.some((row) => `custom:${row.id}` === listFilter)
      ? "friends"
      : listFilter;
  const ids = filteredFriendIds(data, userId, {
    list:
      category === "Private Lists" && groupKey
        ? `custom:${groupKey.slice(5)}`
        : category === "Friends"
          ? effectiveList
          : "friends",
    group:
      groupKey && category !== "Private Lists"
        ? (group ?? { kind: "squad", id: "unavailable" })
        : null,
    selected: category === "Selected" ? selectedIds : undefined,
  });
  const search = query.trim().toLocaleLowerCase();
  const people = data.profiles
    .filter(
      (person) =>
        ids.has(person.id) &&
        (!eligibleIds || eligibleIds.includes(person.id)) &&
        `${person.name} ${person.username}`
          .toLocaleLowerCase()
          .includes(search),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const directoryMode =
    ["Private Lists", "Squads", "Organizations", "Networks"].includes(
      category,
    ) && !groupKey;
  const categories: Category[] = [
    "Friends",
    ...(["Squads", "Organizations", "Networks"] as const).filter((value) =>
      groups.some((row) => recipientCategory[row.kind] === value),
    ),
    "Selected",
  ];
  const changeCategory = (value: Category) => {
    setCategory(value);
    setGroupKey(null);
    setQuery("");
    setShown(30);
  };
  const tab = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 10,
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: active ? colors.lime : "transparent",
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.green : "transparent",
      }}
    >
      <Text
        style={{ color: active ? colors.green : colors.muted, fontSize: 14 }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const directory =
    category === "Private Lists"
      ? lists
          .filter((row) => row.name.toLocaleLowerCase().includes(search))
          .map((row) => ({
            key: `list:${row.id}`,
            name: row.name,
            icon: <PrivateListAvatar id={row.id} name={row.name} />,
          }))
      : groups
          .filter(
            (row) =>
              recipientCategory[row.kind] === category &&
              row.name.toLocaleLowerCase().includes(search),
          )
          .map((row) => ({
            key: recipientKey(row),
            name: row.name,
            icon: <CommunityAvatar type={row.kind} size={32} />,
          }));
  if (manage)
    return (
      <PrivateListsSheet
        inline
        visible
        onClose={() => setManage(false)}
        onSelect={(value) => {
          setListFilter(value);
          changeCategory("Friends");
          setManage(false);
        }}
      />
    );
  return (
    <View testID="social-selector" style={{ gap: 8 }}>
      <Field
        label="Search people and groups"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setShown(30);
        }}
        editable={!disabled}
        placeholder={directoryMode ? "Search groups" : "Search friends"}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 4 }}
      >
        {categories.map((value) =>
          tab(
            value === "Selected" ? `Selected · ${selectedIds.length}` : value,
            category === value,
            () => changeCategory(value),
          ),
        )}
      </ScrollView>
      {(category === "Friends" || category === "Private Lists") && (
        <View testID="friends-private-lists" style={{ gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.muted}>Friends filters · Private Lists</Text>
            <Button
              compact
              secondary
              title="Manage"
              accessibilityLabel="Manage Private Lists"
              disabled={disabled}
              onPress={() => setManage(true)}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {tab(
              "All Friends",
              category === "Friends" && effectiveList === "friends",
              () => {
                setListFilter("friends");
                changeCategory("Friends");
              },
            )}
            {tab(
              "Favorites",
              category === "Friends" && effectiveList === "favorites",
              () => {
                setListFilter("favorites");
                changeCategory("Friends");
              },
            )}
            {tab("Private Lists", category === "Private Lists", () =>
              changeCategory("Private Lists"),
            )}
            {lists.map((row) =>
              tab(
                row.name,
                category === "Friends" && effectiveList === `custom:${row.id}`,
                () => {
                  setListFilter(`custom:${row.id}`);
                  changeCategory("Friends");
                },
              ),
            )}
          </ScrollView>
        </View>
      )}
      {groupKey && (
        <Button
          compact
          secondary
          title={`Back to groups · ${group?.name ?? list?.name ?? "Unavailable"}`}
          accessibilityLabel="Back to groups"
          disabled={disabled}
          onPress={() => {
            setGroupKey(null);
            setQuery("");
          }}
        />
      )}
      <Text style={styles.muted}>
        {selectedIds.length} selected ·{" "}
        {directoryMode
          ? "Browse a group, then choose people individually."
          : `${people.length} eligible friends`}
      </Text>
      {maxSelected != null && selectedIds.length >= maxSelected && (
        <Text style={styles.muted}>
          Choose up to {maxSelected} friends. Remove someone to add another.
        </Text>
      )}
      {bulk && !directoryMode && people.length > 0 && (
        <Button
          compact
          secondary
          title="Add shown friends"
          disabled={disabled}
          onPress={() => {
            const next = new Set(selectedIds);
            for (const person of people.slice(0, shown)) {
              if (maxSelected != null && next.size >= maxSelected) break;
              next.add(person.id);
            }
            onChange([...next].map((id) => ({ kind: "friend", id })));
          }}
        />
      )}
      {directoryMode
        ? directory.slice(0, shown).map((row) => (
            <SocialChoiceRow
              key={row.key}
              label={row.name}
              accessibilityLabel={`Filter friends in ${row.name}`}
              icon={row.icon}
              browse
              disabled={disabled}
              detail="Browse eligible friends"
              onPress={() => {
                setGroupKey(row.key);
                setQuery("");
                setShown(30);
              }}
            />
          ))
        : people.slice(0, shown).map((person) => {
            const checked = selectedIds.includes(person.id);
            return (
              <SocialChoiceRow
                key={person.id}
                label={person.name}
                accessibilityLabel={`${selectionLabel} ${person.name}`}
                icon={<ProfileAvatar profile={person} size={32} />}
                selected={checked}
                disabled={
                  disabled ||
                  (!checked &&
                    maxSelected != null &&
                    selectedIds.length >= maxSelected)
                }
                onPress={() =>
                  onChange(
                    checked
                      ? selected.filter(
                          (row) =>
                            row.kind === "friend" && row.id !== person.id,
                        )
                      : [
                          ...selected.filter((row) => row.kind === "friend"),
                          { kind: "friend", id: person.id },
                        ],
                  )
                }
              />
            );
          })}
      {(directoryMode ? directory.length : people.length) > shown && (
        <Button
          compact
          secondary
          title="Show more"
          onPress={() => setShown((value) => value + 30)}
        />
      )}
      {(directoryMode ? !directory.length : !people.length) && (
        <Text style={[styles.muted, { paddingVertical: 12 }]}>
          No eligible friends or groups match. Try another filter.
        </Text>
      )}
    </View>
  );
}
