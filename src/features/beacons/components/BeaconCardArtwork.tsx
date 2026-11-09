import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
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
  const washOpacity =
    variant === "Gradient"
      ? quiet
        ? 0.13
        : 0.2
      : variant === "Minimal"
        ? 0.035
        : quiet
          ? 0.045
          : 0.075;
  const lineOpacity = quiet ? 0.16 : 0.25;
  const surfaceOpacity = variant === "Minimal" ? 0.035 : quiet ? 0.08 : 0.15;
  const panelInset = quiet ? 5 : 7;
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
      <View
        style={{
          position: "absolute",
          top: panelInset,
          left: panelInset,
          right: panelInset,
          height: quiet ? 84 : 124,
          borderRadius: Math.max(10, radius - panelInset),
          overflow: "hidden",
        }}
      >
        <Svg
          width="100%"
          height="100%"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <Defs>
            <LinearGradient
              id={`${gradient}-header`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop offset="0" stopColor={color} stopOpacity={surfaceOpacity} />
              <Stop
                offset="0.5"
                stopColor={color}
                stopOpacity={surfaceOpacity * 0.6}
              />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradient}-header)`} />
        </Svg>
        <Svg
          width={quiet ? "84%" : "100%"}
          height="100%"
          viewBox="0 0 190 100"
          preserveAspectRatio="xMaxYMin meet"
          style={{ position: "absolute", right: 0, top: 0 }}
        >
          <Defs>
            <RadialGradient id={gradient} cx="94%" cy="10%" rx="86%" ry="86%">
              <Stop offset="0" stopColor={color} stopOpacity={washOpacity} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={190} height={100} fill={fade} />
          {variant === "Constellation" && (
            <>
              <Path
                d="M87 20 112 36 140 17 183 25 158 54 124 67 112 36 158 54 140 17"
                fill="none"
                stroke={color}
                strokeOpacity={lineOpacity}
                strokeWidth={1}
              />
              {stars.map(([x, y]) => (
                <Circle
                  key={x}
                  cx={x}
                  cy={y}
                  r={2}
                  fill={color}
                  opacity={quiet ? 0.22 : 0.32}
                />
              ))}
            </>
          )}
          {variant === "Waves" && (
            <Path
              d="M43 30Q86 0 123 27T201 15 M55 46Q95 16 132 43T204 31 M72 61Q111 34 145 59T207 48"
              fill="none"
              stroke={color}
              strokeOpacity={lineOpacity}
              strokeWidth={1.2}
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
                stroke={color}
                strokeOpacity={lineOpacity}
                strokeWidth={1}
              />
            ))}
          {variant === "Stipple" &&
            stars.flatMap(([x, y]) => [
              <Circle
                key={x}
                cx={x}
                cy={y}
                r={2.2}
                fill={color}
                opacity={lineOpacity}
              />,
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
    </View>
  );
}
