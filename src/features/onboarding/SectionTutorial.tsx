import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { useIsFocused } from "expo-router";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { Dialog } from "@/src/shared/Dialogs";
import { hasActiveOverlay, subscribeToSheetStack } from "@/src/shared/overlays";
import { BeaconIllustration, type IllustrationKey } from "./illustrations";
import {
  finishVisitorWelcome,
  noteVisitorWelcomeSeen,
  tutorialHandled,
  finishTutorial,
  visitorWelcomeHandled,
} from "./visitorEntry";

export const tutorials = {
  welcome: {
    label: "Welcome",
    title: "Welcome to Squad Beacon!",
    art: "welcome",
    copy: "Find your people, discover activities, and turn everyday ideas into something worth doing.",
    tips: [
      ["Explore Beacons", "Browse public activities or see them on the Map."],
      ["Your Activity", "Find your current and upcoming plans here when you’re signed in."],
    ],
  },
  map: {
    label: "Map",
    title: "Welcome to the Map!",
    art: "discovery",
    copy: "Discover activities and see what’s happening around you.",
    tips: [
      [
        "Beacon markers",
        "Tap a marker for activity details or a group of nearby Beacons.",
      ],
      ["Search and filters", "Find public Beacons and narrow what you see."],
      [
        "Friends and Sonar",
        "Friends appear when sharing is permitted. Sharing is optional.",
      ],
    ],
  },
  squads: {
    label: "Squads and Chats",
    title: "Find your people.",
    art: "noSquads",
    copy: "Keep your conversations and communities close.",
    tips: [
      ["Chats", "Open a conversation with your friends."],
      ["Squads", "Find or join a smaller group in Communities."],
      ["Organizations and Networks", "Explore broader communities."],
    ],
  },
  profile: {
    label: "Profile",
    title: "Make it yours.",
    art: "noFriends",
    copy: "Give friends a quick picture of what you’re up to.",
    tips: [
      ["Availability and status", "Let friends know when you’re free."],
      [
        "Current Activity and Up Next",
        "Show what you’re doing and see your next scheduled activity.",
      ],
      ["Profile sharing", "Personalize your profile and share it from here."],
    ],
  },
  create: {
    label: "Create",
    title: "Make something happen.",
    art: "plans",
    copy: "Choose the tool that fits what you need.",
    tips: [
      ["Beacon", "Make an activity happen."],
      ["Ping", "See who’s interested."],
      [
        "Vote or Find a Time",
        "Decide together or coordinate availability. Draw can make a random choice.",
      ],
      ["Plan", "Organize activities and ideas."],
    ],
  },
} satisfies Record<
  string,
  {
    label: string;
    title: string;
    art: IllustrationKey;
    copy: string;
    tips: string[][];
  }
>;

export type Tutorial = keyof typeof tutorials;

export function TutorialDialog({
  item,
  close,
  visible = true,
}: {
  item: Tutorial;
  close: () => void;
  visible?: boolean;
}) {
  const { styles, tokens } = useTheme();
  const tutorial = tutorials[item];
  return (
    <Dialog title={tutorial.title} visible={visible} onClose={close}>
      <View style={{ gap: tokens.space.sm }}>
        <View style={{ alignItems: "center" }}>
          <BeaconIllustration name={tutorial.art} size={72} />
        </View>
        <Txt muted>{tutorial.copy}</Txt>
        {tutorial.tips.length > 0 && (
          <View style={[styles.card, { gap: tokens.space.sm }]}>
            {tutorial.tips.map(([label, description]) => (
              <View key={label} style={{ gap: tokens.space.xxs }}>
                <Text style={styles.label}>{label}</Text>
                <Txt>{description}</Txt>
              </View>
            ))}
          </View>
        )}
        <Button
          compact
          title={item === "welcome" ? "Let’s explore" : "Got it"}
          onPress={close}
        />
        {item === "welcome" && (
          <Button compact secondary title="Skip introduction" onPress={close} />
        )}
      </View>
    </Dialog>
  );
}

export function SectionTutorial({ item }: { item: Tutorial }) {
  const focused = useIsFocused();
  const hasOverlay = useSyncExternalStore(
    subscribeToSheetStack,
    hasActiveOverlay,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    if (item === "welcome") finishVisitorWelcome();
    else finishTutorial(item);
    setOpen(false);
  }, [item]);
  useEffect(() => {
    if (
      !focused ||
      open ||
      hasOverlay ||
      (item === "welcome" ? visitorWelcomeHandled() : tutorialHandled(item))
    )
      return;
    const timer = setTimeout(() => {
      if (hasActiveOverlay()) return;
      if (item === "welcome") noteVisitorWelcomeSeen();
      setOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [focused, hasOverlay, item, open]);
  return <TutorialDialog item={item} close={close} visible={open && focused} />;
}
