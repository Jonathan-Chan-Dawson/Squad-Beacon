import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MapBounds } from "@/src/shared/exploration";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import type { Profile } from "@/src/shared/types";
import type { PulseAnswers, PulseDraft, PulsePlace } from "./types";
import { aggregatePulse } from "./aggregatePulse";
import { pulseTTL } from "./expiry";
import { DEMO_PULSE_PLACES } from "./demoStore";
import {
  PulseClientSession,
  findPulseClientSession,
  retainPulseClientSession,
} from "./clientSession";
import { agePulseSummary } from "./aging";
import { PulseQueryController } from "./queryController";
import {
  parsePulseSummaries,
  requirePulseReceipt,
  validatePulseDraft,
} from "./validation";
import { pulseCopy } from "./copy/pulse";

function createPulseFetcher(
  storage: PulseClientSession,
  userId: string | null,
  getCurrentProfile: () => Profile | null,
  getViewerEpoch: () => number,
  expectedEpoch: number,
) {
  return async (
    queryBounds: MapBounds,
    queryZoom: number,
    signal: AbortSignal,
  ) => {
    if (
      !userId ||
      getCurrentProfile()?.id !== userId ||
      getViewerEpoch() !== expectedEpoch
    )
      throw new Error(pulseCopy.unavailable);
    if (storage.demo) return storage.demo.summaries(queryBounds, Date.now());
    if (!supabase) throw new Error(pulseCopy.unavailable);
    const { data, error } = await supabase
      .rpc("get_pulse_summaries", { bounds: queryBounds, zoom: queryZoom })
      .abortSignal(signal)
      .retry(false);
    if (error) throw new Error(error.message);
    if (
      getCurrentProfile()?.id !== userId ||
      getViewerEpoch() !== expectedEpoch
    )
      throw new Error(pulseCopy.unavailable);
    return parsePulseSummaries(data).map((summary) =>
      storage.hidden.get(summary.placeKey) === summary.noteSample
        ? { ...summary, noteSample: undefined }
        : summary,
    );
  };
}

export function usePulse({
  enabled,
  bounds,
  zoom,
}: {
  enabled: boolean;
  bounds: MapBounds | null;
  zoom: number;
}) {
  const { userId, demo, viewerEpoch, getCurrentProfile, getViewerEpoch } =
    useBeacon();
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const scope = `${demo ? "demo" : "live"}:${userId ?? "none"}:${viewerEpoch}`;
  const storage = useMemo(
    () => findPulseClientSession(scope) ?? new PulseClientSession(scope, demo),
    [scope, demo],
  );
  useLayoutEffect(() => {
    retainPulseClientSession(storage);
  }, [storage]);
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const current = useRef({ scope, enabled, userId });
  useLayoutEffect(() => {
    current.current = { scope, enabled, userId };
  }, [scope, enabled, userId]);
  const controller = useMemo(
    () =>
      new PulseQueryController(
        createPulseFetcher(
          storage,
          userId,
          getCurrentProfile,
          getViewerEpoch,
          viewerEpoch,
        ),
      ),
    [storage, userId, getCurrentProfile, getViewerEpoch, viewerEpoch],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const north = bounds?.north,
    south = bounds?.south,
    east = bounds?.east,
    west = bounds?.west;
  useLayoutEffect(() => {
    controller.setView(
      enabled && !!userId,
      north === undefined ||
        south === undefined ||
        east === undefined ||
        west === undefined
        ? null
        : { north, south, east, west },
      zoom,
    );
    return () => controller.cancel();
  }, [controller, enabled, userId, north, south, east, west, zoom]);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [enabled]);
  const canCommit = () =>
    current.current.enabled &&
    active.current &&
    getViewerEpoch() === viewerEpoch &&
    current.current.scope === storage.scope &&
    !!userId &&
    getCurrentProfile()?.id === userId;
  const guard = () => {
    if (!canCommit()) throw new Error(pulseCopy.unavailable);
    if (storage.isLocked()) throw new Error(pulseCopy.unavailable);
  };
  const canonical = (
    value: unknown,
    expected: Pick<PulsePlace, "placeKey" | "lat" | "lng" | "category">,
  ) => {
    if (!canCommit()) throw new Error(pulseCopy.unavailable);
    const parsed = requirePulseReceipt(value, expected);
    controller.replace([
      ...controller
        .getSnapshot()
        .summaries.filter((item) => item.placeKey !== expected.placeKey),
      parsed,
    ]);
    controller.clearCache();
  };
  async function post(input: PulseDraft): Promise<void> {
    guard();
    const draft = validatePulseDraft(input);
    storage.setLocked(true);
    controller.cancel();
    const previous = controller.getSnapshot().summaries,
      now = Date.now();
    const optimistic = aggregatePulse(
      Object.entries(draft.answers).map(([kind, value], index) => ({
        id: `pending-${index}`,
        placeKey: draft.place.placeKey,
        lat: draft.place.lat,
        lng: draft.place.lng,
        category: draft.place.category,
        kind: kind as keyof PulseAnswers,
        value: value!,
        note: index === 0 ? draft.note : undefined,
        createdAt: now,
        expiresAt: now + pulseTTL(kind as keyof PulseAnswers, value!),
        confirmCount: 0,
      })),
      now,
    );
    const old = previous.find((item) => item.placeKey === draft.place.placeKey);
    controller.replace([
      ...previous.filter((item) => item.placeKey !== draft.place.placeKey),
      {
        ...old,
        ...optimistic,
        recentCount: old?.recentCount ?? optimistic.recentCount,
      },
    ]);
    try {
      // TODO(product): proximity verification
      if (storage.demo) {
        storage.demo.post(draft, now);
        if (bounds) controller.replace(storage.demo.summaries(bounds, now));
      } else {
        if (!supabase) throw new Error(pulseCopy.unavailable);
        const { data, error } = await supabase
          .rpc("post_pulse", {
            draft: { ...draft.place, answers: draft.answers, note: draft.note },
          })
          .retry(false);
        if (error) throw new Error(error.message);
        canonical(data, draft.place);
      }
      if (!canCommit()) throw new Error(pulseCopy.unavailable);
      storage.answers.set(draft.place.placeKey, { ...draft.answers });
      setNow(Date.now());
      setRevision((value) => value + 1);
      controller.clearCache();
    } catch (error) {
      if (canCommit()) controller.replace(previous);
      throw error;
    } finally {
      storage.setLocked(false);
    }
  }
  async function confirm(placeKey: string): Promise<void> {
    guard();
    const now = Date.now();
    if ((storage.confirmations.get(placeKey) ?? 0) > now)
      throw new Error(pulseCopy.confirmed);
    const previous = controller.getSnapshot().summaries;
    const expected = previous.find((item) => item.placeKey === placeKey);
    if (!expected) throw new Error(pulseCopy.noData);
    storage.setLocked(true);
    controller.cancel();
    try {
      if (storage.demo) {
        storage.demo.confirm(placeKey, now);
        if (bounds) controller.replace(storage.demo.summaries(bounds, now));
      } else {
        if (!supabase) throw new Error(pulseCopy.unavailable);
        const { data, error } = await supabase
          .rpc("confirm_pulse", { place_key: placeKey })
          .retry(false);
        if (error) throw new Error(error.message);
        canonical(data, expected);
      }
      if (!canCommit()) throw new Error(pulseCopy.unavailable);
      storage.confirmations.set(placeKey, now + 600000);
      setNow(Date.now());
      setRevision((value) => value + 1);
      controller.clearCache();
    } catch (error) {
      if (canCommit()) controller.replace(previous);
      throw error;
    } finally {
      storage.setLocked(false);
    }
  }
  async function reportNote(placeKey: string): Promise<void> {
    guard();
    const before = controller.getSnapshot().summaries;
    const note = before.find((item) => item.placeKey === placeKey)?.noteSample;
    if (!note) return;
    storage.setLocked(true);
    controller.cancel();
    storage.hidden.set(placeKey, note);
    controller.replace(
      before.map((item) =>
        item.placeKey === placeKey ? { ...item, noteSample: undefined } : item,
      ),
    );
    try {
      if (storage.demo) storage.demo.reportNote(placeKey, note);
      else {
        if (!supabase) throw new Error(pulseCopy.unavailable);
        const { error } = await supabase
          .rpc("report_pulse_note", { place_key: placeKey, note_sample: note })
          .retry(false);
        if (error) throw new Error(error.message);
      }
      controller.clearCache();
      if (!canCommit()) throw new Error(pulseCopy.unavailable);
    } catch (error) {
      throw error;
    } finally {
      storage.setLocked(false);
    }
  }
  const refresh = useCallback(() => controller.refresh(), [controller]);
  return {
    ...state,
    summaries:
      enabled && userId
        ? state.summaries.map((summary) => agePulseSummary(summary, now))
        : [],
    post,
    confirm,
    reportNote,
    refresh,
    demoPlaces: demo ? DEMO_PULSE_PLACES : [],
    lastAnswers: (placeKey: string) => ({ ...storage.answers.get(placeKey) }),
    confirmedUntil: (placeKey: string) =>
      storage.confirmations.get(placeKey) ?? 0,
    revision,
    scopeKey: scope,
  };
}
