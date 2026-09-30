import { BeaconResponse, BeaconMomentum } from "@/src/BeaconResponse";
import React, { useState } from "react";
import { useNow } from "@/src/useNow";
import { Text, View, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import DateField from "@/components/DateField";
import { useBeacon } from "@/src/store";
import { activityWhen, friendIds, validateActivity } from "@/src/domain";
import {
  Action,
  Avatar,
  Button,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/ui";
export default function ActivityDetail() {
  const { styles } = useTheme();

  const { id } = useLocalSearchParams<{ id: string }>(),
    { data, userId, act } = useBeacon();
  const a = data.activities.find((x) => x.id === id),
    [comment, setComment] = useState(""),
    [edit, setEdit] = useState(false),
    [title, setTitle] = useState(""),
    [starts, setStarts] = useState(""),
    [ends, setEnds] = useState(""),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("");
  const now = useNow();
  if (!a)
    return (
      <Screen title="Activity unavailable" eyebrow="ACTIVITY" create={false}>
        <Empty
          title="This plan is no longer visible."
          body="It may have been removed, or its audience may have changed."
        />
        <Button
          title="Back to activities"
          onPress={() => router.replace("/(tabs)/activities")}
        />
      </Screen>
    );
  const owner = data.profiles.find((p) => p.id === a.owner_id),
    place = data.places.find((p) => p.activity_id === id),
    mine = a.owner_id === userId,
    rsvps = data.rsvps.filter((r) => r.activity_id === id),
    open = a.status === "scheduled" && Date.parse(a.ends_at) > now,
    friends = friendIds(data, userId!);
  return (
    <Screen
      title={a.title}
      eyebrow={a.category + " · " + a.mode}
      create={false}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Avatar name={owner?.name ?? "Host"} />
          <View>
            <Txt>{owner?.name ?? "Host"}</Txt>
            <Txt muted>{activityWhen(a)}</Txt>
          </View>
        </View>
        <Button
          secondary
          title="View host profile"
          onPress={() =>
            router.push({
              pathname: "/person/[id]",
              params: { id: a.owner_id },
            })
          }
        />
        <Txt>
          {new Date(a.starts_at).toLocaleString()} –{" "}
          {new Date(a.ends_at).toLocaleString()}
        </Txt>
        <Txt muted>Event timezone: {a.timezone}</Txt>
        <Txt>
          {place?.label ||
            (place
              ? "Meeting place to be decided"
              : "Meeting details are available to approved attendees.")}
        </Txt>
        {place?.online_url && (
          <Action
            title="Open online activity"
            secondary
            run={() => Linking.openURL(place.online_url!)}
          />
        )}
        <Txt muted>
          Audience: {a.audience} ·{" "}
          {a.approval_required
            ? "Host approval required"
            : "Joining follows activity mode"}
        </Txt>
      </View>
      <BeaconMomentum activity={a} />
      <BeaconResponse activity={a} />
      {mine && a.mode === "solo" && open && (
        <Action
          title="Invite company: turn into a beacon"
          run={() => act("open_status", { id })}
        />
      )}
      {mine && a.status === "scheduled" && (
        <View style={styles.card}>
          <Text style={styles.h2}>Host controls</Text>
          <Button
            secondary
            title="Edit title or time"
            onPress={() => {
              setTitle(a.title);
              setStarts(a.starts_at);
              setEnds(a.ends_at);
              setEdit(true);
            }}
          />
          <Action
            title="Mark completed"
            run={async () => {
              await act("activity_status", { id, status: "completed" });
            }}
          />
          <Action
            title="Cancel activity"
            secondary
            run={() => act("activity_status", { id, status: "cancelled" })}
          />
        </View>
      )}
      <Text style={styles.h2}>The crew</Text>
      {rsvps.map((r) => (
        <View key={r.user_id} style={styles.card}>
          <Txt>
            {data.profiles.find((p) => p.id === r.user_id)?.name ?? "Attendee"}{" "}
            · {r.status}
          </Txt>
          {mine && r.status === "requested" && (
            <Action
              secondary
              title="Approve Going"
              run={() => act("approve_rsvp", { id, user_id: r.user_id })}
            />
          )}
          {mine && r.user_id !== userId && (
            <Action
              secondary
              title="Remove attendee"
              run={() => act("remove_rsvp", { id, user_id: r.user_id })}
            />
          )}
        </View>
      ))}
      {mine && open && a.mode !== "solo" && (
        <>
          <Text style={styles.label}>INVITE A FRIEND</Text>
          {data.profiles
            .filter(
              (p) =>
                friends.includes(p.id) &&
                !rsvps.some((r) => r.user_id === p.id),
            )
            .map((p) => (
              <Action
                key={p.id}
                secondary
                title={"Invite " + p.name}
                run={() => act("invite_activity", { id, user_id: p.id })}
              />
            ))}
        </>
      )}
      <Text style={styles.h2}>
        {a.status === "completed"
          ? "The moments worth keeping"
          : "Plan together"}
      </Text>
      {a.status === "completed" && (
        <>
          <Txt muted>
            A small detail, an inside joke, something you want to remember. Keep
            it real.
          </Txt>
          <Button
            title="Do this again"
            secondary
            onPress={() =>
              router.push({ pathname: "/create", params: { repeat: a.id } })
            }
          />
        </>
      )}
      {data.comments
        .filter((c) => c.activity_id === id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => (
          <View key={c.id} style={styles.card}>
            <Txt muted>
              {data.profiles.find((p) => p.id === c.author_id)?.name ??
                "Squad member"}{" "}
              ·{" "}
              {new Date(c.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Txt>
            <Txt>{c.body}</Txt>
          </View>
        ))}
      <Field
        label={a.status === "completed" ? "Keep a memory" : "Add a comment"}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={2000}
      />
      <Action
        title={a.status === "completed" ? "Save memory" : "Post comment"}
        run={async () => {
          if (!comment.trim()) throw new Error("Write a comment first.");
          await act("comment", { id, body: comment.trim() });
          setComment("");
        }}
      />
      {!mine && (
        <Button
          secondary
          title="Report this activity"
          onPress={() => setReport(true)}
        />
      )}
      <Sheet
        title="Update the plan"
        visible={edit}
        onClose={() => setEdit(false)}
      >
        <Field label="Title" value={title} onChangeText={setTitle} />
        <DateField label="Starts" value={starts} onChange={setStarts} />
        <DateField label="Ends" value={ends} onChange={setEnds} />
        <Action
          title="Save and notify attendees"
          run={async () => {
            validateActivity({ title, starts_at: starts, ends_at: ends });
            await act("edit_activity", {
              id,
              title,
              starts_at: starts,
              ends_at: ends,
            });
            setEdit(false);
          }}
        />
      </Sheet>
      <Sheet
        title="Report activity"
        visible={report}
        onClose={() => setReport(false)}
      >
        <Field
          label="What happened? Include relevant context."
          value={reason}
          onChangeText={setReason}
          multiline
        />
        <Action
          title="Send report"
          run={async () => {
            if (reason.trim().length < 5)
              throw new Error("Please include a little more detail.");
            await act("report", { id, reason });
            setReport(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}
