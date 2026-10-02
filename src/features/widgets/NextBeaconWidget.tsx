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
import type { WidgetPayload } from "@/src/features/widgets/types";

function NextBeaconWidget(
  props: WidgetPayload,
  environment: WidgetEnvironment,
) {
  "widget";
  if (props.stale) {
    if (environment.widgetFamily === "accessoryInline")
      return (
        <Text
          modifiers={[
            widgetURL("squadbeacon://activities"),
            font({ size: 8 }),
            lineLimit(3),
          ]}
        >
          Open Squad Beacon to refresh
        </Text>
      );
    if (environment.widgetFamily === "accessoryCircular")
      return (
        <VStack
          alignment="center"
          spacing={0}
          modifiers={[widgetURL("squadbeacon://activities")]}
        >
          <Text
            modifiers={[font({ size: 7, weight: "semibold" }), lineLimit(3)]}
          >
            Open Squad Beacon to refresh
          </Text>
        </VStack>
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
          containerBackground("#FFF4ED", "widget"),
          padding({ all: 13 }),
        ]}
      >
        <Text
          modifiers={[
            font({ size: 10, weight: "bold" }),
            foregroundStyle("#AA4261"),
          ]}
        >
          BEACON STATUS
        </Text>
        <Text
          modifiers={[
            font({ size: 16, weight: "semibold" }),
            foregroundStyle("#522C47"),
            lineLimit(3),
          ]}
        >
          Open Squad Beacon to refresh
        </Text>
      </VStack>
    );
  }
  const next = props.nextBeacon;
  if (environment.widgetFamily === "accessoryInline")
    return (
      <Text modifiers={[widgetURL("squadbeacon://activities")]}>
        {next
          ? next.live
            ? "Beacon live now"
            : "Next beacon · "
          : "No beacon planned"}
        {next && !next.live ? (
          <Text date={new Date(next.startEpoch)} dateStyle="relative" />
        ) : null}
      </Text>
    );
  if (environment.widgetFamily === "accessoryCircular")
    return (
      <VStack spacing={2} modifiers={[widgetURL("squadbeacon://activities")]}>
        <Text modifiers={[font({ size: 10, weight: "bold" })]}>
          {next?.live ? "LIVE" : "NEXT"}
        </Text>
        <Text modifiers={[font({ size: 15, weight: "bold" })]}>
          {next ? "●" : "○"}
        </Text>
      </VStack>
    );
  if (environment.widgetFamily === "accessoryRectangular")
    return (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[widgetURL("squadbeacon://activities")]}
      >
        <Text modifiers={[font({ size: 11, weight: "bold" })]}>
          {next?.live ? "HAPPENING NOW" : "NEXT BEACON"}
        </Text>
        <Text
          modifiers={[font({ size: 15, weight: "semibold" }), lineLimit(1)]}
        >
          {next
            ? next.live
              ? "Beacon is live"
              : "Next beacon"
            : "Nothing on deck"}
        </Text>
        {next && !next.live ? (
          <Text
            date={new Date(next.startEpoch)}
            dateStyle="relative"
            modifiers={[font({ size: 11 })]}
          />
        ) : null}
      </VStack>
    );

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[
        widgetURL("squadbeacon://activities"),
        containerBackground("#FFF4ED", "widget"),
        padding({ all: 13 }),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 10, weight: "bold" }),
          foregroundStyle("#AA4261"),
        ]}
      >
        YOUR NEXT BEACON
      </Text>
      {next ? (
        <>
          <Text
            modifiers={[
              font({ size: 19, weight: "bold" }),
              foregroundStyle("#522C47"),
              lineLimit(2),
            ]}
          >
            {next.title}
          </Text>
          <Text
            modifiers={[
              font({ size: 11, weight: "semibold" }),
              foregroundStyle("#846275"),
            ]}
          >
            {next.live ? "Happening now" : next.category}
          </Text>
          {!next.live ? (
            <Text
              date={new Date(next.startEpoch)}
              dateStyle="relative"
              modifiers={[
                font({ size: 15, weight: "bold" }),
                foregroundStyle("#AA4261"),
              ]}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text
            modifiers={[
              font({ size: 18, weight: "bold" }),
              foregroundStyle("#522C47"),
            ]}
          >
            Nothing on deck
          </Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle("#846275")]}>
            Make a plan with your people.
          </Text>
        </>
      )}
      <Spacer />
      <HStack>
        <Text
          modifiers={[
            font({ size: 10, weight: "semibold" }),
            foregroundStyle("#AA4261"),
          ]}
        >
          OPEN ACTIVITIES
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 10 }), foregroundStyle("#846275")]}>
          Squad Beacon
        </Text>
      </HStack>
    </VStack>
  );
}

export default createWidget("NextBeaconWidget", NextBeaconWidget);
