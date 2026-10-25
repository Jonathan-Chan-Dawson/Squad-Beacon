import {
  clusterCountLabel,
  clusterCountWidth,
  friendCountLabel,
  friendCountWidth,
  CLUSTER_FRIEND_SHADOW_OPACITY,
  CLUSTER_MICRO_SHADOW_OPACITY,
  CLUSTER_SHADOW_OPACITY,
} from "./clusterLayout";
import { bloomGeometry, bloomAccessibilityLabel } from "./clusterBloom";
import type { ClusterPoint } from "./cluster";
import {
  nativePetalOffset,
  presentationOpensExplorer,
  type NativeMapPresentation,
} from "./nativeMapPresentation";

type Options = {
  member: (point: ClusterPoint, full?: boolean) => HTMLButtonElement;
  open: (section?: "Beacons" | "Friends") => void;
  ink: string;
  surface: string;
  line: string;
  ownership: string;
  categoryColor: (point: ClusterPoint) => string;
  reducedMotion: boolean;
};
const personSvg =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><circle cx="12" cy="7" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3Z"/></svg>';
/** Same bloom metrics, preview limits and satellites as native; no density disks or avatar piles. */
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
  const shadow = document.createElement("span");
  shadow.dataset.testid = "cluster-circle-shadow";
  shadow.setAttribute("aria-hidden", "true");
  const shadowOpacity = geometry.friendsOnly
    ? CLUSTER_FRIEND_SHADOW_OPACITY
    : presentation.scale === "micro"
      ? CLUSTER_MICRO_SHADOW_OPACITY
      : CLUSTER_SHADOW_OPACITY;
  shadow.style.cssText = `position:absolute;left:${geometry.shadowLeft}px;top:${geometry.shadowTop}px;width:${geometry.shadowSize}px;height:${geometry.shadowSize}px;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,${shadowOpacity}) 0%,rgba(0,0,0,${shadowOpacity * 0.5}) 55%,rgba(0,0,0,0) 100%);pointer-events:none;`;
  node.append(shadow);
  const items: HTMLElement[] = [];
  const dotArtwork = new Map<HTMLElement, Node[]>();
  const primary = explorer
    ? geometry.primary
    : presentation.beacons.length
      ? presentation.beacons
      : presentation.people;
  primary.forEach((point, index) => {
    const artwork = options.member(point, geometry.fullBeacon);
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
    if (geometry.fullBeacon) {
      item.style.left = `${center - 29}px`;
      item.style.top = `${center - 20}px`;
      item.style.width = "58px";
      item.style.height = "56px";
      item.style.transform = "none";
    }
    if (index >= geometry.primary.length) item.style.display = "none";
    // Far friend presence is a dot, never a misleading tiny avatar/attendance badge.
    if (
      geometry.friendsOnly &&
      (presentation.scale === "far" || presentation.scale === "micro")
    ) {
      dotArtwork.set(item, Array.from(item.childNodes));
      item.replaceChildren();
      item.style.borderRadius = "50%";
      item.style.background = options.ink;
      item.style.opacity = presentation.scale === "micro" ? ".35" : ".6";
    }
    items.push(item);
    node.append(item);
  });
  const satelliteNodes: HTMLElement[] = [];
  geometry.satellites.forEach((point, index) => {
    const dot = document.createElement("span"),
      offset = geometry.satelliteOffsets[index],
      s = geometry.satelliteSize;
    dot.dataset.testid = "cluster-friend-satellite";
    dot.dataset.memberId = point.id;
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = `position:absolute;left:${center + offset.x - s / 2}px;top:${center + offset.y - s / 2}px;width:${s}px;height:${s}px;box-sizing:border-box;border-radius:50%;background:${options.surface};color:${options.ink};border:1px solid ${options.ownership};padding:1px;z-index:30;pointer-events:none;opacity:${presentation.scale === "micro" ? 0.8 : 1};`;
    if (s >= 10) dot.innerHTML = personSvg;
    else {
      dot.style.background = options.ownership;
      dot.style.borderColor = options.surface;
    }
    satelliteNodes.push(dot);
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
    clusterBadge.lastChild!.nodeValue = anchor.text;
    clusterBadge.setAttribute(
      "aria-label",
      `${anchor.peopleCount ? `${anchor.peopleCount} nearby friends. ` : ""}${anchor.beaconOverflow ? `${anchor.beaconOverflow} hidden Beacons. ` : ""}${anchor.peopleCount || explorer ? "Open searchable cluster explorer" : "Expand to select every Beacon"}`,
    );
  };
  if (
    geometry.countBadge ||
    (!explorer && presentation.people.length && presentation.beacons.length)
  ) {
    clusterBadge = badge(
      geometry.countBadge?.text ??
        clusterCountLabel(presentation.people.length, 0),
      "right",
      "Explore cluster",
    );
    clusterBadge.dataset.testid = "map-cluster-count";
    clusterBadge.dataset.clusterCount = "true";
    clusterBadge.style.minWidth = "0";
    clusterBadge.style.padding = "0";
    clusterBadge.style.boxSizing = "border-box";
    clusterBadge.onclick = (event) => {
      event.stopPropagation();
      if (
        expanded ||
        (geometry.countBadge?.peopleCount &&
          !geometry.countBadge.beaconOverflow)
      )
        options.open("Friends");
      else if (geometry.countBadge?.peopleCount || explorer) options.open();
      else expand();
    };
    node.append(clusterBadge);
    restoreCount();
  }
  if (geometry.friendsOnly && presentation.people.length >= 5) {
    const count = badge(
      friendCountLabel(presentation.people.length),
      "right",
      `${presentation.people.length} nearby friends; open cluster explorer`,
    );
    count.style.minWidth = `${friendCountWidth(presentation.people.length, presentation.scale === "micro")}px`;
    count.style.left = "50%";
    count.style.right = "auto";
    count.style.bottom = "auto";
    count.style.top = "50%";
    count.style.transform = "translate(-50%,-50%)";
    if (presentation.scale === "micro") {
      count.style.height = "14px";
      count.style.font = "700 8px/12px system-ui";
      count.style.opacity = ".8";
    }
    count.dataset.testid = "cluster-friend-count";
    count.dataset.friends = "true";
    count.onclick = (event) => {
      event.stopPropagation();
      options.open("Friends");
    };
    node.append(count);
  }
  let expanded = false;
  const collapse = () => {
    expanded = false;
    delete node.dataset.expanded;
    shadow.style.display = "";
    restoreCount();
    satelliteNodes.forEach((node) => (node.style.display = ""));
    items.forEach((item, index) => {
      const offset = geometry.offsets[index] ?? { x: 0, y: 0 };
      item.style.display = index < geometry.primary.length ? "flex" : "none";
      item.style.left = `${center - 16 + offset.x}px`;
      item.style.top = `${center - 16 + offset.y}px`;
      item.style.width = "32px";
      item.style.height = "32px";
      item.style.transform = `scale(${markerSize / 32})`;
      item.style.justifyContent = "flex-start";
      if (dotArtwork.has(item)) {
        item.replaceChildren();
        item.style.borderRadius = "50%";
        item.style.background = options.ink;
        item.style.opacity = presentation.scale === "micro" ? ".35" : ".6";
      }
      if (geometry.fullBeacon) {
        item.style.left = `${center - 29}px`;
        item.style.top = `${center - 20}px`;
        item.style.width = "58px";
        item.style.height = "56px";
        item.style.transform = "none";
      }
    });
  };
  const expand = () => {
    expanded = true;
    node.dataset.expanded = "true";
    shadow.style.display = "none";
    if (clusterBadge) {
      if (presentation.people.length) {
        const width = clusterCountWidth(presentation.people.length, 0);
        clusterBadge.style.display = "block";
        clusterBadge.style.width = `${width}px`;
        clusterBadge.style.height = "20px";
        clusterBadge.style.font = "700 10px/18px system-ui";
        clusterBadge.style.left = `${center - width / 2}px`;
        clusterBadge.style.top = `${center + 96}px`;
        clusterBadge.lastChild!.nodeValue = clusterCountLabel(
          presentation.people.length,
          0,
        );
        clusterBadge.setAttribute(
          "aria-label",
          `Explore ${presentation.people.length} nearby friends`,
        );
      } else clusterBadge.style.display = "none";
    }
    satelliteNodes.forEach((node) => (node.style.display = "none"));
    if (node.parentElement) node.parentElement.style.zIndex = "1000";
    items.forEach((item, index) => {
      item.style.display = "flex";
      if (dotArtwork.has(item)) {
        item.replaceChildren(...dotArtwork.get(item)!);
        item.style.background = "transparent";
        item.style.opacity = "1";
        item.style.borderRadius = "0";
      }
      const offset = nativePetalOffset(index, true);
      item.style.left = `${center - 32 + offset.x}px`;
      item.style.top = `${center - 26 + offset.y}px`;
      item.style.width = "64px";
      item.style.height = "52px";
      item.style.transform = "none";
      item.style.justifyContent = "center";
      if (!options.reducedMotion)
        item.style.transition = "left 160ms ease,top 160ms ease";
    });
  };
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
        event.stopPropagation();
        options.open(geometry.friendsOnly ? "Friends" : undefined);
      } else if (!expanded) {
        event.preventDefault();
        event.stopImmediatePropagation();
        expand();
      }
    },
    true,
  );
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      collapse();
    } else if (
      (event.key === "Enter" || event.key === " ") &&
      event.target === node
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (explorer) options.open(geometry.friendsOnly ? "Friends" : undefined);
      else expand();
    }
  });
  return { node, size };
}
