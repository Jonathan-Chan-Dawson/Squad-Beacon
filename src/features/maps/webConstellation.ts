import {
  clusterCountParts,
  clusterCountAccessibilityLabel,
  CLUSTER_COUNT_PATHS,
  clusterCountWidth,
  CLUSTER_FRIEND_SHADOW_OPACITY,
  CLUSTER_MICRO_SHADOW_OPACITY,
  CLUSTER_FAR_SHADOW_OPACITY,
  friendGroupUsesCount,
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
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" style="display:block;flex:none"><circle cx="12" cy="7" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3Z"/></svg>';
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
      : presentation.scale === "far"
        ? CLUSTER_FAR_SHADOW_OPACITY
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
    dot.style.cssText = `position:absolute;left:${center + offset.x - s / 2}px;top:${center + offset.y - s / 2}px;width:${s}px;height:${s}px;box-sizing:border-box;border-radius:50%;background:${options.surface};color:${options.ink};border:1px solid ${options.line};padding:1px;display:flex;align-items:center;justify-content:center;line-height:0;z-index:30;pointer-events:none;opacity:${presentation.friendsProminent ? 0.8 : 0.62};`;
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
  if (
    geometry.countBadge ||
    (!explorer && presentation.people.length && presentation.beacons.length)
  ) {
    clusterBadge = badge(
      geometry.countBadge?.text ?? "",
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
      if (expanded || geometry.countBadge?.activation === "friends")
        options.open("Friends");
      else if (geometry.countBadge?.activation === "cluster") options.open();
      else expand();
    };
    node.append(clusterBadge);
    restoreCount();
  }
  if (
    geometry.friendsOnly &&
    friendGroupUsesCount(presentation.people.length, presentation.scale)
  ) {
    const count = badge(
      "",
      "right",
      `${presentation.people.length} nearby friends; open cluster explorer`,
    );
    const fontSize =
      presentation.scale === "micro"
        ? 8
        : presentation.scale === "far"
          ? 9
          : 10;
    count.style.minWidth = `${clusterCountWidth(presentation.people.length, 0, fontSize)}px`;
    count.style.padding = "0";
    renderCount(
      count,
      clusterCountParts(presentation.people.length, 0),
      fontSize,
    );
    count.style.boxSizing = "border-box";
    count.style.left = "50%";
    count.style.right = "auto";
    count.style.bottom = "auto";
    count.style.top = "50%";
    count.style.transform = "translate(-50%,-50%)";
    if (presentation.scale === "micro") {
      count.style.height = "14px";
      count.style.font = "700 8px/12px system-ui";
      count.style.opacity = ".5";
    }
    count.dataset.testid = "cluster-friend-count";
    count.dataset.friends = "true";
    count.onclick = (event) => {
      event.stopPropagation();
      options.open("Friends");
    };
    if (presentation.scale === "far") {
      count.style.height = "18px";
      count.style.font = "700 9px/16px system-ui";
      count.style.opacity = ".65";
    }
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
        renderCount(
          clusterBadge,
          clusterCountParts(presentation.people.length, 0),
          10,
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
