import { ActivityBadge, activityTones } from "../ActivityBadge";
import { PeriodTabs } from "../PeriodTabs";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SlidersHorizontal, Star } from "lucide-react-native";
import { useBeacon } from "../store";
import { useNow } from "../useNow";
import { friendIds } from "../domain";
import {
  browseBeacons,
  attendance,
  type Period,
  type SortOrder,
} from "../browsing";
import { ProfileAvatar } from "../ProfileAvatar";
import {
  Action,
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "../ui";
export default function ActivitiesScreen() {
  const { styles, colors } = useTheme();

  const { data, userId, act } = useBeacon();
  const params = useLocalSearchParams<{ filter?: string }>();
  const now = useNow();
  const [period, setPeriod] = useState("Now"),
    [filters, setFilters] = useState(false),
    [favorites, setFavorites] = useState(false),
    [allFriends, setAllFriends] = useState(false),
    [templates, setTemplates] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState("Everyone"),
    [peopleSearch, setPeopleSearch] = useState("");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [joined, setJoined] = useState(false),
    [sort, setSort] = useState<SortOrder>("Soonest"),
    [beaconView, setBeaconView] = useState<"Full" | "Compact">("Full");
  useFocusEffect(
    useCallback(() => {
      if (params.filter === "Past") setPeriod("Past");
    }, [params.filter]),
  );
  const friends = friendIds(data, userId!);
  const favorite = (kind: string, id: string) =>
    data.favorites.some(
      (f) => f.owner_id === userId && f.kind === kind && f.target_id === id,
    );
  const live = data.activities.filter(
    (a) =>
      a.status === "scheduled" &&
      Date.parse(a.starts_at) <= now &&
      Date.parse(a.ends_at) > now,
  );
  const people = data.profiles
    .filter((p) => friends.includes(p.id))
    .map((person) => {
      const activity =
        live
          .filter((a) => a.owner_id === person.id && a.mode === "solo")
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0] ??
        live.find(
          (a) =>
            a.owner_id === person.id ||
            data.rsvps.some(
              (r) =>
                r.activity_id === a.id &&
                r.user_id === person.id &&
                r.status === "going",
            ),
        );
      return {
        person,
        activity,
        free: activity?.mode === "solo" && activity.available === true,
      };
    })
    .sort(
      (a, b) =>
        Number(b.free) - Number(a.free) ||
        Number(favorite("friend", b.person.id)) -
          Number(favorite("friend", a.person.id)) ||
        Number(!!b.activity) - Number(!!a.activity) ||
        a.person.name.localeCompare(b.person.name),
    );
  const activities = browseBeacons(
    data,
    userId!,
    {
      period: (period === "Now" ? "Active" : period) as Period,
      sort,
      query,
      category,
      audience: "Everyone",
      joined,
    },
    now,
  ).filter((a) => a.mode !== "solo");
  const priority = (a: (typeof activities)[number]) =>
    Number(
      favorite("friend", a.owner_id) ||
        (a.audience === "squad" && favorite("squad", a.audience_id!)) ||
        data.rsvps.some(
          (r) =>
            r.activity_id === a.id &&
            r.status === "going" &&
            favorite("friend", r.user_id),
        ),
    );
  if (period === "Now" && sort === "Soonest")
    activities.sort(
      (a, b) => priority(b) - priority(a) || a.ends_at.localeCompare(b.ends_at),
    );
  const open = (id: string) =>
    router.push({ pathname: "/(tabs)", params: { beacon: id } });
  const time = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  const personTile = ({ person, activity, free }: (typeof people)[number]) => (
    <Pressable
      key={person.id}
      accessibilityRole="button"
      accessibilityLabel={`See ${person.name} now`}
      onPress={() => {
        setAllFriends(false);
        router.push({
          pathname: "/(tabs)",
          params: { person: person.id, beacon: activity?.id ?? "" },
        });
      }}
      style={({ pressed }) => ({
        height: 54,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingRight: 12,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: free ? colors.lime : colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <ProfileAvatar profile={person} size={54} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>
          {person.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.muted, free && { color: colors.green }]}
        >
          {free
            ? `Free til ${time(activity!.ends_at)} | ${activity!.title}`
            : (activity?.title ?? "No status shared")}
        </Text>
      </View>
      {favorite("friend", person.id) && (
        <Star size={16} color={colors.green} fill={colors.lime} />
      )}
    </Pressable>
  );
  return (
    <Screen title="Activities" eyebrow="A little time together">
      <PeriodTabs value={period} onChange={setPeriod} />
      {period === "Now" && (
        <>
          <View style={styles.between}>
            <Text style={styles.h2}>Friends Now</Text>
          </View>
          <View style={styles.between}>
            <Text style={styles.muted}>
              {people.filter((p) => p.free).length} free to hang /{" "}
              {people.length} friends
            </Text>
          </View>
          <Chips
            options={["Everyone", "Free to hang", "Starred"]}
            value={peopleFilter}
            onChange={setPeopleFilter}
          />
          {people.length ? (
            <View style={{ gap: 8 }}>
              {people
                .filter(
                  (p) =>
                    peopleFilter === "Everyone" ||
                    (peopleFilter === "Free to hang"
                      ? p.free
                      : favorite("friend", p.person.id)),
                )
                .slice(0, 4)
                .map(personTile)}
            </View>
          ) : (
            <View style={styles.card}>
              <Txt muted>Add a friend to see what they are up to.</Txt>
              <Button
                title="Add friends"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/squads",
                    params: { tab: "Friends" },
                  })
                }
              />
            </View>
          )}
          <View style={[styles.row, { alignItems: "stretch" }]}>
            <View style={{ flex: 1 }}>
              <Button
                title="See more"
                secondary
                onPress={() => setAllFriends(true)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Find friends"
                onPress={() => router.push("/find-friends")}
              />
            </View>
          </View>
        </>
      )}
      <View style={styles.between}>
        <Text style={styles.h2}>
          {period === "Now"
            ? "Happening Now"
            : period === "Past"
              ? "Shared memories"
              : "Coming up"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter activities"
          onPress={() => setFilters(true)}
          style={[styles.row, { padding: 12 }]}
        >
          <Text style={styles.label}>
            Filter
            {query || category !== "All categories" || joined ? " (on)" : ""}
          </Text>
          <SlidersHorizontal size={18} color={colors.green} />
        </Pressable>
      </View>
      <View style={styles.between}>
        <Txt muted>Beacon view</Txt>
        <Chips
          options={["Full", "Compact"] as const}
          value={beaconView}
          onChange={setBeaconView}
        />
      </View>
      {activities.map((a) => {
        const owner = data.profiles.find((p) => p.id === a.owner_id),
          place = data.places.find((p) => p.activity_id === a.id),
          total = attendance(data, a);
        const rsvp = data.rsvps.find(
          (r) => r.activity_id === a.id && r.user_id === userId,
        );
        const ended = period === "Past",
          needsApproval =
            (a.approval_required || a.mode === "invite") && !rsvp?.approved;
        if (beaconView === "Compact")
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${a.title}`}
              onPress={() => open(a.id)}
              style={({ pressed }) => [
                styles.card,
                {
                  minHeight: 58,
                  padding: 9,
                  gap: 10,
                  borderRadius: 18,
                  borderLeftWidth: 4,
                  borderLeftColor: activityTones[a.category],
                  flexDirection: "row",
                  alignItems: "center",
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <ActivityBadge category={a.category} size={38} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.body, { fontWeight: "700" }]}
                >
                  {a.title}
                </Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {owner?.name.split(" ")[0] ?? "Host"} |{" "}
                  {place?.label || "Decide together"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", maxWidth: 104 }}>
                {priority(a) > 0 && <Star size={14} color={colors.green} />}
                <Text numberOfLines={1} style={styles.muted}>
                  {period === "Now"
                    ? `Ends ${time(a.ends_at)}`
                    : new Date(a.starts_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                </Text>
              </View>
            </Pressable>
          );
        return (
          <View
            key={a.id}
            style={[
              styles.card,
              {
                borderRadius: 24,
                borderLeftWidth: 4,
                borderLeftColor: activityTones[a.category],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${a.title}`}
              onPress={() => open(a.id)}
              style={{ gap: 5 }}
            >
              <View style={styles.row}>
                <ActivityBadge category={a.category} />
                <Text style={[styles.h2, { flex: 1 }]}>{a.title}</Text>
                {priority(a) > 0 && <Star size={16} color={colors.green} />}
              </View>
              <Txt muted>
                {place?.label ||
                  (place?.online_url ? "Online" : "Decide together")}
              </Txt>
              <Txt>
                {owner?.name.split(" ")[0] ?? "Host"}
                {total > 1 ? ` + ${total - 1}` : " is hosting"}
                {a.target_count && a.target_count > total
                  ? ` | Need ${a.target_count - total} more`
                  : ""}
              </Txt>
              <Txt muted>
                {period === "Now"
                  ? `Ends ${time(a.ends_at)}`
                  : `${new Date(a.starts_at).toLocaleDateString([], { month: "short", day: "numeric" })} at ${time(a.starts_at)}`}
                {a.status === "cancelled" ? " | Cancelled" : ""}
              </Txt>
            </Pressable>
            {ended ? (
              <Button
                title="View memories"
                secondary
                onPress={() => open(a.id)}
              />
            ) : a.owner_id === userId ? (
              <Button
                title="Your beacon"
                secondary
                onPress={() => open(a.id)}
              />
            ) : rsvp?.status === "going" || rsvp?.status === "requested" ? (
              <Button
                title={
                  rsvp.status === "going"
                    ? "Going - view beacon"
                    : "Pending - view beacon"
                }
                secondary
                onPress={() => open(a.id)}
              />
            ) : (
              <Action
                title={needsApproval ? "Ask to join" : "Join"}
                run={() => act("rsvp", { id: a.id, status: "going" })}
              />
            )}
          </View>
        );
      })}
      {!activities.length && (
        <>
          <Empty
            title={
              period === "Now"
                ? "A little quiet right now."
                : "Nothing here yet."
            }
            body={
              query || joined || category !== "All categories"
                ? "Try another filter, or make a plan of your own."
                : "Your next good memory can start with a small plan."
            }
          />
          <Button
            title="Create a beacon"
            onPress={() => router.push("/create")}
          />
        </>
      )}
      <View style={styles.between}>
        <Button
          title="Favorites"
          secondary
          onPress={() => setFavorites(true)}
        />
        <Button
          title="My templates"
          secondary
          onPress={() => setTemplates(true)}
        />
      </View>
      <Sheet
        title="Filter activities"
        visible={filters}
        onClose={() => setFilters(false)}
      >
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Activity, friend, or place"
        />
        <Chips
          options={[
            "All categories",
            "Fitness",
            "Study",
            "Gaming",
            "Creative",
            "Social",
            "Other",
          ]}
          value={category}
          onChange={setCategory}
        />
        <Chips
          options={["Everyone", "I'm going"]}
          value={joined ? "I'm going" : "Everyone"}
          onChange={(v) => setJoined(v === "I'm going")}
        />
        <Txt muted>Sort by</Txt>
        <Chips
          options={
            ["Soonest", "Most momentum", "Latest first", "A to Z"] as const
          }
          value={sort}
          onChange={setSort}
        />
        <Txt muted>
          Now puts favorites first with the default sort. Free friends always
          lead Friends Now.
        </Txt>
        <Button
          title="Reset filters"
          secondary
          onPress={() => {
            setQuery("");
            setCategory("All categories");
            setJoined(false);
            setSort("Soonest");
          }}
        />
        <Button title="Done" onPress={() => setFilters(false)} />
      </Sheet>
      <Sheet
        title="Friends Now"
        visible={allFriends}
        onClose={() => setAllFriends(false)}
      >
        <Field
          label="Search your friends"
          value={peopleSearch}
          onChangeText={setPeopleSearch}
        />
        <View style={{ gap: 8 }}>
          {people
            .filter((p) =>
              p.person.name.toLowerCase().includes(peopleSearch.toLowerCase()),
            )
            .map(personTile)}
        </View>
        <Button
          title="Add friends"
          onPress={() => {
            setAllFriends(false);
            router.push({
              pathname: "/(tabs)/squads",
              params: { tab: "Friends" },
            });
          }}
        />
      </Sheet>
      <Sheet
        title="Your favorites"
        visible={favorites}
        onClose={() => setFavorites(false)}
      >
        <Txt muted>
          Keep your go-to people and squads at the front. Favorites are private
          and never change who can see your beacons. Use private lists in Squads
          to choose sharing audiences.
        </Txt>
        <Text style={styles.h2}>Friends</Text>
        {data.profiles
          .filter((p) => friends.includes(p.id))
          .map((p) => (
            <Action
              key={p.id}
              secondary
              title={`${favorite("friend", p.id) ? "Unfavorite" : "Favorite"} ${p.name}`}
              run={() =>
                act("favorite", {
                  id: p.id,
                  kind: "friend",
                  add: !favorite("friend", p.id),
                })
              }
            />
          ))}
        <Text style={styles.h2}>Squads</Text>
        {data.squads
          .filter((s) =>
            data.squad_members.some(
              (m) => m.squad_id === s.id && m.user_id === userId,
            ),
          )
          .map((s) => (
            <Action
              key={s.id}
              secondary
              title={`${favorite("squad", s.id) ? "Unfavorite" : "Favorite"} ${s.name}`}
              run={() =>
                act("favorite", {
                  id: s.id,
                  kind: "squad",
                  add: !favorite("squad", s.id),
                })
              }
            />
          ))}
        <Button title="Done" onPress={() => setFavorites(false)} />
      </Sheet>
      <Sheet
        title="My templates"
        visible={templates}
        onClose={() => setTemplates(false)}
      >
        <Button
          title="New template"
          onPress={() => {
            setTemplates(false);
            router.push({
              pathname: "/create",
              params: { editTemplate: "yes" },
            });
          }}
        />
        {!data.templates.length && (
          <Txt muted>
            Save your usual coffee, study session, or game. Next time, the
            details are ready.
          </Txt>
        )}
        {data.templates
          .filter((t) => t.owner_id === userId)
          .map((t) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.h2}>{t.name}</Text>
              <Txt muted>
                {t.title} | {t.minutes} min
              </Txt>
              <Button
                title={`Use ${t.name}`}
                onPress={() => {
                  setTemplates(false);
                  router.push({
                    pathname: "/create",
                    params: { template: t.id },
                  });
                }}
              />
              <Button
                title={`Edit ${t.name}`}
                secondary
                onPress={() => {
                  setTemplates(false);
                  router.push({
                    pathname: "/create",
                    params: { template: t.id, editTemplate: "yes" },
                  });
                }}
              />
              <Action
                title={`Delete ${t.name}`}
                secondary
                run={() => act("delete_template", { id: t.id })}
              />
            </View>
          ))}
      </Sheet>
    </Screen>
  );
}
