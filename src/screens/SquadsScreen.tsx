import React, { useState } from "react";
import { Pressable, Text, View, Share } from "react-native";
import { router } from "expo-router";
import { Users, ArrowUpRight } from "lucide-react-native";
import { useBeacon } from "../store";
import { friendIds } from "../domain";
import { ActivityCard } from "../ActivityCard";
import { InviteQR } from "../InviteQR";
import {
  Action,
  Avatar,
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  colors,
  styles,
} from "../ui";
export default function SquadsScreen() {
  const { data, userId, act } = useBeacon(),
    [tab, setTab] = useState("Squads"),
    [modal, setModal] = useState<"squad" | "list" | "friend" | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const friends = friendIds(data, userId!),
    squad = data.squads.find((s) => s.id === selected),
    list = data.lists.find((s) => s.id === selected),
    me = data.profiles.find((p) => p.id === userId);
  const role = data.squad_members.find(
      (m) => m.squad_id === selected && m.user_id === userId,
    )?.role,
    admin = role === "owner" || role === "admin";
  function open(kind: typeof modal) {
    setName("");
    setDescription("");
    setModal(kind);
  }
  return (
    <Screen title="Your kind of people." eyebrow="BETTER, TOGETHER">
      <Chips
        options={["Squads", "Friends", "Private lists"]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setSelected(null);
        }}
      />
      {tab === "Squads" && (
        <>
          <View style={styles.hero}>
            <Users color={colors.lime} size={32} />
            <Text style={[styles.h2, { color: "white" }]}>
              A small crew. A shared rhythm.
            </Text>
            <Text style={{ color: "#C7D8CC", lineHeight: 22 }}>
              Training partners, weekend people, late-night gamers. Keep each
              crew in its own space.
            </Text>
            <Button
              secondary
              title="+ Create a squad"
              onPress={() => open("squad")}
            />
          </View>
          {data.squad_invites
            .filter((i) => i.recipient_id === userId)
            .map((i) => (
              <View key={i.id} style={styles.card}>
                <Txt>
                  Invitation to{" "}
                  {data.squads.find((s) => s.id === i.squad_id)?.name ??
                    "a squad"}
                </Txt>
                <Action
                  title="Accept invitation"
                  run={() => act("accept_squad", { id: i.id })}
                />
              </View>
            ))}
          {data.squads
            .filter((s) =>
              data.squad_members.some(
                (m) => m.squad_id === s.id && m.user_id === userId,
              ),
            )
            .map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={"Open squad " + s.name}
                onPress={() => setSelected(s.id)}
                style={styles.card}
              >
                <View style={styles.between}>
                  <Avatar name={s.name} size={48} />
                  <ArrowUpRight color={colors.green} />
                </View>
                <Text style={styles.h2}>{s.name}</Text>
                <Txt muted>{s.description}</Txt>
                <Text style={styles.label}>
                  {data.squad_members.filter((m) => m.squad_id === s.id).length}{" "}
                  MEMBERS · INVITE ONLY
                </Text>
              </Pressable>
            ))}
        </>
      )}
      {tab === "Friends" && (
        <>
          {me && <InviteQR username={me.username} />}
          <Button title="+ Add a friend" onPress={() => open("friend")} />
          <Action
            secondary
            title="Share my invitation link"
            run={() =>
              Share.share({
                message:
                  "Find me on Squad Beacon: squadbeacon://invite?username=" +
                  me?.username,
              })
            }
          />
          {data.friendships
            .filter((f) => f.recipient_id === userId && f.status === "pending")
            .map((f) => (
              <View key={f.id} style={styles.card}>
                <Txt>
                  {data.profiles.find((p) => p.id === f.sender_id)?.name ??
                    "Someone"}{" "}
                  wants to be friends.
                </Txt>
                <Action
                  title="Accept friend"
                  run={() => act("accept_friend", { id: f.id })}
                />
              </View>
            ))}
          {data.profiles
            .filter((p) => friends.includes(p.id))
            .map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/person/[id]",
                    params: { id: p.id },
                  })
                }
                style={[styles.card, styles.row]}
              >
                <Avatar name={p.name} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.h2}>{p.name}</Text>
                  <Txt muted>@{p.username}</Txt>
                </View>
                <ArrowUpRight color={colors.green} />
              </Pressable>
            ))}
          {!friends.length && (
            <Empty
              title="Start with someone you know."
              body="Send a friend request by exact username. They’ll need to accept before you’re connected."
            />
          )}
        </>
      )}
      {tab === "Private lists" && (
        <>
          <Txt muted>
            Only you can see these lists. General means all accepted friends.
            Lists choose an audience; squads create a shared space.
          </Txt>
          <View style={styles.card}>
            <Text style={styles.h2}>General</Text>
            <Txt muted>
              {friends.length} accepted friends · updated automatically
            </Txt>
          </View>
          {data.lists.map((l) => (
            <Button
              key={l.id}
              secondary
              title={
                l.name +
                " · " +
                data.list_members.filter((m) => m.list_id === l.id).length
              }
              onPress={() => setSelected(l.id)}
            />
          ))}
          <Button
            title="+ Create a private list"
            onPress={() => open("list")}
          />
          <Txt muted>Ideas: Gaming · Boxing · Study · Weekend plans</Txt>
        </>
      )}
      <Sheet
        title={
          modal === "friend"
            ? "Find your friend"
            : modal === "squad"
              ? "Create a squad"
              : "Create a private list"
        }
        visible={!!modal}
        onClose={() => setModal(null)}
      >
        <Field
          label={modal === "friend" ? "Exact username" : "Name"}
          value={name}
          onChangeText={setName}
          autoCapitalize={modal === "friend" ? "none" : "sentences"}
        />
        {modal === "squad" && (
          <Field
            label="What brings you together?"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        )}
        <Action
          title={modal === "friend" ? "Send friend request" : "Create"}
          run={async () => {
            if (!name.trim()) throw new Error("Enter a name.");
            await act(
              modal === "friend"
                ? "friend_request"
                : modal === "squad"
                  ? "create_squad"
                  : "create_list",
              modal === "friend"
                ? { username: name.trim().toLowerCase() }
                : { name: name.trim(), description },
            );
            setModal(null);
          }}
        />
      </Sheet>
      <Sheet
        title={squad?.name ?? list?.name ?? ""}
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        {squad && (
          <>
            <Txt>{squad.description}</Txt>
            <Text style={styles.label}>MEMBERS</Text>
            {data.squad_members
              .filter((m) => m.squad_id === selected)
              .map((m) => (
                <View key={m.user_id} style={styles.card}>
                  <Txt>
                    {data.profiles.find((p) => p.id === m.user_id)?.name ??
                      "Squad member"}{" "}
                    · {m.role}
                  </Txt>
                  {m.role !== "owner" && (admin || m.user_id === userId) && (
                    <Action
                      title={
                        m.user_id === userId ? "Leave squad" : "Remove member"
                      }
                      secondary
                      run={() =>
                        act("remove_member", {
                          id: selected,
                          user_id: m.user_id,
                        })
                      }
                    />
                  )}{" "}
                  {role === "owner" && m.role === "member" && (
                    <Action
                      title="Make admin"
                      secondary
                      run={() =>
                        act("promote_member", {
                          id: selected,
                          user_id: m.user_id,
                        })
                      }
                    />
                  )}
                </View>
              ))}
            {admin && (
              <>
                <Text style={styles.label}>INVITE A FRIEND</Text>
                {data.profiles
                  .filter(
                    (p) =>
                      friends.includes(p.id) &&
                      !data.squad_members.some(
                        (m) => m.squad_id === selected && m.user_id === p.id,
                      ),
                  )
                  .map((p) => (
                    <Action
                      key={p.id}
                      title={"Invite " + p.name}
                      secondary
                      run={() =>
                        act("invite_squad", { id: selected, user_id: p.id })
                      }
                    />
                  ))}
              </>
            )}
            <Text style={styles.h2}>Squad activity</Text>
            {data.activities
              .filter((a) => a.audience_id === selected)
              .map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
            <Button
              title="Create an activity"
              onPress={() => {
                setSelected(null);
                router.push("/create");
              }}
            />
          </>
        )}
        {list && (
          <>
            <Txt muted>
              Choose which accepted friends are in this private list.
            </Txt>
            {data.profiles
              .filter((p) => friends.includes(p.id))
              .map((p) => {
                const added = data.list_members.some(
                  (m) => m.list_id === selected && m.user_id === p.id,
                );
                return (
                  <Action
                    key={p.id}
                    secondary
                    title={(added ? "✓ " : "+ ") + p.name}
                    run={() =>
                      act("list_member", {
                        id: selected,
                        user_id: p.id,
                        add: !added,
                      })
                    }
                  />
                );
              })}
          </>
        )}
      </Sheet>
    </Screen>
  );
}
