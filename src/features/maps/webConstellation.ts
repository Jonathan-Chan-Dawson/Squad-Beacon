import { CLUSTER_SHADOW_OPACITY } from "./clusterLayout";
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
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="7" r="4"/><path d="M5 22v-4a7 7 0 0 1 14 0v4"/></svg>';
const peopleSvg =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M2 22v-4a7 7 0 0 1 14 0v4M17 3a4 4 0 0 1 0 8M22 22v-4a7 7 0 0 0-4-6"/></svg>';
/** Same bloom metrics, preview limits and satellites as native; no density disks or avatar piles. */
export function webConstellation(
  presentation: NativeMapPresentation,
  options: Options,
) {
  const { group, mode, overflow } = presentation;
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
  shadow.style.cssText = `position:absolute;left:${geometry.shadowLeft}px;top:${geometry.shadowTop}px;width:${geometry.shadowSize}px;height:${geometry.shadowSize}px;border-radius:50%;background:black;opacity:${geometry.friendsOnly ? 0.1 : presentation.scale === "micro" ? 0.14 : CLUSTER_SHADOW_OPACITY};pointer-events:none;`;
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
    dot.style.cssText = `position:absolute;left:${center + offset.x - s / 2}px;top:${center + offset.y - s / 2}px;width:${s}px;height:${s}px;box-sizing:border-box;border-radius:50%;background:${options.surface};color:${options.ink};border:1px solid ${options.line};padding:1px;z-index:30;pointer-events:none;opacity:${presentation.scale === "micro" ? 0.4 : 0.85};`;
    if (s >= 10) dot.innerHTML = personSvg;
    else dot.style.background = options.ink;
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
  let overflowBadge: HTMLButtonElement | undefined;
  let friendBadge: HTMLButtonElement | undefined;
  if (presentation.beacons.length && overflow) {
    const count = badge(
      `+${overflow}`,
      "right",
      `${overflow} more Beacons; ${explorer ? "open cluster explorer" : "expand to select every Beacon"}`,
    );
    if (presentation.scale === "micro") {
      count.style.minWidth = "16px";
      count.style.height = "14px";
      count.style.font = "700 8px/12px system-ui";
    }
    count.dataset.testid = "map-constellation-overflow";
    count.style.right = `${geometry.overflowInset}px`;
    count.style.bottom = `${geometry.overflowInset}px`;
    overflowBadge = count;
    node.append(count);
  }
  if (presentation.people.length && presentation.beacons.length) {
    const friends = badge(
      `${presentation.people.length}`,
      "left",
      `${presentation.people.length} nearby friends; shared locations, not Beacon attendance`,
    );
    const glyph = document.createElement("span");
    glyph.innerHTML = peopleSvg;
    glyph.style.cssText =
      "display:inline-block;width:9px;height:9px;margin-right:2px;";
    friends.insertBefore(glyph, friends.firstChild);
    friends.dataset.friends = "true";
    friends.dataset.testid = "cluster-friend-count";
    friendBadge = friends;
    if (geometry.friendBadge) {
      const anchor = geometry.friendBadge;
      friends.style.left = `${center + anchor.offset.x - anchor.width / 2}px`;
      friends.style.top = `${center + anchor.offset.y - anchor.height / 2}px`;
      friends.style.bottom = "auto";
      friends.style.width = `${anchor.width}px`;
      friends.style.height = `${anchor.height}px`;
      friends.style.minWidth = "0";
      friends.style.padding = "0";
      friends.style.boxSizing = "border-box";
      friends.style.lineHeight = `${anchor.height - 2}px`;
    }
    if (!geometry.friendBadge) friends.style.display = "none";
    friends.onclick = (e) => {
      e.stopPropagation();
      options.open("Friends");
    };
    node.append(friends);
  }
  if (geometry.friendsOnly && presentation.people.length >= 5) {
    const count = badge(
      String(presentation.people.length),
      "right",
      `${presentation.people.length} nearby friends; open cluster explorer`,
    );
    count.style.left = "50%";
    count.style.right = "auto";
    count.style.bottom = "auto";
    count.style.top = "50%";
    count.style.transform = "translate(-50%,-50%)";
    if (presentation.scale === "micro") {
      count.style.minWidth = "16px";
      count.style.height = "14px";
      count.style.font = "700 8px/12px system-ui";
      count.style.opacity = ".45";
    }
    count.dataset.testid = "cluster-friend-count";
    node.append(count);
  }
  let expanded = false;
  const collapse = () => {
    expanded = false;
    delete node.dataset.expanded;
    shadow.style.display = "";
    if (overflowBadge) overflowBadge.style.display = "";
    if (friendBadge && !geometry.friendBadge)
      friendBadge.style.display = "none";
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
    if (overflowBadge) overflowBadge.style.display = "none";
    if (friendBadge) friendBadge.style.display = "inline-block";
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
      if ((event.target as HTMLElement).closest('[data-friends="true"]'))
        return;
      if (explorer) {
        event.stopPropagation();
        options.open();
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
      if (explorer) options.open();
      else expand();
    }
  });
  return { node, size };
}
