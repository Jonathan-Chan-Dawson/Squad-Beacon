import React, { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { Field, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { CommunityAvatar } from "./CommunityAvatar";
import { PrivateListAvatar } from "./PrivateListAvatar";
import { filteredFriendIds } from "../friendGroupFilters";
import {
  recipientCategory,
  recipientKey,
  selectableSocialGroups,
  type SocialRecipient,
} from "../socialSelection";

type Category =
  | "Friends"
  | "Favorites"
  | "Private Lists"
  | "Squads"
  | "Organizations"
  | "Networks"
  | "Selected";
export function FriendFilterSelector({
  selected,
  onChange,
  disabled = false,
}: {
  selected: SocialRecipient[];
  onChange(rows: SocialRecipient[]): void;
  disabled?: boolean;
}) {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Friends");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const groups = selectableSocialGroups(data, userId);
  const lists =
    data.viewer_id === userId
      ? data.lists.filter((l) => l.owner_id === userId)
      : [];
  const group = groups.find((g) => recipientKey(g) === groupKey);
  const list = lists.find((l) => `list:${l.id}` === groupKey);
  const selectedIds = selected
    .filter((r) => r.kind === "friend")
    .map((r) => r.id);
  const ids = filteredFriendIds(data, userId, {
    list:
      category === "Favorites"
        ? "favorites"
        : category === "Private Lists" && groupKey
          ? `custom:${groupKey.slice(5)}`
          : "friends",
    group:
      groupKey && category !== "Private Lists"
        ? (group ?? { kind: "squad", id: "unavailable" })
        : null,
    selected: category === "Selected" ? selectedIds : undefined,
  });
  const isDirectory =
    ["Private Lists", "Squads", "Organizations", "Networks"].includes(
      category,
    ) && !groupKey;
  const search = query.trim().toLocaleLowerCase();
  const people = data.profiles
    .filter(
      (p) =>
        ids.has(p.id) &&
        `${p.name} ${p.username}`.toLocaleLowerCase().includes(search),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const categories: Category[] = [
    "Friends",
    "Favorites",
    ...(lists.length ? ["Private Lists" as const] : []),
    ...(["Squads", "Organizations", "Networks"] as const).filter((c) =>
      groups.some((g) => recipientCategory[g.kind] === c),
    ),
  ];
  const changeCategory = (next: Category) => {
    setCategory(next);
    setGroupKey(null);
    setQuery("");
  };
  const directory =
    category === "Private Lists"
      ? lists
          .filter((l) => l.name.toLocaleLowerCase().includes(search))
          .map((l) => ({
            key: `list:${l.id}`,
            name: l.name,
            icon: <PrivateListAvatar id={l.id} name={l.name} />,
          }))
      : groups
          .filter(
            (g) =>
              recipientCategory[g.kind] === category &&
              g.name.toLocaleLowerCase().includes(search),
          )
          .map((g) => ({
            key: recipientKey(g),
            name: g.name,
            icon: (
              <CommunityAvatar
                type={g.kind}
                size={36}
                iconKey={
                  g.kind === "squad"
                    ? data.squads.find((s) => s.id === g.id)?.icon_key
                    : undefined
                }
              />
            ),
          }));
  return (
    <View testID="social-selector" style={{ gap: 8 }}>
      <Field
        label="Search people and groups"
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        placeholder={isDirectory ? "Search groups" : "Search friends"}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={c}
            accessibilityState={{ selected: category === c, disabled }}
            disabled={disabled}
            onPress={() => changeCategory(c)}
            style={{
              minWidth: 44,
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 12,
              borderBottomWidth: 2,
              borderBottomColor: category === c ? colors.green : "transparent",
            }}
          >
            <Text
              style={{
                color: category === c ? colors.green : colors.muted,
                fontSize: 14,
              }}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selected · ${selectedIds.length}`}
        accessibilityState={{ selected: category === "Selected", disabled }}
        disabled={disabled}
        onPress={() =>
          changeCategory(category === "Selected" ? "Friends" : "Selected")
        }
        style={{
          minHeight: 44,
          justifyContent: "center",
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ color: colors.green, fontSize: 13 }}>
          Selected · {selectedIds.length}
        </Text>
      </Pressable>
      {groupKey && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to groups"
          disabled={disabled}
          onPress={() => {
            setGroupKey(null);
            setQuery("");
          }}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <ChevronLeft size={18} color={colors.muted} />
          <Text style={[styles.body, { flex: 1 }]}>
            {group?.name ?? list?.name ?? "Group unavailable"}
          </Text>
        </Pressable>
      )}
      {selectedIds.length >= 50 && (
        <Text style={styles.muted}>
          Choose up to 50 friends. Remove someone to add another.
        </Text>
      )}
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 280 }}
      >
        {isDirectory
          ? directory.map((g) => (
              <Pressable
                key={g.key}
                accessibilityRole="button"
                accessibilityLabel={`Filter friends in ${g.name}`}
                disabled={disabled}
                onPress={() => {
                  setGroupKey(g.key);
                  setQuery("");
                }}
                style={{
                  minHeight: 60,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                }}
              >
                {g.icon}
                <Text style={[styles.body, { flex: 1 }]}>{g.name}</Text>
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            ))
          : people.map((person) => {
              const checked = selectedIds.includes(person.id);
              const rowDisabled =
                disabled || (!checked && selectedIds.length >= 50);
              const togglePerson = () => {
                if (rowDisabled) return;
                onChange(
                  checked
                    ? selected.filter(
                        (r) => r.kind === "friend" && r.id !== person.id,
                      )
                    : [
                        ...selected.filter((r) => r.kind === "friend"),
                        { kind: "friend", id: person.id },
                      ],
                );
              };
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Share location with ${person.name}`}
                  accessibilityState={{ checked, disabled: rowDisabled }}
                  disabled={rowDisabled}
                  aria-checked={checked}
                  onPress={togglePerson}
                  {...(Platform.OS === "web"
                    ? {
                        onKeyDown: (
                          event: React.KeyboardEvent<HTMLElement>,
                        ) => {
                          if (event.key === " " || event.key === "Enter") {
                            event.preventDefault();
                            togglePerson();
                          }
                        },
                      }
                    : {})}
                  style={{
                    minHeight: 64,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.line,
                  }}
                >
                  <ProfileAvatar profile={person} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.body}>{person.name}</Text>
                    {!!person.username && (
                      <Text style={styles.muted}>@{person.username}</Text>
                    )}
                  </View>
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
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: checked
                          ? colors.green + "18"
                          : "transparent",
                      }}
                    >
                      {checked ? (
                        <Check size={16} color={colors.green} />
                      ) : (
                        <Plus size={16} color={colors.muted} />
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
        {(isDirectory ? !directory.length : !people.length) && (
          <Text style={[styles.muted, { paddingVertical: 16 }]}>
            {category === "Selected"
              ? "No selected friends match."
              : "No eligible friends or groups match."}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
