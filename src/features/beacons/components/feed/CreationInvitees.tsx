import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import React, { useMemo, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { socialFriends } from "../../socialFriends";
import { SocialSelector } from "@/src/features/people/components/SocialSelector";

export function CreationInvitees({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, userId } = useBeacon();
  const { styles } = useTheme();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const friends = useMemo(
    () => socialFriends(data, userId, now),
    [data, userId, now],
  );
  const unavailable = ids.filter(
    (id) => !friends.some((friend) => friend.id === id),
  );
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {ids.slice(0, 3).map((id) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${friends.find((friend) => friend.id === id)?.name ?? "unavailable friend"}`}
            onPress={() => onChange(ids.filter((value) => value !== id))}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ProfileAvatar
              profile={data.profiles.find((person) => person.id === id)}
              size={30}
            />
            <Text
              accessible={false}
              style={[styles.muted, { position: "absolute", right: 0, top: 0 }]}
            >
              ×
            </Text>
          </Pressable>
        ))}
        {ids.length > 3 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Review all ${ids.length} invited people`}
            onPress={() => setOpen(true)}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Txt>+{ids.length - 3}</Txt>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            ids.length ? "Add or review people" : "+ Add People"
          }
          onPress={() => setOpen(true)}
          style={{
            minHeight: 44,
            paddingHorizontal: 8,
            justifyContent: "center",
          }}
        >
          <Text style={[styles.body, { fontWeight: "600" }]}>
            {ids.length ? "+ Add" : "+ Add People"}
          </Text>
        </Pressable>
        {ids.length ? <Txt muted>{ids.length}/20 selected</Txt> : null}
      </View>
      {unavailable.length ? (
        <Txt>
          {unavailable.length} selected friend(s) are no longer eligible. Review
          or remove them before publishing.
        </Txt>
      ) : null}
      <Sheet
        title="Edit selected friends"
        visible={open}
        onClose={() => setOpen(false)}
        footer={
          <View style={{ gap: 8 }}>
            <Txt muted>
              {ids.length}/20 selected · Invitations send when you publish.
            </Txt>
            <Button
              compact
              secondary
              title="Clear selection"
              onPress={() => onChange([])}
            />
            <Button title="Done" onPress={() => setOpen(false)} />
          </View>
        }
      >
        {selectionError ? <Txt>{selectionError}</Txt> : null}
        {unavailable.map((id) => (
          <Button
            key={id}
            compact
            secondary
            title="Remove unavailable friend"
            onPress={() => onChange(ids.filter((value) => value !== id))}
          />
        ))}
        {ids.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {ids.map((id) => (
              <Button
                key={id}
                compact
                secondary
                title={`Remove ${friends.find((friend) => friend.id === id)?.name ?? "unavailable friend"}`}
                onPress={() => onChange(ids.filter((value) => value !== id))}
              />
            ))}
          </View>
        )}
        <SocialSelector
          friends={friends}
          selected={ids.map((id) => ({ kind: "friend", id }))}
          onChange={(rows) => {
            const ids = rows
              .filter((row) => row.kind === "friend")
              .map((row) => row.id);
            if (ids.length > 20) {
              setSelectionError(
                "Choose up to 20 friends for this invitation batch.",
              );
              return;
            }
            setSelectionError("");
            onChange(ids);
          }}
          supportedKinds={["friend"]}
          bulk
        />
      </Sheet>
    </View>
  );
}
