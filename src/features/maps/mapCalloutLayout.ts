export function mapCalloutLayout(
  anchor: { x: number; y: number } | null,
  bounds: { width: number; height: number; top: number; bottom: number },
  measuredHeight: number,
  requestedHeight?: number,
  gutter = 16,
) {
  const width = Math.min(420, Math.max(0, bounds.width - gutter * 2));
  const availableHeight = Math.max(
    100,
    bounds.height - bounds.top - bounds.bottom,
  );
  const desiredHeight = Math.min(requestedHeight ?? 440, availableHeight);
  const point = anchor ?? {
    x: bounds.width / 2,
    y: bounds.top + availableHeight / 2,
  };
  const aboveSpace = point.y - 16 - bounds.top;
  const belowSpace = bounds.height - bounds.bottom - point.y - 16;
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
  const left = Math.max(
    gutter,
    Math.min(bounds.width - width - gutter, point.x - width / 2),
  );
  const top = anchor
    ? Math.max(
        bounds.top,
        Math.min(
          bounds.height - bounds.bottom - cardHeight,
          above ? point.y - cardHeight - 16 : point.y + 16,
        ),
      )
    : bounds.top + Math.max(0, (availableHeight - cardHeight) / 2);
  const attached =
    !!anchor &&
    point.x >= left + 12 &&
    point.x <= left + width - 12 &&
    Math.abs((above ? top + cardHeight + 16 : top - 16) - point.y) < 3;
  return {
    width,
    maxHeight,
    left,
    top,
    above,
    attached,
    pointerLeft: point.x - left - 8,
  };
}
