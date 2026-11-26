import { useId } from "react";
import { clusterPrism } from "../projector";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Polygon,
  RadialGradient,
  Stop,
} from "react-native-svg";

export function MapProjector({
  color,
  top,
  height,
  width,
  center,
  opacity,
  kind,
}: {
  color: string;
  top: number;
  height: number;
  width: number;
  center: number;
  opacity: number;
  kind: "beacon" | "person" | "cluster";
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const prism = kind === "cluster";
  const beamStops = prism
    ? [
        ["0%", clusterPrism.ice, 0],
        ["28%", clusterPrism.ice, 1],
        ["55%", clusterPrism.pearl, 1],
        ["78%", clusterPrism.lilac, 1],
        ["100%", clusterPrism.blush, 1],
      ] as const
    : [["0%", color, 0], ["52%", color, 1], ["100%", color, 1]] as const;
  return (
    <Svg
      testID={`map-${kind}-projector`}
      accessible={false}
      pointerEvents="none"
      width={width}
      height={height + 5}
      style={{ position: "absolute", top, left: center - width / 2, opacity }}
    >
      <Defs>
        <LinearGradient id={`${id}beam`} x1="0%" x2="0%" y1="0%" y2="100%">
          {beamStops.map(([offset, stopColor, stopOpacity]) => (
            <Stop key={offset} offset={offset} stopColor={stopColor} stopOpacity={stopOpacity} />
          ))}
        </LinearGradient>
        <LinearGradient id={`${id}core`} x1="0%" x2="0%" y1="0%" y2="100%">
          <Stop offset="12%" stopColor="#fff" stopOpacity={0} />
          <Stop offset="72%" stopColor="#fff" stopOpacity={0.31} />
          <Stop offset="100%" stopColor="#fff" stopOpacity={0.7} />
        </LinearGradient>
        <RadialGradient id={`${id}base`}>
          <Stop offset="8%" stopColor="#fff" stopOpacity={0.7} />
          <Stop offset="22%" stopColor={prism ? clusterPrism.ice : color} />
          <Stop offset="48%" stopColor={color} stopOpacity={0} />
          <Stop offset="61%" stopColor={prism ? clusterPrism.lilac : color} />
          <Stop offset="72%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Polygon
        points={`${width * 0.15},0 ${width * 0.85},0 ${width * 0.56},${height} ${width * 0.44},${height}`}
        fill={`url(#${id}beam)`}
      />
      <Polygon
        points={`${width * 0.37},0 ${width * 0.63},0 ${width * 0.52},${height} ${width * 0.48},${height}`}
        fill={`url(#${id}core)`}
      />
      <Ellipse
        cx={width / 2}
        cy={height}
        rx={width / 2}
        ry={5}
        fill={`url(#${id}base)`}
      />
    </Svg>
  );
}
