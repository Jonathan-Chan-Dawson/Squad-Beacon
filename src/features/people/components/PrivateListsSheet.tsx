import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MoreVertical, Star, Users, ChevronRight } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Button,
  Field,
  IconButton,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import { PrivateListAvatar } from "./PrivateListAvatar";
import {
  privateListName,
  selectListPeople,
  type PeopleListSelection,
} from "../privateLists";

export function PrivateListsSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: PeopleListSelection) => void;
}) {
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const current = !!userId && data.viewer_id === userId;
  const lists = current
    ? data.lists.filter((row) => row.owner_id === userId)
    : [];
  const people = selectListPeople(data, userId);
  const friends = data.profiles
    .filter((profile) => people.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      name:
        userId && canViewProfile(data, profile, userId)
          ? profile.name
          : "Friend",
      profile:
        userId && canViewProfile(data, profile, userId) ? profile : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const edited = lists.find((row) => row.id === editing);
  const select = (selection: PeopleListSelection) => {
    onClose();
    onSelect(selection);
  };
  function row(
    selection: PeopleListSelection,
    title: string,
    automatic = false,
  ) {
    const Icon = selection === "favorites" ? Star : Users;
    return (
      <View
        key={selection}
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filter chats by ${title}`}
          onPress={() => select(selection)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          {automatic ? (
            <Icon size={23} color={colors.green} />
          ) : (
            <PrivateListAvatar id={selection.slice(7)} name={title} size={32} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.body}>
              {title}
            </Text>
            <Text style={styles.muted}>
              {selectListPeople(data, userId, selection).size} friends
              {automatic ? " · Automatic" : ""}
            </Text>
          </View>
          <ChevronRight size={17} color={colors.muted} />
        </Pressable>
        {!automatic ? (
          <IconButton
            label={`Manage ${title}`}
            onPress={() => {
              setEditing(selection.slice(7));
              setName(title);
              setDeleting(false);
            }}
          >
            <MoreVertical size={20} color={colors.muted} />
          </IconButton>
        ) : null}
      </View>
    );
  }
  return (
    <>
      <Sheet
        title="Private Lists"
        visible={visible}
        onClose={onClose}
        maxHeightPercent={78}
      >
        <Txt muted>
          Organize your friends and chats. Only you can see these lists.
        </Txt>
        {row("favorites", "Favorites", true)}
        {row("friends", "Friends", true)}
        <View
          testID="private-lists-divider"
          style={[
            styles.between,
            {
              borderTopWidth: 1,
              borderTopColor: colors.line,
              marginTop: 8,
              paddingTop: 8,
            },
          ]}
        >
          <Text style={styles.label}>PRIVATE LISTS</Text>
          <Button
            compact
            secondary
            title="Create List"
            onPress={() => {
              setEditing("new");
              setName("");
              setDeleting(false);
            }}
          />
        </View>
        {lists.map((list) => row(`custom:${list.id}`, list.name))}
      </Sheet>
      <Sheet
        title={
          editing === "new"
            ? "Create private list"
            : `Manage ${edited?.name ?? "list"}`
        }
        visible={!!editing && (editing === "new" || !!edited)}
        onClose={() => setEditing(null)}
      >
        <Field
          label="List name"
          value={name}
          onChangeText={setName}
          maxLength={50}
        />
        <Action
          title={editing === "new" ? "Create" : "Save name"}
          run={async () => {
            await act(editing === "new" ? "create_list" : "rename_list", {
              id: editing,
              name: privateListName(name),
            });
            if (editing === "new") setEditing(null);
          }}
        />
        {edited ? (
          <>
            <Txt muted>
              Selecting this list only filters Chats. Changing its members also
              updates sharing wherever you already use this list as an audience.
            </Txt>
            {friends.map((profile) => {
              const added = data.list_members.some(
                (row) =>
                  row.list_id === edited.id && row.user_id === profile.id,
              );
              return (
                <View
                  key={profile.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <ProfileAvatar profile={profile.profile} size={32} />
                  <View style={{ flex: 1 }}>
                    <Action
                      secondary
                      title={`${added ? "Remove" : "Add"} ${profile.name}`}
                      run={() =>
                        act("list_member", {
                          id: edited.id,
                          user_id: profile.id,
                          add: !added,
                        })
                      }
                    />
                  </View>
                </View>
              );
            })}
            {deleting ? (
              <>
                <Txt>
                  Delete this list? Lists still used for sharing must be removed
                  from those audiences first.
                </Txt>
                <Action
                  title="Confirm delete list"
                  run={async () => {
                    await act("delete_list", { id: edited.id });
                    setEditing(null);
                    setDeleting(false);
                  }}
                />
                <Button
                  secondary
                  title="Cancel deletion"
                  onPress={() => setDeleting(false)}
                />
              </>
            ) : (
              <Button
                secondary
                title="Delete list"
                onPress={() => setDeleting(true)}
              />
            )}
          </>
        ) : null}
      </Sheet>
    </>
  );
}
