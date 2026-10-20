import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Sheet, Txt } from "@/src/shared/ui";
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
  const now = useNow();
  const [open, setOpen] = useState(false);
  const friends = useMemo(
    () => socialFriends(data, userId, now),
    [data, userId, now],
  );
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
        footer={
          <View style={{ gap: 8 }}>
            <Txt muted>
              {ids.length} selected · Invitations send when you publish.
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
          onChange={(rows) =>
            onChange(
              rows.filter((row) => row.kind === "friend").map((row) => row.id),
            )
          }
          supportedKinds={["friend"]}
          bulk
        />
      </Sheet>
    </View>
  );
}
