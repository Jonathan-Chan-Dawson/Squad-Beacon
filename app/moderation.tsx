import React, { useState } from "react";
import { View, Text } from "react-native";
import { useBeacon } from "@/src/store";
import { supabase } from "@/src/supabase";
import { Action, Button, Screen, Sheet, Txt, styles } from "@/src/ui";
export default function Moderation() {
  const { data, act } = useBeacon(),
    [metrics, setMetrics] = useState<Record<string, number> | null>(null),
    [removing, setRemoving] = useState<string | null>(null);
  return (
    <Screen title="Safety inbox" eyebrow="RESTRICTED MODERATION" create={false}>
      <Txt muted>
        Only server-appointed moderators can read reports, remove reported
        activities, or resolve reports. Account-level enforcement is handled by
        the operator in Supabase.
      </Txt>
      {data.is_moderator && (
        <Action
          secondary
          title="Load pilot metrics"
          run={async () => {
            const { data, error } = await supabase!.rpc("beacon_pilot_metrics");
            if (error) throw error;
            setMetrics(data);
          }}
        />
      )}
      {metrics && (
        <View style={styles.card}>
          {Object.entries(metrics).map(([key, value]) => (
            <Txt key={key}>
              {key.replaceAll("_", " ")}: {value}
            </Txt>
          ))}
        </View>
      )}
      {data.reports
        .filter((r) => !r.resolved)
        .map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.label}>
              {new Date(r.created_at).toLocaleString()}
            </Text>
            <Txt>Subject: {r.subject_id}</Txt>
            <Txt>{r.reason}</Txt>
            <Action
              title="Mark resolved"
              run={() => act("resolve_report", { id: r.id })}
            />
            <Button
              secondary
              title="Remove reported activity…"
              onPress={() => setRemoving(r.subject_id)}
            />
          </View>
        ))}
      {!data.reports.length && (
        <Txt>No reports are available to this account.</Txt>
      )}
      <Sheet
        title="Remove reported activity?"
        visible={!!removing}
        onClose={() => setRemoving(null)}
      >
        <Txt>
          This permanently removes the activity, its meeting details, comments,
          RSVPs, and related notifications. Account reports require operator
          review and will not be deleted by this action.
        </Txt>
        <Action
          title="Confirm activity removal"
          run={async () => {
            await act("moderate_remove_activity", { id: removing });
            setRemoving(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}
