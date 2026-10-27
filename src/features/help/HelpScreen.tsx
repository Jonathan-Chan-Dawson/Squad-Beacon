import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { Button, Field, Screen, Txt, useTheme } from "@/src/shared/ui";
import { matchesSearch } from "@/src/shared/search";
import { tipCopy, SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";

const topics: { title: string; answer: string; link: string; path: Href }[] = [
  {
    title: "Getting Started",
    answer:
      "Explore on Map or browse Beacons, connect with someone you know, or use Create to start something. Beacons is your home for activity, friends and exploration. You can move around freely; tips are optional.",
    link: "Explore Beacons",
    path: "/browse-beacons",
  },
  {
    title: "Finding and Creating Beacons",
    answer:
      "Search by activity or area. Clear filters if results seem too narrow. Create starts with a blank Beacon or a reusable template. " +
      tipCopy.visibility +
      " Joining may require host approval; Interested is separate from Going.",
    link: "Create a Beacon",
    path: { pathname: "/create", params: { kind: "beacon" } },
  },
  {
    title: "Pings, Votes, Draws, and Find a Time",
    answer:
      tipCopy.ping +
      " " +
      tipCopy.vote +
      " A Draw chooses among eligible alternatives when the organizer draws. Find a Time compares availability before the organizer confirms a time. Responding does not automatically commit you to attending.",
    link: "Pings & Decisions",
    path: "/councils",
  },
  {
    title: "Plans, Calendar, and Routines",
    answer:
      tipCopy.plan +
      " A Plan can begin without dates; scheduled Beacons appear in Calendar. Following a Plan is separate from each Beacon's attendance. " +
      tipCopy.routine +
      " Each generated repeat has separate attendance. Automatic repeats require the server schedule to be deployed.",
    link: "Open Plans",
    path: "/plans",
  },
  {
    title: "Friends, Squads, Organizations, and Networks",
    answer:
      "Friends are individual connections. Squads bring a crew and its conversations together. Organizations and Networks connect communities; membership and access remain independent. Private Lists organize your accepted friends and are visible only to you. Group membership never automatically sends Beacon invitations.",
    link: "Find Friends",
    path: "/find-friends",
  },
  {
    title: "Invitations, responses, and permissions",
    answer:
      "Responses & Invitations collects requests that need your attention. Invitations do not override privacy, approval or capacity rules. You can decline. Some details and tools are available only to eligible participants; unavailable content is not an empty feed.",
    link: "Open Responses",
    path: "/responses",
  },
  {
    title: "Status, Availability, and Sonar",
    answer:
      "Availability tells your chosen audience whether you're free. Status and attendance are separate. " +
      tipCopy.sonar +
      " Choose accepted friends and a duration; sharing stays off until you explicitly start it and ends automatically. Sonar does not keep location history and is not an emergency service.",
    link: "Manage Sonar",
    path: "/location",
  },
  {
    title: "Templates, Beacon tools and memories",
    answer:
      "Templates reuse an activity setup. Hosts enable tools such as Notes, checklists and Memories; tool access follows the Beacon's permissions. Memories remain connected to their source Beacon. Your collection keeps saved Beacons, Plans and templates together.",
    link: "My Collection",
    path: "/my-collection",
  },
  {
    title: "Privacy and troubleshooting",
    answer:
      "Check your search, filters and chosen area before assuming nothing is available. Location access is optional: you can search for a place instead. Retry failed loads when connected. Manage profile visibility, quiet hours and push preferences in Settings. Optional widgets are configured separately in Widget Studio; platform availability varies. Privacy policies and support details are available from Settings.",
    link: "Open Settings",
    path: "/settings",
  },
];
export default function HelpScreen() {
  const { styles, colors } = useTheme();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = topics.filter((topic) =>
    matchesSearch(query, topic.title, topic.answer),
  );
  return (
    <Screen title="A friendly field guide" eyebrow="HELP & TIPS" create={false}>
      <Txt muted>A few useful answers. Follow your curiosity.</Txt>
      <Field
        label="Search Help"
        value={query}
        onChangeText={setQuery}
        placeholder="Try visibility, Ping, or Sonar"
      />
      {!visible.length ? (
        <SemanticEmpty
          name="empty.search"
          density="inline"
          action={{ label: "Clear search", onPress: () => setQuery("") }}
        />
      ) : null}
      {visible.map((topic) => {
        const open = expanded === topic.title || !!query.trim();
        return (
          <View
            key={topic.title}
            style={{
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              paddingVertical: 8,
              gap: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setExpanded(open ? null : topic.title)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 48,
              }}
            >
              <Text style={[styles.h2, { flex: 1 }]}>{topic.title}</Text>
              {open ? (
                <ChevronDown size={18} color={colors.muted} />
              ) : (
                <ChevronRight size={18} color={colors.muted} />
              )}
            </Pressable>
            {open ? (
              <>
                <Txt muted>{topic.answer}</Txt>
                <Button
                  compact
                  secondary
                  title={topic.link}
                  onPress={() => router.push(topic.path)}
                />
              </>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}
