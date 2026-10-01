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
import type { BeaconFeed, WidgetPayload } from "./types";

type Configuration = { circle?: string };

function SquadBeaconsWidget(
  props: WidgetPayload,
  environment: WidgetEnvironment<Configuration>,
) {
  "widget";
  if (props.stale)
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          widgetURL("squadbeacon://"),
          containerBackground("#173D32", "widget"),
          padding({ all: 13 }),
        ]}
      >
        <Text
          modifiers={[
            font({ size: 10, weight: "bold" }),
            foregroundStyle("#DDF5A1"),
          ]}
        >
          MAP-INSPIRED CIRCLE SIGNAL
        </Text>
        <Text
          modifiers={[
            font({ size: 16, weight: "semibold" }),
            foregroundStyle("#FFFFFF"),
            lineLimit(3),
          ]}
        >
          Open Squad Beacon to refresh
        </Text>
      </VStack>
    );
  const selected = environment.configuration?.circle ?? "circle1";
  const feed: BeaconFeed =
    selected === "circle2"
      ? props.circleBeacons.circle2
      : selected === "circle3"
        ? props.circleBeacons.circle3
        : props.circleBeacons.circle1;
  const rows = feed.beacons.slice(
    0,
    environment.widgetFamily === "systemLarge" ? 4 : 2,
  );
  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[
        widgetURL("squadbeacon://"),
        containerBackground("#173D32", "widget"),
        padding({ all: 13 }),
      ]}
    >
      <HStack>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ size: 10, weight: "bold" }),
              foregroundStyle("#DDF5A1"),
            ]}
          >
            MAP-INSPIRED CIRCLE SIGNAL
          </Text>
          <Text
            modifiers={[
              font({ size: 17, weight: "bold" }),
              foregroundStyle("#FFFFFF"),
              lineLimit(1),
            ]}
          >
            {feed.title}
          </Text>
        </VStack>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 11, weight: "semibold" }),
            foregroundStyle("#DDF5A1"),
          ]}
        >{`${feed.beacons.filter((beacon) => beacon.state === "live").length} LIVE`}</Text>
      </HStack>
      <Text
        modifiers={[
          font({ size: 15, weight: "bold" }),
          foregroundStyle("#8DE1CC"),
        ]}
      >
        {feed.beacons.length ? "●━━━━●━━━━●" : "○  ·  ○  ·  ○"}
      </Text>
      {rows.length === 0 ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle("#D9E6DA")]}>
          No beacons on the map right now.
        </Text>
      ) : (
        rows.map((beacon, index) => (
          <HStack key={`${beacon.title}-${index}`} spacing={7}>
            <Text
              modifiers={[
                font({ size: 11, weight: "bold" }),
                foregroundStyle(
                  beacon.state === "live" ? "#DDF5A1" : "#8DE1CC",
                ),
              ]}
            >
              ●
            </Text>
            <VStack alignment="leading" spacing={1}>
              <Text
                modifiers={[
                  font({ size: 12, weight: "semibold" }),
                  foregroundStyle("#FFFFFF"),
                  lineLimit(1),
                ]}
              >
                {beacon.title}
              </Text>
              <Text
                modifiers={[
                  font({ size: 10 }),
                  foregroundStyle("#C2D6CA"),
                  lineLimit(1),
                ]}
              >
                {beacon.state === "live"
                  ? "Happening now"
                  : `${beacon.category} · `}
              </Text>
            </VStack>
            <Spacer />
            {beacon.state === "upcoming" ? (
              <Text
                date={new Date(beacon.startEpoch)}
                dateStyle="relative"
                modifiers={[font({ size: 10 }), foregroundStyle("#DDF5A1")]}
              />
            ) : null}
          </HStack>
        ))
      )}
      <Spacer />
      <Text modifiers={[font({ size: 9 }), foregroundStyle("#C2D6CA")]}>
        Map-inspired · no live locations shown
      </Text>
    </VStack>
  );
}

export default createWidget("SquadBeaconsWidget", SquadBeaconsWidget);
