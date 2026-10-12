import { mapTooltip } from "./tooltipConstants";
export function mapCalloutLayout(
  anchor: { x: number; y: number } | null,
  bounds: {
    width: number;
    height: number;
    top: number;
    bottom: number;
    right?: number;
    exclusionRight?: number;
    exclusionBottom?: number;
  },
  measuredHeight: number,
  requestedHeight?: number,
  gutter = 16,
  maximumWidth = 420,
) {
  let width = Math.min(
    maximumWidth,
    Math.max(0, bounds.width - gutter * 2 - (bounds.right ?? 0)),
  );
  const availableHeight = Math.max(
    100,
    bounds.height - bounds.top - bounds.bottom,
  );
  const desiredHeight = Math.min(requestedHeight ?? 440, availableHeight);
  const point = anchor ?? {
    x: bounds.width / 2,
    y: bounds.top + availableHeight / 2,
  };
  const aboveSpace = point.y - mapTooltip.markerGap - bounds.top;
  const belowSpace =
    bounds.height - bounds.bottom - point.y - mapTooltip.markerGap;
  const naturalHeight = requestedHeight
    ? desiredHeight
    : Math.min(measuredHeight, desiredHeight);
  const above =
    aboveSpace >= naturalHeight ||
    (belowSpace < naturalHeight && aboveSpace >= belowSpace);
  const maxHeight = anchor
    ? Math.min(desiredHeight, Math.max(100, above ? aboveSpace : belowSpace))
    : desiredHeight;
  const cardHeight = requestedHeight
    ? maxHeight
    : Math.min(measuredHeight, maxHeight);
  let left = Math.max(
    gutter,
    Math.min(
      bounds.width - width - gutter - (bounds.right ?? 0),
      point.x - width / 2,
    ),
  );
  const top = anchor
    ? Math.max(
        bounds.top,
        Math.min(
          bounds.height - bounds.bottom - cardHeight,
          above
            ? point.y - cardHeight - mapTooltip.markerGap
            : point.y + mapTooltip.markerGap,
        ),
      )
    : bounds.top + Math.max(0, (availableHeight - cardHeight) / 2);
  if (
    bounds.exclusionBottom &&
    top < bounds.exclusionBottom &&
    top + cardHeight > bounds.top
  ) {
    const reserved = bounds.exclusionRight ?? 0;
    width = Math.min(width, Math.max(0, bounds.width - gutter * 2 - reserved));
    left = Math.max(
      gutter,
      Math.min(bounds.width - width - gutter - reserved, point.x - width / 2),
    );
  }
  const attached =
    !!anchor &&
    point.x >= 0 &&
    point.x <= bounds.width &&
    Math.abs(
      (above
        ? top + cardHeight + mapTooltip.markerGap
        : top - mapTooltip.markerGap) - point.y,
    ) < 3;
  return {
    width,
    maxHeight,
    left,
    top,
    above,
    attached,
    pointerLeft: Math.max(12, Math.min(width - 12, point.x - left)),
    pointerTip: point.x - left,
  };
}
