import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useDesignTheme } from "@/src/shared/design-system";
import type { Category } from "@/src/shared/types";

export const beaconArtworkStyles = [
  "Constellation",
  "Gradient",
  "Waves",
  "Minimal",
  "Orbit",
  "Stipple",
] as const;
export type BeaconArtworkStyle = (typeof beaconArtworkStyles)[number];

const accentCategories = {
  ocean: "Study",
  lime: "Social",
  sunset: "Fitness",
  berry: "Creative",
} as const;
const stars = [
  [87, 20],
  [112, 36],
  [140, 17],
  [158, 54],
  [124, 67],
  [183, 25],
] as const;

export function BeaconCardArtwork({
  category,
  accent,
  variant = "Constellation",
  quiet = false,
  radius = 0,
}: {
  category: Category;
  accent?: string | null;
  variant?: BeaconArtworkStyle;
  quiet?: boolean;
  radius?: number;
}) {
  const { colors, categories } = useDesignTheme();
  const gradient = `beacon-art-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const accentCategory =
    accent && Object.hasOwn(accentCategories, accent)
      ? accentCategories[accent as keyof typeof accentCategories]
      : category;
  const color =
    accent === "neutral" || accentCategory === "Other"
      ? colors.textSecondary
      : categories[accentCategory].color;
  const fade = `url(#${gradient})`;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, overflow: "hidden" },
      ]}
    >
      <Svg
        width={quiet ? "84%" : "100%"}
        height={quiet ? 96 : 138}
        viewBox="0 0 190 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", right: 0, top: 0 }}
      >
        <Defs>
          <RadialGradient id={gradient} cx="86%" cy="14%" rx="86%" ry="86%">
            <Stop
              offset="0"
              stopColor={color}
              stopOpacity={variant === "Minimal" ? 0.07 : quiet ? 0.18 : 0.32}
            />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={190} height={100} fill={fade} />
        {variant === "Constellation" && (
          <>
            <Path
              d="M87 20 112 36 140 17 183 25 158 54 124 67 112 36 158 54 140 17"
              fill="none"
              stroke={fade}
              strokeWidth={1.6}
            />
            {stars.map(([x, y]) => (
              <Circle
                key={x}
                cx={x}
                cy={y}
                r={2.5}
                fill={color}
                opacity={quiet ? 0.22 : 0.36}
              />
            ))}
          </>
        )}
        {variant === "Waves" && (
          <Path
            d="M43 30Q86 0 123 27T201 15 M55 46Q95 16 132 43T204 31 M72 61Q111 34 145 59T207 48"
            fill="none"
            stroke={fade}
            strokeWidth={2}
          />
        )}
        {variant === "Orbit" &&
          [15, 28, 42].map((r) => (
            <Circle
              key={r}
              cx={160}
              cy={27}
              r={r}
              fill="none"
              stroke={fade}
              strokeWidth={2}
            />
          ))}
        {variant === "Stipple" &&
          stars.flatMap(([x, y]) => [
            <Circle key={x} cx={x} cy={y} r={3} fill={fade} />,
            <Circle
              key={-x}
              cx={x + 10}
              cy={y + 13}
              r={1.5}
              fill={color}
              opacity={0.2}
            />,
          ])}
      </Svg>
    </View>
  );
}
