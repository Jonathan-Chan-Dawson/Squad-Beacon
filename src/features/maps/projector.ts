import type { beaconPinEmphasis } from "./markerIdentity";

export function beaconProjectionDimensions(tier: "close" | "medium" | "far") {
  if (tier === "close") return { height: 23, width: 36, opacity: 0.9 };
  if (tier === "medium") return { height: 20, width: 31, opacity: 0.85 };
  return { height: 16, width: 26, opacity: 0.78 };
}

export function appendBeaconUpperBeam(
  parent: HTMLElement,
  lighting: NonNullable<ReturnType<typeof beaconPinEmphasis>>,
  top: number,
  center?: number,
) {
  const { color, core, beamHeight, beamWidth, coreWidth, beamOpacity } = lighting;
  const light = document.createElement("span");
  light.dataset.testid = "beacon-marker-beam";
  light.setAttribute("aria-hidden", "true");
  light.style.cssText = `position:absolute;top:${top - beamHeight + 2}px;left:${center === undefined ? "50%" : `${center}px`};width:${beamWidth}px;height:${beamHeight}px;transform:translateX(-50%);opacity:${beamOpacity};background:linear-gradient(to top,${core},${color} 34%,${color}90 58%,transparent 92%) center / ${coreWidth}px 100% no-repeat,radial-gradient(ellipse at bottom,${color}c0,${color}50 44%,transparent 80%);border-radius:50% 50% 4px 4px;pointer-events:none;`;
  parent.append(light);
}

export function appendMapProjector(
  parent: HTMLElement,
  color: string,
  top: number,
  height: number,
  width: number,
  opacity: number,
  kind: "beacon" | "person" | "cluster",
  center?: number,
) {
  const projector = document.createElement("span");
  projector.dataset.testid = `map-${kind}-projector`;
  projector.setAttribute("aria-hidden", "true");
  projector.style.cssText = `position:absolute;left:${center === undefined ? "50%" : `${center}px`};top:${top}px;width:${width}px;height:${height}px;transform:translateX(-50%);pointer-events:none;opacity:${opacity};color:${color};`;
  const beam = document.createElement("span");
  beam.style.cssText =
    "position:absolute;inset:0;background:linear-gradient(transparent, currentColor 52%, currentColor);clip-path:polygon(15% 0,85% 0,56% 100%,44% 100%);";
  const core = document.createElement("span");
  core.style.cssText =
    "position:absolute;inset:0;background:linear-gradient(transparent 12%, #ffffff50 72%, #ffffffb3);clip-path:polygon(37% 0,63% 0,52% 100%,48% 100%);";
  const base = document.createElement("span");
  base.dataset.projectorPart = "base";
  base.style.cssText =
    "position:absolute;inset:auto 0 -5px;height:10px;border-radius:50%;background:radial-gradient(ellipse,#ffffffb3 8%,currentColor 22%,transparent 48%,currentColor 61%,transparent 72%);";
  projector.append(beam, core, base);
  parent.append(projector);
}
