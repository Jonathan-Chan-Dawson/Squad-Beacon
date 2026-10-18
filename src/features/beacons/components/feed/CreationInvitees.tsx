import React, { useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useDesignTheme } from "@/src/shared/design-system";
import { Button, Field, Sheet, Txt } from "@/src/shared/ui";
import { socialFriends, filterSocialFriends } from "../../socialFriends";

export function CreationInvitees({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, userId } = useBeacon();
  const now = useNow();
  const { colors, tokens } = useDesignTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const friends = useMemo(
    () => socialFriends(data, userId, now),
    [data, userId, now],
  );
  const rows = filterSocialFriends(friends, data, userId, {
    query,
    filter: "All",
    listId: null,
  });
  const unavailable = ids.filter(
    (id) => !friends.some((friend) => friend.id === id),
  );
  return (
    <View>
      <Button
        compact
        secondary
        title={`${ids.length} selected friends · Edit`}
        onPress={() => setOpen(true)}
      />
      <Sheet
        title="Edit selected friends"
        visible={open}
        onClose={() => setOpen(false)}
        scrollable={false}
      >
        <Field
          label="Search all friends"
          value={query}
          onChangeText={setQuery}
          placeholder="Friend name"
        />
        <Txt muted>
          {ids.length} selected · Invitations send when you publish.
        </Txt>
        {unavailable.map((id) => (
          <Button
            key={id}
            compact
            secondary
            title="Remove unavailable friend"
            onPress={() => onChange(ids.filter((value) => value !== id))}
          />
        ))}
        <View style={{ height: Math.max(120, Math.min(340, height - 540)) }}>
          <BottomSheetFlatList
            data={rows}
            extraData={ids}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Txt muted>No friends match.</Txt>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Invite ${item.name}`}
                aria-checked={ids.includes(item.id)}
                accessibilityState={{ checked: ids.includes(item.id) }}
                onPress={() =>
                  onChange(
                    ids.includes(item.id)
                      ? ids.filter((id) => id !== item.id)
                      : [...ids, item.id],
                  )
                }
                style={{
                  minHeight: 52,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 20 }}>
                  {ids.includes(item.id) ? "✓" : "○"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: colors.textPrimary,
                    ...tokens.type.secondary,
                  }}
                >
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        </View>
        <Button
          compact
          secondary
          title="Clear selection"
          onPress={() => onChange([])}
        />
        <Button title="Done" onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}
