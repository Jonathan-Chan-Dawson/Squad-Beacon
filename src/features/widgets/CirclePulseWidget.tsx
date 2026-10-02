import { createWidget } from "expo-widgets";
import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetPayload } from "@/src/features/widgets/types";

function CirclePulseWidget(props: WidgetPayload) {
  "widget";
  if (props.stale)
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          widgetURL("squadbeacon://activities"),
          containerBackground("#EAF2F0", "widget"),
          padding({ all: 13 }),
        ]}
      >
        <Text
          modifiers={[
            font({ size: 10, weight: "bold" }),
            foregroundStyle("#28775C"),
          ]}
        >
          CIRCLE PULSE
        </Text>
        <Text
          modifiers={[
            font({ size: 16, weight: "semibold" }),
            foregroundStyle("#173D32"),
          ]}
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
        containerBackground("#EAF2F0", "widget"),
        padding({ all: 13 }),
      ]}
    >
      <HStack>
        <Text
          modifiers={[
            font({ size: 10, weight: "bold" }),
            foregroundStyle("#28775C"),
          ]}
        >
          YOUR CIRCLE, AT A GLANCE
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 12, weight: "bold" }),
            foregroundStyle("#28775C"),
          ]}
        >
          ✦
        </Text>
      </HStack>
      <HStack spacing={12}>
        <VStack alignment="leading" spacing={1}>
          <Text
            modifiers={[
              font({ size: 28, weight: "bold" }),
              foregroundStyle("#173D32"),
            ]}
          >
            {String(props.pulse.freeCount)}
          </Text>
          <Text
            modifiers={[
              font({ size: 10, weight: "semibold" }),
              foregroundStyle("#587568"),
            ]}
          >
            FREE NOW
          </Text>
        </VStack>
        <VStack alignment="leading" spacing={1}>
          <Text
            modifiers={[
              font({ size: 28, weight: "bold" }),
              foregroundStyle("#173D32"),
            ]}
          >
            {String(props.pulse.activeCount)}
          </Text>
          <Text
            modifiers={[
              font({ size: 10, weight: "semibold" }),
              foregroundStyle("#587568"),
            ]}
          >
            AT BEACONS
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={1}>
          <Text
            modifiers={[
              font({ size: 18, weight: "bold" }),
              foregroundStyle("#28775C"),
            ]}
          >
            {String(props.pulse.friendCount)}
          </Text>
          <Text modifiers={[font({ size: 10 }), foregroundStyle("#587568")]}>
            friends
          </Text>
        </VStack>
      </HStack>
      <Text modifiers={[font({ size: 11 }), foregroundStyle("#587568")]}>
        Small signals make good plans.
      </Text>
    </VStack>
  );
}

export default createWidget("CirclePulseWidget", CirclePulseWidget);
