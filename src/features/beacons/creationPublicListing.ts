import type { PublicDiscoveryOptIn } from "@/src/features/discovery/types";
import { validatePublicDiscoveryOptIn } from "@/src/features/discovery/domain";

export type CreationPublicListing = {
  enabled: boolean;
  area: string;
  viewer?: string;
  createdId?: string;
  requestId?: string;
  payload?: PublicDiscoveryOptIn;
  completed?: boolean;
};

/** This continuation can publish only an already-confirmed Beacon; it cannot create one. */
export async function finishCreationPublicListing(
  state: CreationPublicListing,
  viewer: string,
  createdId: string,
  coordinates: { latitude: number; longitude: number } | null,
  current: () => boolean,
  persist: () => Promise<unknown>,
  publish: (
    payload: PublicDiscoveryOptIn,
    requestId: string,
  ) => Promise<unknown>,
  requestId: () => string,
) {
  if (!state.enabled) return;
  if (
    !current() ||
    (state.viewer && state.viewer !== viewer) ||
    (state.createdId && state.createdId !== createdId)
  )
    throw new Error(
      "Your account or Beacon changed. Return to the original draft.",
    );
  state.viewer = viewer;
  state.createdId = createdId;
  if (!state.payload) {
    state.payload = {
      activity_id: createdId,
      area_label: state.area.trim(),
      ...(coordinates
        ? {
            coarse_lat: Math.round(coordinates.latitude * 100) / 100,
            coarse_lng: Math.round(coordinates.longitude * 100) / 100,
          }
        : {}),
    };
  }
  validatePublicDiscoveryOptIn(state.payload);
  state.requestId ??= requestId();
  await persist();
  if (!current())
    throw new Error("Your account changed before public listing.");
  if (!state.completed) {
    await publish(state.payload, state.requestId);
    if (!current())
      throw new Error("Your account changed while confirming public listing.");
    state.completed = true;
  }
  await persist();
}
