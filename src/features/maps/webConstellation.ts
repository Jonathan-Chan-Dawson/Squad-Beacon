import { appendBeaconUpperBeam, appendMapProjector } from "./projector";
import {
  beaconPinEmphasis,
  beaconMarkerColor,
  stellarRelationships,
  mapIdentityColors,
  distantBeaconPinEmphasis,
  type BeaconMarkerState,
} from "./markerIdentity";
import {
  clusterCountParts,
  clusterCountAccessibilityLabel,
  CLUSTER_COUNT_PATHS,
  CLUSTER_FRIEND_SHADOW_OPACITY,
  CLUSTER_SHADOW_OPACITY,
} from "./clusterLayout";
import {
  bloomGeometry,
  bloomAccessibilityLabel,
  petalBookmarkVisible,
  STELLAR_OUTLINE, STELLAR_CORE, STELLAR_FACETS, STELLAR_PEOPLE, STELLAR_OPACITY, STELLAR_PERSON, ROUND_SIGNAL, ROUND_SIGNAL_CORE, ROUND_SIGNAL_FACETS,
} from "./clusterBloom";
import type { ClusterPoint } from "./cluster";
import {
  presentationOpensExplorer,
  type NativeMapPresentation,
} from "./nativeMapPresentation";

type Options = {
  member: (point: ClusterPoint) => HTMLButtonElement;
  open: (section?: "Beacons" | "Friends") => void;
  ink: string;
  friendColor?: (point: ClusterPoint) => string;
  friendAvatar?: (point: ClusterPoint) => string | undefined;
  surface: string;
  line: string;
  categoryColor: (category: NonNullable<ClusterPoint["category"]>) => string;
  beaconState?: (point: ClusterPoint) => BeaconMarkerState | undefined;
};
/** The foreground, density marks, and count positions use the same geometry as native. */
export function webConstellation(
  presentation: NativeMapPresentation,
  options: Options,
) {
  const { group, mode } = presentation;
  const geometry = bloomGeometry(presentation),
    { size, center, markerSize } = geometry;
  const explorer = !!presentationOpensExplorer(presentation);
  const node = document.createElement("div");
  node.dataset.testid = "map-constellation";
  node.dataset.mode = mode;
  node.dataset.zoomTier = presentation.scale;
  node.dataset.memberCount = String(group.members.length);
  node.dataset.beaconCount = String(presentation.beacons.length);
  node.dataset.friendCount = String(presentation.people.length);
  node.style.cssText = `position:relative;width:${size}px;height:${size}px;pointer-events:none;`;
  node.setAttribute("aria-label", bloomAccessibilityLabel(presentation));
  node.setAttribute("role", explorer ? "button" : "group");
  if (explorer) node.tabIndex = 0;
  const hit = document.createElement("span");
  hit.setAttribute("aria-hidden", "true");
  hit.style.cssText =
    "position:absolute;inset:0;border-radius:50%;pointer-events:auto;cursor:pointer;";
  node.append(hit);
  if (geometry.shadowSize) {
    const shadow = document.createElement("span");
    shadow.dataset.testid = "cluster-circle-shadow";
    shadow.setAttribute("aria-hidden", "true");
    const opacity = geometry.friendsOnly
      ? CLUSTER_FRIEND_SHADOW_OPACITY
      : CLUSTER_SHADOW_OPACITY;
    shadow.style.cssText = `position:absolute;left:${geometry.shadowLeft}px;top:${geometry.shadowTop}px;width:${geometry.shadowSize}px;height:${geometry.shadowSize}px;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,${opacity}),transparent 72%);pointer-events:none;`;
    node.append(shadow);
  }
  const projector = geometry.projector;
  if (projector) {
    const primary = geometry.primary[0];
    appendMapProjector(
      node,
      explorer ? mapIdentityColors.cluster : beaconMarkerColor(options.beaconState?.(primary)),
      center + projector.top,
      projector.height,
      projector.width,
      projector.opacity,
      explorer ? "cluster" : "beacon",
      center + projector.x,
    );
  }
  const stellar = presentation.scale === "micro";
  const beaconShape = stellar ? STELLAR_OUTLINE : ROUND_SIGNAL;
  if (geometry.signal) {
    const { x, y, width, facets, glow } = geometry.signal;
    const signal = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    signal.setAttribute("data-testid", "cluster-signal");
    signal.setAttribute("data-signal-kind", geometry.friendsOnly ? "people" : stellar ? "stellar" : "round");
    signal.setAttribute("aria-hidden", "true");
    signal.setAttribute("viewBox", "0 0 100 100");
    signal.style.cssText = `position:absolute;left:${center + x - width / 2}px;top:${center + y - width / 2}px;width:${width}px;height:${width}px;opacity:${geometry.friendsOnly ? 1 : STELLAR_OPACITY};pointer-events:none;`;
    const path = (d: string, color: string, stroke?: string, strokeWidth?: number) => {
      const part = document.createElementNS("http://www.w3.org/2000/svg", "path");
      part.setAttribute("d", d);
      part.setAttribute("fill", color);
      if (stroke && strokeWidth) {
        part.setAttribute("stroke", stroke);
        part.setAttribute("stroke-width", String(strokeWidth));
        part.setAttribute("stroke-linejoin", "round");
      }
      signal.append(part);
      return part;
    };
    if (geometry.friendsOnly) {
      path(STELLAR_PEOPLE, "#B5CCEC", "#293750", 8);
    } else {
      if (glow) path(beaconShape, "none", "#CFB9FF", width >= 36 ? 8 : 5).setAttribute("opacity", "0.36");
      path(beaconShape, "#E8DFFD", "#594A78", 3);
      stellarRelationships(presentation.beacons, point => options.beaconState?.(point), facets)
        .forEach((relationship, index) => {
          path((stellar ? STELLAR_FACETS : ROUND_SIGNAL_FACETS)[index], mapIdentityColors[relationship]).setAttribute("data-relationship", relationship);
        });
      path(stellar ? STELLAR_CORE : ROUND_SIGNAL_CORE, "#FFF4DE").setAttribute("opacity", "0.93");
    }
    node.append(signal);
  }
  const appendFriendAvatar = (marker: HTMLElement, point: ClusterPoint) => {
    const source = options.friendAvatar?.(point);
    if (!source) return;
    const avatar = document.createElement("img");
    avatar.src = source;
    avatar.alt = "";
    avatar.style.cssText =
      "width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;";
    marker.append(avatar);
  };
  const items: HTMLElement[] = [];
  geometry.primary.forEach((point, index) => {
    const accent =
      !explorer && point.kind === "beacon" && presentation.scale !== "close"
        ? distantBeaconPinEmphasis(
            beaconPinEmphasis(
              options.beaconState?.(point),
              false,
              options.categoryColor(point.category ?? "Other"),
            ),
            presentation.scale,
          )
        : null;
    if (accent?.beamHeight)
      appendBeaconUpperBeam(node, accent, center - markerSize / 2, center);
    const artwork = options.member(point);
    let item: HTMLElement = artwork;
    if (explorer) {
      item = document.createElement("span");
      item.style.cssText = artwork.style.cssText;
      item.append(...Array.from(artwork.childNodes));
      item.setAttribute("aria-hidden", "true");
    }
    item.dataset.memberId = point.id;
    item.classList.add("map-petal-item");
    const offset = geometry.offsets[index] ?? { x: 0, y: 0 };
    Object.assign(item.style, {
      position: "absolute",
      left: `${center - 16 + offset.x}px`,
      top: `${center - 16 + offset.y}px`,
      width: "32px",
      height: "32px",
      zIndex: String(20 - index),
      pointerEvents: explorer ? "none" : "auto",
      transform: `scale(${markerSize / 32})`,
      transformOrigin: "50% 50%",
    });
    if (!explorer) {
      item.style.width = "44px";
      item.style.height = "44px";
      item.style.inset = `${center - 22}px auto auto ${center - 22}px`;
      item.style.transform = "none";
      item.style.justifyContent = "center";
      if (geometry.distant) {
        const person = point.kind === "person";
        const color = person
          ? (options.friendColor?.(point) ?? options.ink)
          : beaconMarkerColor(options.beaconState?.(point));
        const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        glyph.setAttribute("data-testid", person ? "map-single-person-signal" : stellar ? "map-single-stellar-beacon" : "map-single-round-beacon");
        glyph.setAttribute("aria-hidden", "true");
        glyph.setAttribute("viewBox", "0 0 100 100");
        glyph.style.cssText = `width:${markerSize}px;height:${markerSize}px;opacity:${STELLAR_OPACITY};pointer-events:none;`;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", person ? STELLAR_PERSON : beaconShape);
        path.setAttribute("fill", color);
        glyph.append(path);
        item.replaceChildren(glyph);
      } else {
        const face = item.firstElementChild as HTMLElement | null;
        if (face) face.style.transform = `scale(${markerSize / 32})`;
      }
    }
    // Identity decorations never enlarge or obscure the established cluster footprint.
    const badges = item.querySelector('[data-testid="beacon-marker-badges"]');
    if (markerSize < 24 || (badges?.querySelector('[data-testid="beacon-saved-bookmark"]') && !petalBookmarkVisible(geometry, index)))
      badges?.remove();
    items.push(item);
    node.append(item);
  });
  geometry.satellites.forEach((point, index) => {
    const dot = document.createElement("span"),
      offset = geometry.satelliteOffsets[index],
      s = geometry.satelliteSize;
    dot.dataset.testid = "cluster-friend-satellite";
    dot.dataset.memberId = point.id;
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = `position:absolute;left:${center + offset.x - s / 2}px;top:${center + offset.y - s / 2}px;width:${s}px;height:${s}px;box-sizing:border-box;border-radius:50%;background:${options.surface};color:${options.ink};border:1px solid ${options.line};padding:1px;display:flex;align-items:center;justify-content:center;line-height:0;z-index:30;pointer-events:none;opacity:${presentation.friendsProminent ? 0.8 : 0.62};`;
    appendFriendAvatar(dot, point);
    node.append(dot);
  });
  const badge = (text: string, side: "left" | "right", label: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.style.cssText = `position:absolute;${side}:0;bottom:0;min-width:24px;height:20px;padding:0 4px;border:1px solid ${options.line};border-radius:12px;background:${options.surface};color:${options.ink};font:700 10px/18px system-ui;z-index:40;cursor:pointer;pointer-events:auto;`;
    // An invisible 44px target preserves small artwork without shrinking touch targets.
    const target = document.createElement("span");
    target.style.cssText =
      "position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%);";
    button.append(target, document.createTextNode(text));
    return button;
  };
  const renderCount = (
    button: HTMLButtonElement,
    parts: ReturnType<typeof clusterCountParts>,
    fontSize: number,
  ) => {
    button.querySelector("[data-count-content]")?.remove();
    for (const child of Array.from(button.childNodes))
      if (child.nodeType === 3) child.remove();
    const content = document.createElement("span");
    content.dataset.countContent = "true";
    content.setAttribute("aria-hidden", "true");
    content.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;height:100%;pointer-events:none;font-variant-numeric:tabular-nums;";
    parts.forEach((part, index) => {
      if (index) {
        const separator = document.createElement("span");
        separator.textContent = " · ";
        separator.style.cssText = "white-space:pre;margin:0 1px;";
        content.append(separator);
      }
      const segment = document.createElement("span");
      segment.dataset.countKind = part.kind;
      segment.dataset.countValue = String(part.count);
      segment.style.cssText = "display:inline-flex;align-items:center;gap:3px;";
      const icon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("width", String(fontSize));
      icon.setAttribute("height", String(fontSize));
      icon.setAttribute("fill", "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "1.8");
      icon.setAttribute("stroke-linecap", "round");
      icon.setAttribute("stroke-linejoin", "round");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", CLUSTER_COUNT_PATHS[part.kind]);
      icon.append(path);
      segment.append(icon, document.createTextNode(String(part.count)));
      content.append(segment);
    });
    button.append(content);
  };
  let clusterBadge: HTMLButtonElement | undefined;
  const restoreCount = () => {
    if (!clusterBadge) return;
    const anchor = geometry.countBadge;
    if (!anchor) {
      clusterBadge.style.display = "none";
      return;
    }
    clusterBadge.style.display = "block";
    clusterBadge.style.left = `${center + anchor.offset.x - anchor.width / 2}px`;
    clusterBadge.style.top = `${center + anchor.offset.y - anchor.height / 2}px`;
    clusterBadge.style.right = "auto";
    clusterBadge.style.bottom = "auto";
    clusterBadge.style.width = `${anchor.width}px`;
    clusterBadge.style.height = `${anchor.height}px`;
    clusterBadge.style.font = `700 ${anchor.fontSize}px/${anchor.height - 2}px system-ui`;
    renderCount(clusterBadge, anchor.parts, anchor.fontSize);
    clusterBadge.setAttribute(
      "aria-label",
      `${clusterCountAccessibilityLabel(anchor.peopleCount, anchor.beaconTotal)}. Nearby does not mean attending. ${presentation.group.members.length <= 5 ? "Choose from nearby items" : "Open searchable cluster explorer"}`,
    );
  };
  if (geometry.countBadge) {
    clusterBadge = badge(geometry.countBadge.text, "right", "Explore cluster");
    clusterBadge.dataset.testid = "map-cluster-count";
    clusterBadge.dataset.clusterCount = "true";
    clusterBadge.style.minWidth = "0";
    clusterBadge.style.padding = "0";
    clusterBadge.style.boxSizing = "border-box";
    clusterBadge.onclick = (event) => {
      event.stopPropagation();
      options.open(
        geometry.countBadge?.activation === "friends" ? "Friends" : undefined,
      );
    };
    node.append(clusterBadge);
    restoreCount();
  }
  node.addEventListener(
    "click",
    (event) => {
      if (
        (event.target as HTMLElement).closest(
          '[data-friends="true"],[data-cluster-count="true"]',
        )
      )
        return;
      if (explorer) {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        options.open(geometry.friendsOnly ? "Friends" : undefined);
      } else if (!(event.target as HTMLElement).closest("[data-member-id]")) {
        event.stopPropagation();
        items[0]?.click();
      }
    },
    true,
  );
  node.addEventListener("keydown", (event) => {
    if (
      explorer &&
      (event.key === "Enter" || event.key === " ") &&
      event.target === node
    ) {
      event.preventDefault();
      event.stopPropagation();
      options.open(geometry.friendsOnly ? "Friends" : undefined);
    }
  });
  return { node, size };
}
