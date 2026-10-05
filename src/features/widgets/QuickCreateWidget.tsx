import { createWidget, type WidgetEnvironment } from "expo-widgets";
import { Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";

/** A launcher only: editing and every persistent action remain inside the app. */
function QuickCreateWidget(
  _props: Record<string, never>,
  environment: WidgetEnvironment<{ kind?: string }>,
) {
  "widget";
  const kind = environment.configuration?.kind ?? "beacon";
  const title =
    kind === "plan"
      ? "Make a Beacon Plan"
      : kind === "status"
        ? "Share your status"
        : "Light up a Beacon";
  const url =
    kind === "plan"
      ? "squadbeacon://plans?create=yes"
      : kind === "status"
        ? "squadbeacon://create?kind=status"
        : "squadbeacon://create";
  return (
    <VStack
      alignment="leading"
      spacing={9}
      modifiers={[
        widgetURL(url),
        containerBackground("#173D32", "widget"),
        padding({ all: 14 }),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 28, weight: "bold" }),
          foregroundStyle("#D5EDB7"),
        ]}
      >
        {kind === "plan" ? "▤" : "+"}
      </Text>
      <Text
        modifiers={[
          font({ size: 16, weight: "bold" }),
          foregroundStyle("#FFFFFF"),
          lineLimit(2),
        ]}
      >
        {title}
      </Text>
      <Text
        modifiers={[
          font({ size: 11 }),
          foregroundStyle("#D5EDB7"),
          lineLimit(2),
        ]}
      >
        {kind === "plan"
          ? "A few stops. One good day."
          : "A small idea. A little company."}
      </Text>
    </VStack>
  );
}

export default createWidget("QuickCreateWidget", QuickCreateWidget);
