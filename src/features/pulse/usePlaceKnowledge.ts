import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import type { PulsePlace } from "./types";
import { canSharePlaceKnowledge, emptyKnowledge, parsePlaceKnowledge, type PlaceInterest, type PlaceKnowledge } from "./placeKnowledge";

type Action = "read" | "tip" | "helpful" | "accurate" | "stale" | "report" | "interest" | "withdraw";
type DemoKnowledge = PlaceKnowledge & { ownInterestUntil?: number };
const demoSessions = new Map<string, Map<string, DemoKnowledge>>();
function demoContext(scope: string, place: PulsePlace, action: Action, payload?: string) {
  if (!demoSessions.has(scope)) {
    if (demoSessions.size >= 8) demoSessions.delete(demoSessions.keys().next().value!);
    demoSessions.set(scope, new Map());
  }
  const session = demoSessions.get(scope)!;
  let value = session.get(place.placeKey);
  if (!value) {
    value = emptyKnowledge();
    const samples: Record<string, string> = {
      "demo-courts": "Pickup games usually start around 6. Courts open up after 8 PM.",
      "demo-cafe": "The tables upstairs work well for small study groups.",
      "demo-library": "The north reading room is a quiet place to study.",
    };
    if (samples[place.placeKey]) value.tips = [{ id: `tip-${place.placeKey}`, text: samples[place.placeKey], helpful: 12,
      accurateAt: Date.now() - 86400000, own: false, helped: false, accuracy: null }];
    if (place.placeKey === "demo-courts") value.interest = [{ kind: "pickup", validUntil: Date.now() + 3600000 }];
    session.set(place.placeKey, value);
  }
  value = { ...value, tips: value.tips.map((tip) => ({ ...tip })) };
  if ((value.ownInterestUntil ?? 0) <= Date.now()) value.ownInterest = null;
  if (action === "tip") value.tips = [{ id: `own-${place.placeKey}`, text: payload!, helpful: 0, accurateAt: Date.now(), own: true, helped: false, accuracy: null }, ...value.tips.filter((tip) => !tip.own)].slice(0, 4);
  if (action === "interest" || action === "withdraw") {
    for (const [key, context] of session) session.set(key, { ...context, ownInterest: null, ownInterestUntil: 0 });
    value.ownInterest = action === "interest" ? payload as PlaceInterest : null;
    value.ownInterestUntil = action === "interest" ? Date.now() + 2 * 3600000 : 0;
  }
  if (action === "report") value.tips = value.tips.filter((tip) => tip.id !== payload);
  for (const tip of value.tips) if (tip.id === payload) {
    if (action === "helpful" && !tip.helped) { tip.helpful++; tip.helped = true; }
    if (action === "accurate" || action === "stale") { tip.accuracy = action; if (action === "accurate") tip.accurateAt = Date.now(); }
  }
  session.set(place.placeKey, value);
  return value;
}

export function usePlaceKnowledge(place: PulsePlace, scope: string) {
  const { userId, demo, viewerEpoch, getViewerEpoch, getCurrentProfile } = useBeacon();
  const key = JSON.stringify([scope, userId, viewerEpoch, place]);
  const [state, setState] = useState<{ key: string; value: PlaceKnowledge; error?: string }>();
  const identity = useRef(key);
  useLayoutEffect(() => { identity.current = key; }, [key]);
  const sequence = useRef(0);
  const writing = useRef(false);
  const mounted = useRef(false);
  const allowed = canSharePlaceKnowledge(place);
  const request = useCallback(async (action: Action = "read", payload?: string) => {
    const valid = () => mounted.current && identity.current === key && getViewerEpoch() === viewerEpoch && getCurrentProfile()?.id === userId;
    if (!userId || !allowed || !valid()) throw new Error("Place information is unavailable.");
    if (action === "read" && writing.current) return;
    if (action !== "read") writing.current = true;
    const attempt = ++sequence.current;
    try {
      let value: PlaceKnowledge;
      if (demo) value = demoContext(scope, place, action, payload);
      else {
        if (!supabase) throw new Error("Place information is unavailable.");
        const { data, error } = await supabase.rpc("pulse_place_context", {
          place: { placeKey: place.placeKey, lat: place.lat, lng: place.lng, category: place.category }, action, payload: payload ?? null,
        }).retry(false);
        if (error) throw error;
        value = parsePlaceKnowledge(data);
      }
      if (valid() && sequence.current === attempt) setState({ key, value });
    } catch (failure) {
      if (valid() && sequence.current === attempt) setState((previous) => ({ key, value: previous?.key === key ? previous.value : emptyKnowledge(), error: "Place information could not update. Try again." }));
      throw failure;
    } finally {
      if (action !== "read") writing.current = false;
    }
  }, [allowed, demo, getCurrentProfile, getViewerEpoch, key, place, scope, userId, viewerEpoch]);
  useFocusEffect(useCallback(() => {
    mounted.current = true;
    if (allowed) void request().catch(() => {});
    const timer = setInterval(() => { if (allowed) void request().catch(() => {}); }, 30000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [allowed, request]));
  return { value: state?.key === key ? state.value : emptyKnowledge(), error: state?.key === key ? state.error : undefined, request, allowed };
}
