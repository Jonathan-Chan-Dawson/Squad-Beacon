import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Action, Field, useTheme } from "@/src/shared/ui";
import { usePublicBeacons } from "./usePublicBeacons";
import { supabase } from "@/src/shared/supabase";

/** An explicit host choice inside existing settings, never automatic publishing. */
export function BeaconDiscoverySettings({ activity }: { activity: Activity }) {
  const { styles } = useTheme();
  const { userId, data, act, demo, viewerEpoch, getViewerEpoch } = useBeacon();
  const { rows } = usePublicBeacons("");
  const published = rows.some((row) => row.activity_id === activity.id);
  const [area, setArea] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [visibility, setVisibility] = useState<{
    key: string;
    published: boolean;
    enabled: boolean;
    unavailable?: boolean;
  }>();
  const visibilityKey = `${userId}:${viewerEpoch}:${activity.id}:${revision}`;
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const hostEligible =
    activity.owner_id === userId &&
    activity.mode === "squad" &&
    activity.audience !== "organization";
  useEffect(() => {
    if (demo || !supabase || !hostEligible) return;
    let current = true;
    const epoch = getViewerEpoch();
    void Promise.resolve(
      supabase.rpc("beacon_guest_visibility", { p_activity_id: activity.id }),
    )
      .then(({ data: result, error }) => {
        if (current && epoch === getViewerEpoch())
          setVisibility({
            key: visibilityKey,
            published: !error && result?.published === true,
            enabled: !error && result?.enabled === true,
            unavailable: !!error,
          });
      })
      .catch(() => {
        if (current && epoch === getViewerEpoch())
          setVisibility({
            key: visibilityKey,
            published: false,
            enabled: false,
            unavailable: true,
          });
      });
    return () => {
      current = false;
    };
  }, [demo, hostEligible, activity.id, visibilityKey, getViewerEpoch]);
  const demoSummary = data.public_beacons.find(
    (row) => row.activity_id === activity.id,
  );
  const currentVisibility:
    | { published: boolean; enabled: boolean; unavailable?: boolean }
    | undefined = demo
    ? { published: !!demoSummary, enabled: demoSummary?.guest_visible === true }
    : visibility?.key === visibilityKey
      ? visibility
      : undefined;
  async function save(
    action: string,
    payload: Record<string, unknown>,
    success: string,
  ) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    const epoch = getViewerEpoch();
    try {
      await act(action, payload);
      if (epoch === getViewerEpoch()) {
        setMessage(success);
        setRevision((value) => value + 1);
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  if (
    activity.owner_id !== userId ||
    activity.mode !== "squad" ||
    activity.audience === "organization"
  )
    return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Public discovery</Text>
      <Text style={styles.muted}>
        Let signed-in people discover and join this activity without joining
        your Squad. Only its title, category, time, general area and
        availability appear in previews.
      </Text>
      <Field
        label="City or general area"
        placeholder="Chicago"
        value={area}
        onChangeText={setArea}
      />
      <Action
        title="Publish public preview"
        disabled={!area.trim() || saving}
        secondary
        run={async () => {
          const place = data.places.find(
            (row) => row.activity_id === activity.id,
          );
          await save(
            "publish_beacon_discovery",
            {
              activity_id: activity.id,
              area_label: area.trim(),
              ...(place?.latitude != null && place?.longitude != null
                ? { coarse_lat: place.latitude, coarse_lng: place.longitude }
                : {}),
            },
            "Public preview published.",
          );
        }}
      />
      <Action
        title="Remove public preview"
        disabled={saving}
        secondary
        compact
        run={async () => {
          await save(
            "unpublish_beacon_discovery",
            { activity_id: activity.id },
            "Public preview removed. It is also hidden from signed-out visitors.",
          );
        }}
      />
      <Text style={styles.label}>Visible without signing in</Text>
      <Text style={styles.muted}>
        Optional. Anyone can browse this limited preview without an account.
        Exact meeting details, profiles and chat stay protected.
      </Text>
      {currentVisibility?.unavailable ? (
        <Text style={styles.muted}>
          Guest visibility is not available on this server yet.
        </Text>
      ) : (
        <Action
          title={
            currentVisibility?.enabled
              ? "Hide from signed-out visitors"
              : "Show to signed-out visitors"
          }
          secondary
          compact
          disabled={saving || !currentVisibility?.published}
          run={() =>
            save(
              "set_beacon_guest_visibility",
              {
                activity_id: activity.id,
                enabled: !currentVisibility?.enabled,
              },
              currentVisibility?.enabled
                ? "Hidden from signed-out visitors."
                : "Limited preview visible without signing in.",
            )
          }
        />
      )}
      {!currentVisibility?.published && !currentVisibility?.unavailable ? (
        <Text style={styles.muted}>
          Publish a public preview first. Guest visibility starts off.
        </Text>
      ) : null}
      {(message || published) && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {message || "This Beacon has a public preview."}
        </Text>
      )}
    </View>
  );
}
