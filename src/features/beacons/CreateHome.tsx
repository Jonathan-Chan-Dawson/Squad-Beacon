import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Sparkles } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import {
  beaconTemplateCatalog,
  beaconTemplateGroups,
  searchBeaconTemplates,
  templates,
  type BeaconTemplate,
} from "@/src/shared/templates";
import {
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

export function CreateHome({
  onBlank,
  onTemplate,
}: {
  onBlank: () => void;
  onTemplate: (template: BeaconTemplate) => void;
}) {
  const { data, userId } = useBeacon();
  const context = useLocalSearchParams<{
    threadId?: string;
    planId?: string;
  }>();
  const { styles, colors } = useTheme();
  const [tab, setTab] = useState("Beacon");
  const [browser, setBrowser] = useState(false);
  const [source, setSource] = useState("For You");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const own = data.templates.filter((item) => item.owner_id === userId);
  const history = data.activities
    .filter((item) => item.owner_id === userId)
    .slice()
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const catalog = [...templates, ...beaconTemplateCatalog];
  const recent = history
    .flatMap((activity) => {
      if (activity.template_source_id) return [activity.template_source_id];
      const match = catalog.find(
        (item) => item.title.toLowerCase() === activity.title.toLowerCase(),
      );
      return match ? [`app:${match.id}`] : [];
    })
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .filter((id) =>
      id.startsWith("mine:")
        ? own.some((item) => `mine:${item.id}` === id)
        : catalog.some((item) => `app:${item.id}` === id),
    )
    .slice(0, 3);
  const interests =
    data.profiles.find((item) => item.id === userId)?.interests ?? [];
  const recommended = [...catalog]
    .sort((a, b) => {
      const score = (item: BeaconTemplate) =>
        history
          .slice(0, 10)
          .filter((activity) => activity.category === item.category).length +
        interests.filter((interest) =>
          `${item.title} ${item.category} ${item.groupLabel ?? ""}`
            .toLowerCase()
            .includes(interest.toLowerCase()),
        ).length *
          3;
      return score(b) - score(a);
    })
    .filter(
      (item, index, items) =>
        items.findIndex((other) => other.title === item.title) === index,
    )
    .slice(0, 3);
  const planTemplates = data.plan_templates.filter(
    (item) => item.owner_id === userId,
  );
  const routines = data.plan_routines.filter(
    (item) => item.owner_id === userId && item.status !== "ended",
  );
  const card = (
    key: string,
    title: string,
    detail: string,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Sparkles size={19} color={colors.green} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.h2}>{title}</Text>
        <Txt muted>{detail}</Txt>
      </View>
      <ArrowRight size={18} color={colors.green} />
    </Pressable>
  );
  const recipeCard = (item: BeaconTemplate) =>
    card(
      item.id ?? item.title,
      item.title,
      `${item.category} · ${item.minutes} min`,
      () => {
        setBrowser(false);
        onTemplate(item);
      },
    );
  const savedCard = (item: (typeof own)[number]) =>
    card(item.id, item.name, `${item.title} · ${item.minutes} min`, () =>
      router.push({
        pathname: "/create",
        params: {
          template: item.id,
          ...(context.threadId ? { threadId: context.threadId } : {}),
          ...(context.planId ? { planId: context.planId } : {}),
        },
      }),
    );
  const section = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  );
  const appResults =
    source === "For You" && !query.trim() && !group
      ? recommended
      : searchBeaconTemplates(query, group || undefined);
  return (
    <Screen
      title="Create"
      eyebrow="MAKE TIME FOR SOMETHING GOOD"
      create={false}
    >
      <Chips
        options={["Beacon", "Plan", "Routine"]}
        value={tab}
        onChange={setTab}
        showSelectedCheckmark={false}
      />
      <Txt muted>
        {tab === "Beacon"
          ? "One activity, with your people."
          : tab === "Plan"
            ? "Arrange Beacons into a simple itinerary."
            : "Save a Plan to reuse or repeat."}
      </Txt>
      {section(
        "QUICK START",
        <Button
          title={tab === "Routine" ? "+ Create Routine" : `+ Blank ${tab}`}
          onPress={() => {
            if (tab === "Beacon") onBlank();
            else
              router.push({
                pathname: tab === "Plan" ? "/plans" : "/routines",
                params: { create: "yes" },
              });
          }}
        />,
      )}
      {tab === "Beacon" && (
        <>
          {section("FOR YOU", recommended.map(recipeCard))}
          {!!recent.length &&
            section(
              "RECENT",
              recent.map((id) =>
                id.startsWith("mine:")
                  ? savedCard(own.find((item) => `mine:${item.id}` === id)!)
                  : recipeCard(
                      catalog.find((item) => `app:${item.id}` === id)!,
                    ),
              ),
            )}
          {!!own.length &&
            section("MY TEMPLATES", own.slice(0, 3).map(savedCard))}
          <Button
            title="Browse Beacon Templates →"
            secondary
            onPress={() => setBrowser(true)}
          />
          <Txt muted>Sports · Food · Study · Social · Outdoors · Gaming</Txt>
        </>
      )}
      {tab === "Plan" && (
        <>
          {!!planTemplates.length &&
            section(
              "MY TEMPLATES",
              planTemplates.map((item) =>
                card(item.id, item.title, `${item.steps.length} Beacons`, () =>
                  router.push({
                    pathname: "/plans",
                    params: {
                      template: item.id,
                      create: "yes",
                      ...(item.squad_id ? { squadId: item.squad_id } : {}),
                    },
                  }),
                ),
              ),
            )}
          <Button
            title="My Plans →"
            secondary
            onPress={() => router.push("/plans")}
          />
        </>
      )}
      {tab === "Routine" && (
        <>
          {!!routines.length &&
            section(
              "MY ROUTINES",
              routines.map((item) => {
                const plan = data.plans.find(
                  (plan) => plan.id === item.plan_id,
                );
                return plan
                  ? card(
                      item.id,
                      plan.title,
                      item.run_mode === "manual"
                        ? "Run Manually"
                        : item.status === "paused"
                          ? "Paused"
                          : `Next · ${item.next_occurrence_on ?? "Run manually"}`,
                      () =>
                        router.push({
                          pathname: "/routines",
                          params: { planId: plan.id },
                        }),
                    )
                  : null;
              }),
            )}
          <Button
            title="My Routines →"
            secondary
            onPress={() => router.push("/routines")}
          />
        </>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          compact
          secondary
          title="Share a status"
          onPress={() =>
            router.push({ pathname: "/create", params: { kind: "status" } })
          }
        />
        <Button
          compact
          secondary
          title="Beacon for a Squad"
          onPress={() =>
            router.push({ pathname: "/create", params: { kind: "squad" } })
          }
        />
      </View>
      <Sheet
        title="Beacon Templates"
        visible={browser}
        onClose={() => setBrowser(false)}
      >
        <Field
          label="Search"
          placeholder="Search activities or categories…"
          value={query}
          onChangeText={setQuery}
        />
        <Chips
          options={
            own.length
              ? ["For You", "App Templates", "My Templates"]
              : ["For You", "App Templates"]
          }
          value={source}
          onChange={setSource}
          showSelectedCheckmark={false}
        />
        {source !== "My Templates" && (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Button
                compact
                secondary
                title="All"
                onPress={() => setGroup("")}
              />
              {beaconTemplateGroups.map((item) => (
                <Button
                  key={item.id}
                  compact
                  secondary={group !== item.id}
                  title={item.title}
                  onPress={() => {
                    setGroup(item.id);
                    setSource("App Templates");
                  }}
                />
              ))}
            </View>
            {appResults.map(recipeCard)}
            {!appResults.length && (
              <Empty
                title="No matching templates"
                body="Try another activity or category."
              />
            )}
          </>
        )}
        {source === "My Templates" &&
          own
            .filter((item) =>
              `${item.name} ${item.title} ${item.category}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            )
            .map(savedCard)}
        <Button secondary title="Done" onPress={() => setBrowser(false)} />
      </Sheet>
    </Screen>
  );
}
