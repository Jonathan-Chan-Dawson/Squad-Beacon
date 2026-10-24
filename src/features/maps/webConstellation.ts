import {
  clusterLayout,
  CLUSTER_COUNT_ANCHOR,
  CLUSTER_OWNERSHIP_ANCHOR,
  CLUSTER_SHADOW_OPACITY,
} from "./clusterLayout";
import type { ClusterPoint } from "./cluster";
import {
  nativePetalOffset,
  nativePointOffset,
  nativeStackOpensExplorer,
  type NativeMapPresentation,
} from "./nativeMapPresentation";

type Options = {
  member: (point: ClusterPoint) => HTMLButtonElement;
  open: () => void;
  ink: string;
  surface: string;
  line: string;
  ownership: string;
  categoryColor: (point: ClusterPoint) => string;
  reducedMotion: boolean;
};

/** DOM counterpart of the native presentation, using the same geographic policy. */
export function webConstellation(
  presentation: NativeMapPresentation,
  options: Options,
) {
  const { group, visible, mode, owned, overflow } = presentation;
  const node = document.createElement("div");
  const compact = mode === "atmosphere";
  const layout = clusterLayout(group.members.length);
  const size = mode === "stack" ? layout.size : compact ? 44 : 180;
  node.dataset.testid = "map-constellation";
  node.dataset.mode = mode;
  node.dataset.memberCount = String(group.members.length);
  node.style.cssText = `position:relative;width:${size}px;height:${size}px;pointer-events:none;`;
  const explorer =
    mode !== "stack" || nativeStackOpensExplorer(group.members.length);
  const names: string[] = [];
  const items: HTMLElement[] = [];
  const activate = () => options.open();
  if (explorer) {
    node.setAttribute("role", "button");
    node.tabIndex = 0;
    node.style.cursor = "pointer";
    const hitArea = document.createElement("span");
    hitArea.setAttribute("aria-hidden", "true");
    hitArea.style.cssText =
      mode === "stack" || compact
        ? "position:absolute;inset:0;border-radius:50%;pointer-events:auto;"
        : "position:absolute;left:36px;top:36px;width:108px;height:108px;pointer-events:auto;";
    node.append(hitArea);
    node.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        activate();
      }
    };
    node.onclick = (event) => {
      event.stopPropagation();
      activate();
    };
  } else node.setAttribute("role", "group");

  if (mode === "stack") {
    const shadow = document.createElement("span");
    shadow.dataset.testid = "cluster-circle-shadow";
    shadow.setAttribute("aria-hidden", "true");
    shadow.style.cssText = `position:absolute;left:${layout.shadowLeft}px;top:${layout.shadowTop}px;width:${layout.shadowSize}px;height:${layout.shadowSize}px;border-radius:50%;background:black;opacity:${CLUSTER_SHADOW_OPACITY};pointer-events:none;`;
    node.append(shadow);
    visible.forEach((point, index) => {
      const artwork = options.member(point);
      names.push(artwork.getAttribute("aria-label") ?? point.id);
      let item: HTMLElement = artwork;
      if (explorer) {
        item = document.createElement("span");
        item.style.cssText = artwork.style.cssText;
        item.append(...Array.from(artwork.childNodes));
        item.setAttribute("aria-hidden", "true");
      }
      const offset = nativePetalOffset(index, false, visible.length);
      item.dataset.memberId = point.id;
      item.classList.add("map-petal-item");
      Object.assign(item.style, {
        boxSizing: "border-box",
        position: "absolute",
        left: `${layout.center - 16 + offset.x}px`,
        top: `${layout.center - 16 + offset.y}px`,
        width: "32px",
        height: "32px",
        zIndex: String(visible.length - index),
        pointerEvents: "auto",
      });
      if (!options.reducedMotion)
        item.style.transition = "left 160ms ease, top 160ms ease";
      items.push(item);
      node.append(item);
    });
    if (!explorer) {
      let expanded = false;
      const expand = () => {
        expanded = true;
        node.dataset.expanded = "true";
        shadow.style.display = "none";
        if (node.parentElement) node.parentElement.style.zIndex = "1000";
        items.forEach((item, index) => {
          const offset = nativePetalOffset(index, true);
          item.style.left = `${layout.center - 32 + offset.x}px`;
          item.style.top = `${layout.center - 26 + offset.y}px`;
          item.style.width = "64px";
          item.style.height = "52px";
          item.style.justifyContent = "center";
          const face = item.querySelector<HTMLElement>("[data-cluster-face]");
          if (face) face.style.transform = "scale(1.25)";
        });
      };
      node.addEventListener(
        "click",
        (event) => {
          if (!expanded) {
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
          expanded = false;
          delete node.dataset.expanded;
          shadow.style.display = "";
          items.forEach((item, index) => {
            const offset = nativePetalOffset(index, false, visible.length);
            item.style.left = `${layout.center - 16 + offset.x}px`;
            item.style.top = `${layout.center - 16 + offset.y}px`;
            item.style.width = "32px";
            item.style.height = "32px";
            item.style.justifyContent = "flex-start";
            const face = item.querySelector<HTMLElement>("[data-cluster-face]");
            if (face) face.style.transform = "";
          });
        }
      });
    }
    if (overflow) {
      const badge = document.createElement("span");
      badge.dataset.testid = "map-constellation-overflow";
      badge.textContent = `+${overflow}`;
      badge.style.cssText = `position:absolute;right:${CLUSTER_COUNT_ANCHOR.right}px;bottom:${CLUSTER_COUNT_ANCHOR.bottom}px;z-index:20;min-width:24px;height:20px;line-height:18px;padding:0 4px;box-sizing:border-box;border:1px solid ${options.line};border-radius:12px;background:${options.surface};color:${options.ink};font:700 10px/18px system-ui;text-align:center;pointer-events:auto;`;
      node.append(badge);
    }
  } else if (mode === "swarm") {
    const samples = [...group.members]
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 24);
    const offsets = samples.map((point) => nativePointOffset(point, group, 14));
    const extent = Math.max(
      1,
      ...offsets.map((point) => Math.max(Math.abs(point.x), Math.abs(point.y))),
    );
    samples.forEach((point, index) => {
      const spark = document.createElement("span");
      spark.setAttribute("aria-hidden", "true");
      spark.dataset.testid = "map-constellation-spark";
      spark.style.cssText = `position:absolute;left:${87 + (offsets[index].x / extent) * 49}px;top:${87 + (offsets[index].y / extent) * 49}px;width:5px;height:5px;border-radius:50%;background:${options.categoryColor(point)};opacity:.75;`;
      node.append(spark);
    });
  }
  if (owned.length && (mode !== "stack" || owned.length > 1)) {
    const star = document.createElement("span");
    star.textContent = `★${owned.length > 1 ? owned.length : ""}`;
    star.dataset.testid = "cluster-ownership-star";
    star.setAttribute("aria-label", `${owned.length} of your Beacons`);
    star.style.cssText = `position:absolute;${mode === "stack" ? `right:${CLUSTER_OWNERSHIP_ANCHOR.right}px;top:${CLUSTER_OWNERSHIP_ANCHOR.top}px;` : `right:${compact ? 10 : 24}px;bottom:${compact ? 10 : 36}px;`}z-index:21;min-width:22px;height:22px;box-sizing:border-box;border:2px solid ${options.surface};border-radius:12px;padding:0 4px;background:${options.ownership};color:white;font:700 12px/18px system-ui;text-align:center;pointer-events:auto;`;
    node.append(star);
  }
  const beaconCount = group.members.filter(
    (point) => point.kind === "beacon",
  ).length;
  node.setAttribute(
    "aria-label",
    mode === "stack"
      ? `Map cluster: ${beaconCount} beacons, ${group.members.length - beaconCount} people. Preview: ${names.join(", ")}${overflow ? `, plus ${overflow} more` : ""}. ${explorer ? "Open searchable cluster explorer" : "Expand to select an item"}`
      : `${mode === "swarm" ? "Spark Swarm" : "Activity area"}: ${beaconCount} Beacons${owned.length ? `, ${owned.length} yours` : ""}. ${mode === "swarm" ? "Open searchable cluster explorer" : "Zoom to explore"}`,
  );
  return { node, size };
}
