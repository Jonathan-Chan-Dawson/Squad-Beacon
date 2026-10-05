import { createWidget, type WidgetEnvironment } from "expo-widgets";
import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type {
  FriendStatusFeed,
  WidgetPayload,
} from "@/src/features/widgets/types";

type Configuration = { circle?: string };

function FriendsNowWidget(
  props: WidgetPayload,
  environment: WidgetEnvironment<Configuration>,
) {
  "widget";
  const selected = environment.configuration?.circle ?? "all";
  const feed: FriendStatusFeed =
    selected === "circle1"
      ? props.circles.circle1
      : selected === "circle2"
        ? props.circles.circle2
        : selected === "circle3"
          ? props.circles.circle3
          : props.allFriends;
  const accessory = environment.widgetFamily.startsWith("accessory");
  if (props.stale) {
    if (environment.widgetFamily === "accessoryInline")
      return (
        <Text modifiers={[widgetURL("squadbeacon://activities")]}>
          Open Squad Beacon to refresh
        </Text>
      );
    if (environment.widgetFamily === "accessoryRectangular")
      return (
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[widgetURL("squadbeacon://activities")]}
        >
          <Text
            modifiers={[font({ size: 10, weight: "semibold" }), lineLimit(3)]}
          >
            Open Squad Beacon to refresh
          </Text>
        </VStack>
      );
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          widgetURL("squadbeacon://activities"),
          containerBackground("#F2F6EE", "widget"),
          padding({ all: 12 }),
        ]}
      >
        <Text
          modifiers={[
            font({ size: 12, weight: "bold" }),
            foregroundStyle("#28775C"),
          ]}
        >
          STATUS PAUSED
        </Text>
        <Text
          modifiers={[
            font({ size: 16, weight: "semibold" }),
            foregroundStyle("#173D32"),
            lineLimit(3),
          ]}
        >
          Open Squad Beacon to refresh
        </Text>
      </VStack>
    );
  }
  const heading = selected === "all" ? "Friends now" : feed.title;
  if (environment.widgetFamily === "accessoryInline")
    return (
      <Text modifiers={[widgetURL("squadbeacon://activities")]}>
        {`${feed.freeCount} free · ${feed.totalCount} friends`}
      </Text>
    );
  if (environment.widgetFamily === "accessoryRectangular")
    return (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[widgetURL("squadbeacon://activities")]}
      >
        <Text modifiers={[font({ size: 12, weight: "semibold" })]}>
          {heading}
        </Text>
        <Text modifiers={[font({ size: 16, weight: "bold" })]}>
          {`${feed.freeCount} free · ${feed.activeCount} at beacons`}
        </Text>
      </VStack>
    );

  const homeModifiers = accessory
    ? [widgetURL("squadbeacon://activities")]
    : [
        widgetURL("squadbeacon://activities"),
        containerBackground("#F2F6EE", "widget"),
        padding({ all: 12 }),
      ];
  if (environment.widgetFamily === "systemSmall")
    return (
      <VStack alignment="leading" spacing={7} modifiers={homeModifiers}>
        <Text
          modifiers={[
            font({ size: 12, weight: "bold" }),
            foregroundStyle("#28775C"),
            lineLimit(1),
          ]}
        >
          {heading.toUpperCase()}
        </Text>
        <Text
          modifiers={[
            font({ size: 29, weight: "bold" }),
            foregroundStyle("#173D32"),
          ]}
        >
          {String(feed.freeCount)}
        </Text>
        <Text
          modifiers={[
            font({ size: 13, weight: "medium" }),
            foregroundStyle("#173D32"),
          ]}
        >
          free right now
        </Text>
        <Text
          modifiers={[
            font({ size: 11 }),
            foregroundStyle("#587568"),
            lineLimit(2),
          ]}
        >
          {feed.friends[0]
            ? `${feed.friends[0].name} · ${feed.friends[0].status}`
            : "Your people will show up here"}
        </Text>
      </VStack>
    );

  const rows = feed.friends.slice(
    0,
    environment.widgetFamily === "systemLarge" ? 6 : 3,
  );
  return (
    <VStack alignment="leading" spacing={8} modifiers={homeModifiers}>
      <HStack spacing={8}>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ size: 15, weight: "bold" }),
              foregroundStyle("#173D32"),
            ]}
          >
            {heading}
          </Text>
          <Text modifiers={[font({ size: 11 }), foregroundStyle("#587568")]}>
            A little window into your people
          </Text>
        </VStack>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 13, weight: "bold" }),
            foregroundStyle("#28775C"),
          ]}
        >
          {`${feed.freeCount} free`}
        </Text>
      </HStack>
      {rows.length === 0 ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle("#587568")]}>
          No friends in this circle yet.
        </Text>
      ) : (
        rows.map((friend, index) => (
          <HStack key={`${friend.name}-${index}`} spacing={8}>
            <Text
              modifiers={[
                font({ size: 14, weight: "bold" }),
                foregroundStyle(
                  friend.availability === "ending-soon"
                    ? "#97700C"
                    : friend.availability === "unavailable"
                      ? "#AD3E3E"
                      : friend.free
                        ? "#28775C"
                        : "#A7B7A8",
                ),
              ]}
            >
              {friend.initials ??
                (friend.free ? "●" : friend.active ? "◉" : "○")}
            </Text>
            <VStack alignment="leading" spacing={1}>
              <Text
                modifiers={[
                  font({ size: 12, weight: "semibold" }),
                  foregroundStyle("#173D32"),
                  lineLimit(1),
                ]}
              >
                {friend.name}
              </Text>
              <Text
                modifiers={[
                  font({ size: 10 }),
                  foregroundStyle("#587568"),
                  lineLimit(1),
                ]}
              >
                {friend.status}
                {friend.detail && friend.active ? ` · ${friend.detail}` : ""}
              </Text>
            </VStack>
            <Spacer />
          </HStack>
        ))
      )}
      <Spacer />
      <Text modifiers={[font({ size: 9 }), foregroundStyle("#587568")]}>
        Updated when you open Squad Beacon
      </Text>
    </VStack>
  );
}

export default createWidget("FriendsNowWidget", FriendsNowWidget);
