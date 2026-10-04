import { ActivityCard } from "@/src/features/beacons/ActivityCard";
import { LibraryToolkit } from "@/src/features/library/LibraryToolkit";
import { PlanningInbox } from "@/src/features/planning/PlanningInbox";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  Check,
  Clock3,
  History,
  MapPin,
  MessageSquareText,
  SlidersHorizontal,
  Star,
  X,
  Zap,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import {
  friendAvailabilityState,
  friendIds,
  locationIsFresh,
} from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { browseBeacons, type Period, type SortOrder } from "@/src/shared/browsing";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { MotionPressable } from "@/src/shared/MotionPressable";
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
} from "@/src/shared/ui";

type ActivityPeriod = "Current" | "Upcoming" | "Past";

function ActivityPeriodTabs({
  value,
  onChange,
}: {
  value: ActivityPeriod;
  onChange: (value: ActivityPeriod) => void;
}) {
  const { colors } = useTheme();
  const options = [
    { label: "Current", Icon: Zap },
    { label: "Upcoming", Icon: CalendarDays },
    { label: "Past", Icon: History },
  ] as const;

  return (
    <View
      style={{
        flexDirection: "row",
        padding: 5,
        gap: 4,
        backgroundColor: colors.line + "88",
        borderRadius: 22,
      }}
    >
      {options.map(({ label, Icon }) => {
        const selected = label === value;
        return (
          <MotionPressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(label)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              paddingHorizontal: 3,
              flexDirection: "row",
              gap: 5,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              backgroundColor: selected ? colors.ink : "transparent",
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <Icon size={15} color={selected ? colors.white : colors.muted} />
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 12,
                fontWeight: "700",
                color: selected ? colors.white : colors.muted,
              }}
            >
              {label}
            </Text>
          </MotionPressable>
        );
      })}
    </View>
  );
}

export default function ActivitiesScreen() {
  const { styles, colors } = useTheme();

  const { data, userId, act } = useBeacon();
  const params = useLocalSearchParams<{ filter?: string }>();
  const now = useNow();
  const [period, setPeriod] = useState<ActivityPeriod>("Current"),
    [filters, setFilters] = useState(false),
    [favorites, setFavorites] = useState(false),
    [allFriends, setAllFriends] = useState(false),
    [templates, setTemplates] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState("Everyone"),
    [peopleSearch, setPeopleSearch] = useState("");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [joined, setJoined] = useState(false),
    [sort, setSort] = useState<SortOrder>("Soonest");
  const ownTemplates = data.templates.filter(
      (template) => template.owner_id === userId,
    ),
    personalPlans = data.plans.filter(
      (plan) => plan.owner_id === userId && plan.squad_id === null,
    ),
    favoriteCount = data.favorites.filter(
      (item) => item.owner_id === userId,
    ).length,
    savedBeacons = data.beacon_favorites
      .filter(
        (item) =>
          item.owner_id === userId &&
          data.activities.some((activity) => activity.id === item.activity_id),
      )
      .map((item) => data.activities.find((activity) => activity.id === item.activity_id)!)
      .sort((left, right) => right.starts_at.localeCompare(left.starts_at)),
    savedBeaconCount = savedBeacons.length;
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
      const canView = canViewProfile(data, person, userId!);
      const activity = canView
        ? live
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
          )
        : undefined;
      const availability = friendAvailabilityState(activity, now);
      const location =
        canView &&
        data.locations.find(
          (item) =>
            item.owner_id === person.id &&
            locationIsFresh(item, new Date(now)),
        );
      return {
        person,
        canView,
        activity,
        availability,
        location,
        free:
          availability === "available" || availability === "ending-soon",
      };
    })
    .sort(
      (a, b) =>
        Number(b.free) - Number(a.free) ||
        Number(favorite("friend", b.person.id)) -
          Number(favorite("friend", a.person.id)) ||
        a.person.name.localeCompare(b.person.name),
    );
  const activities = browseBeacons(
    data,
    userId!,
    {
      period: (period === "Current" ? "Active" : period) as Period,
      sort,
      query,
      category,
      audience: "Everyone",
      joined,
    },
    now,
  ).filter((a) => a.mode !== "solo");
  const recentlyEnded =
    period === "Past"
      ? activities
          .filter(
            (activity) =>
              activity.status === "completed" &&
              Date.parse(activity.ends_at) > now - 7 * 24 * 60 * 60 * 1000,
          )
          .sort((a, b) => b.ends_at.localeCompare(a.ends_at))
          .slice(0, 2)
      : [];
  const memoryFor = (activityId: string) =>
    data.comments
      .filter((comment) => comment.activity_id === activityId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
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
  if (period === "Current" && sort === "Soonest")
    activities.sort(
      (a, b) => priority(b) - priority(a) || a.ends_at.localeCompare(b.ends_at),
    );
  const activeFilterCount =
    Number(!!query.trim()) +
    Number(category !== "All categories") +
    Number(joined) +
    Number(sort !== "Soonest");
  const open = (id: string) =>
    router.push({ pathname: "/(tabs)", params: { beacon: id } });
  const time = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  const personTile = ({
    person,
    canView,
    activity,
    availability,
    location,
    free,
  }: (typeof people)[number]) => {
    const displayName = canView ? person.name : "Friend";
    const availabilityText =
      availability === "available"
        ? "Available"
        : availability === "ending-soon"
          ? "Ending soon"
          : availability === "unavailable"
            ? "Unavailable"
              : activity
                ? "At a beacon"
                : "No status shared";
    const availabilityColor =
      availability === "available"
        ? "#22C55E"
        : availability === "ending-soon"
          ? "#F5C542"
          : availability === "unavailable"
            ? "#EF4444"
            : colors.muted;
    const timeLabel = activity
      ? availability === "available" || availability === "ending-soon"
        ? `Available until ${time(activity.ends_at)}`
        : availability === "unavailable"
          ? `Status through ${time(activity.ends_at)}`
          : `Beacon ends ${time(activity.ends_at)}`
      : undefined;
    const caption = activity
      ? [
          availability === "available" || availability === "ending-soon"
            ? `Free til ${time(activity.ends_at)}`
            : availability === "unavailable"
              ? `Until ${time(activity.ends_at)}`
              : `Ends ${time(activity.ends_at)}`,
          activity.title,
        ]
            .join(" · ")
      : "No status shared";
    const rowLabel = [
      `See ${displayName} now`,
      availabilityText,
      caption,
      location ? "Location shared" : undefined,
    ]
      .filter(Boolean)
      .join(". ");

    return (
      <Pressable
        key={person.id}
        accessibilityRole="button"
        accessibilityLabel={rowLabel}
        onPress={() => {
          setAllFriends(false);
          router.push({
            pathname: "/(tabs)",
            params: { person: person.id, beacon: activity?.id ?? "" },
          });
        }}
        style={({ pressed }) => ({
          minHeight: 64,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 4,
          paddingRight: 12,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: free ? colors.lime : colors.white,
          borderWidth: 1,
          borderColor: colors.line,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View style={{ width: 54, height: 54 }}>
          <ProfileAvatar profile={canView ? person : undefined} size={54} />
          {availability !== "unknown" && (
            <View
              testID={`availability-badge-${person.id}`}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Availability: ${availabilityText}`}
              style={{
                position: "absolute",
                top: 1,
                right: 1,
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: colors.white,
                backgroundColor: availabilityColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {availability === "available" ? (
                <Check size={9} color="#FFFFFF" strokeWidth={3} />
              ) : availability === "ending-soon" ? (
                <Clock3 size={9} color="#173D32" strokeWidth={3} />
              ) : (
                <X size={9} color="#FFFFFF" strokeWidth={3} />
              )}
            </View>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>
            {displayName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minWidth: 0,
            }}
          >
            {timeLabel && (
              <Clock3
                size={12}
                color={colors.muted}
                accessibilityLabel={`Time: ${timeLabel}`}
                accessible
              />
            )}
            <Text
              numberOfLines={1}
              style={[
                styles.muted,
                { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 15 },
                free && { color: colors.green },
                availability === "unavailable" && { color: colors.red },
              ]}
            >
              {caption}
            </Text>
            {location && (
              <MapPin
                size={14}
                color={colors.green}
                accessibilityLabel="Location shared"
                accessible
              />
            )}
          </View>
        </View>
        {favorite("friend", person.id) && (
          <Star size={16} color={colors.green} fill={colors.lime} />
        )}
      </Pressable>
    );
  };
  return (
    <Screen title="Activities" eyebrow="A little time together">
      <ActivityPeriodTabs value={period} onChange={setPeriod} />
      {period === "Past" && recentlyEnded.length > 0 && (
        <View style={[styles.card, { gap: 8, padding: 13 }]}>
          <View style={styles.between}>
            <View style={styles.row}>
              <Clock3 size={17} color={colors.green} />
              <Text style={styles.h2}>Recently ended</Text>
            </View>
            <Text style={styles.label}>LAST 7 DAYS</Text>
          </View>
          {recentlyEnded.map((activity) => {
            const memory = memoryFor(activity.id);
            return (
              <Pressable
                key={activity.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${activity.title}${memory ? ", with a saved memory" : ""}`}
                onPress={() => open(activity.id)}
                style={({ pressed }) => ({
                  minHeight: 54,
                  paddingVertical: 7,
                  paddingHorizontal: 8,
                  borderRadius: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  backgroundColor: colors.bg,
                  opacity: pressed ? 0.76 : 1,
                })}
              >
                {memory ? (
                  <MessageSquareText size={17} color={colors.green} />
                ) : (
                  <History size={17} color={colors.muted} />
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[styles.body, { fontWeight: "700" }]}
                  >
                    {activity.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.muted}>
                    {memory
                      ? `${data.profiles.find((profile) => profile.id === memory.author_id)?.name ?? "A friend"}: ${memory.body}`
                      : "Open this beacon’s history"}
                  </Text>
                </View>
                <Text style={styles.label}>OPEN</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {period === "Current" && (
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
            options={["Everyone", "Free to hang", "Starred Friends"]}
            value={peopleFilter}
            onChange={setPeopleFilter}
            showSelectedCheckmark={false}
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
                .slice(0, 5)
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
      {period === "Upcoming" && <PlanningInbox />}
      {period === "Past" && (
        <>
          <LibraryToolkit
            planCount={personalPlans.length}
            favoriteCount={favoriteCount}
            savedBeaconCount={savedBeaconCount}
            templateCount={ownTemplates.length}
            onPlans={() => router.push("/plans")}
            onFavorites={() => setFavorites(true)}
            onTemplates={() => setTemplates(true)}
          />
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button
                title="Library"
                secondary
                onPress={() => router.push("/library")}
              />
            </View>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button
                title="Pings & Decisions"
                secondary
                onPress={() => router.push("/councils")}
              />
            </View>
          </View>
        </>
      )}
      <View style={styles.between}>
        <Text style={styles.h2}>
          {period === "Current"
            ? "Happening Now"
            : period === "Past"
              ? "Beacon history"
              : "Coming up"}
        </Text>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Filter"
          accessibilityState={{ selected: activeFilterCount > 0 }}
          onPress={() => setFilters(true)}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: 11,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: activeFilterCount ? colors.green : colors.line,
            backgroundColor: colors.white,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            opacity: pressed ? 0.78 : 1,
          })}
        >
          <Text style={[styles.label, { color: colors.ink }]}>
            Filter
          </Text>
          {activeFilterCount > 0 ? (
            <View
              testID="activity-filter-count"
              style={{
                minWidth: 20,
                height: 20,
                paddingHorizontal: 5,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.lime,
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 11, fontWeight: "800" }}>
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
          <SlidersHorizontal size={17} color={activeFilterCount ? colors.green : colors.muted} />
        </MotionPressable>
      </View>
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          highlighted={priority(activity) > 0}
          onOpen={() => open(activity.id)}
        />
      ))}
      {!activities.length && (
        <>
          <Empty
            title={
              period === "Current"
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
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Category</Text>
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
            showSelectedCheckmark={false}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Participation</Text>
          <Chips
            options={["Everyone", "I'm going"]}
            value={joined ? "I'm going" : "Everyone"}
            onChange={(v) => setJoined(v === "I'm going")}
            showSelectedCheckmark={false}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Sort</Text>
          <Chips
            options={
              ["Soonest", "Most momentum", "Latest first", "A to Z"] as const
            }
            value={sort}
            onChange={setSort}
            showSelectedCheckmark={false}
          />
        </View>
        <Txt muted>
          Current puts favorites first with the default sort. Free friends always
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
              (p.canView ? p.person.name : "Friend")
                .toLowerCase()
                .includes(peopleSearch.toLowerCase()),
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
        <Text style={styles.h2}>Saved Beacons</Text>
        {!savedBeacons.length ? (
          <Txt muted>Save a Beacon from its Overview to keep it easy to find.</Txt>
        ) : null}
        {savedBeacons.map((activity) => (
          <View key={activity.id} style={[styles.row, { gap: 8 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.body}>{activity.title}</Text>
              <Text numberOfLines={1} style={styles.muted}>{activity.category} · {activity.status}</Text>
            </View>
            <Button
              compact
              secondary
              title="Open"
              onPress={() => {
                setFavorites(false);
                open(activity.id);
              }}
            />
            <Button
              compact
              secondary
              title="Remove"
              onPress={() => void act("save_beacon", { activity_id: activity.id, saved: false })}
            />
          </View>
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
        {!ownTemplates.length && (
          <Txt muted>
            Save your usual coffee, study session, or game. Next time, the
            details are ready.
          </Txt>
        )}
        {ownTemplates.map((t) => (
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
