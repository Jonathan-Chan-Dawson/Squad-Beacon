/** Only one viewer's sheet state is retained; no account can restore another's. */
let viewer: string | null = null;
const sheetPositions = new Map<string, number>();

export function communityReturnSheetIndex(
  viewerId: string | null,
  beaconId: string,
) {
  if (viewer !== viewerId) {
    sheetPositions.clear();
    viewer = viewerId;
  }
  return viewerId ? (sheetPositions.get(beaconId) ?? 1) : 1;
}

export function rememberCommunityReturnSheet(
  viewerId: string | null,
  beaconId: string,
  index: number,
) {
  communityReturnSheetIndex(viewerId, beaconId);
  if (viewerId && Number.isInteger(index) && index >= 0 && index <= 2) {
    if (sheetPositions.size >= 50) sheetPositions.clear();
    sheetPositions.set(beaconId, index);
  }
}
