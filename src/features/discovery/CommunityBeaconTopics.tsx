import React, { useState } from "react";
import { Text, View } from "react-native";
import { Action, Button, Field, Sheet, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { ProfileSection } from "@/src/features/people/components/ProfilePrimitives";
import { CommunityActivityRow } from "@/src/features/social/CommunityActivityRow";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import type { SocialEntityType } from "@/src/features/social/types";
import { useCommunityTopics } from "./useCommunityTopics";

export function CommunityBeaconTopics({
  type,
  entity,
  manage = false,
  browse = true,
  selectedTopic,
  onSelectTopic,
}: {
  type: SocialEntityType;
  entity: string;
  manage?: boolean;
  browse?: boolean;
  selectedTopic?: string | null;
  onSelectTopic?: (id: string | null) => void;
}) {
  const { data, userId, act } = useBeacon();
  const { styles } = useTheme();
  const { rows } = useCommunityTopics(type, entity);
  const [editor, setEditor] = useState<{ id?: string; name: string } | null>(
    null,
  );
  const [managing, setManaging] = useState(false);
  const now = useNow();
  if (
    !userId ||
    data.viewer_id !== userId ||
    !data.capabilities?.beacon_topics ||
    (!rows.length && !manage)
  )
    return null;
  const viewer = userId;
  const topic = rows.find((row) => row.id === selectedTopic);
  const follow = data.beacon_topic_follows?.find(
    (row) => row.topic_id === topic?.id,
  );
  const matches = new Set(
    (data.beacon_topic_assignments ?? [])
      .filter((row) => row.topic_id === topic?.id)
      .map((row) => row.activity_id),
  );
  const upcoming = topic
    ? data.activities.filter(
        (row) =>
          matches.has(row.id) &&
          row.status === "scheduled" &&
          Date.parse(row.ends_at) > now &&
          canReadBeaconActivity(data, row, viewer),
      )
    : [];
  const scope = {
    entity_type: type,
    entity_id: entity,
    expected_actor_id: viewer,
  };
  return (
    <>
      {browse && rows.length ? (
        <ProfileSection title="Beacon Topics">
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            <Button
              compact
              secondary={!!topic}
              title="All Beacons"
              onPress={() => onSelectTopic?.(null)}
            />
            {rows.map((row) => (
              <Button
                key={row.id}
                compact
                secondary={row.id !== topic?.id}
                title={row.name}
                onPress={() => onSelectTopic?.(row.id)}
              />
            ))}
          </View>
          {topic && (
            <>
              <Action
                compact
                secondary
                title={follow ? "Unfollow" : "Follow"}
                run={async () => {
                  await act(
                    follow ? "unfollow_beacon_topic" : "follow_beacon_topic",
                    {
                      ...scope,
                      beacon_topic_id: topic.id,
                      follow_id: follow?.id,
                    },
                  );
                }}
              />
              {upcoming.map((activity) => (
                <CommunityActivityRow activity={activity} key={activity.id} />
              ))}
              {!upcoming.length && (
                <Text style={styles.muted}>
                  No upcoming Beacons in this topic.
                </Text>
              )}
            </>
          )}
        </ProfileSection>
      ) : null}
      {manage && (
        <Button
          compact
          secondary
          title="Manage Topics"
          onPress={() => setManaging(true)}
        />
      )}
      {manage && (
        <Sheet
          title="Manage Topics"
          visible={managing}
          onClose={() => {
            setManaging(false);
            setEditor(null);
          }}
        >
          {editor ? (
            <>
              <Field
                label="Topic name"
                value={editor.name}
                maxLength={40}
                onChangeText={(name) => setEditor({ ...editor, name })}
              />
              <Action
                title="Save topic"
                disabled={!editor.name.trim()}
                run={async () => {
                  await act("save_beacon_topic", {
                    ...scope,
                    beacon_topic_id: editor.id,
                    name: editor.name.trim(),
                  });
                  setEditor(null);
                }}
              />
              {editor.id && (
                <Action
                  secondary
                  title="Archive topic"
                  run={async () => {
                    await act("archive_beacon_topic", {
                      ...scope,
                      beacon_topic_id: editor.id,
                    });
                    setEditor(null);
                  }}
                />
              )}
              <Button
                secondary
                title="Cancel"
                onPress={() => setEditor(null)}
              />
            </>
          ) : (
            <>
              {rows.map((row) => (
                <Button
                  key={row.id}
                  secondary
                  title={row.name}
                  onPress={() => setEditor(row)}
                />
              ))}
              {rows.length < 6 && (
                <Button
                  title="Add Topic"
                  onPress={() => setEditor({ name: "" })}
                />
              )}
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
