import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { accountReadiness } from "@/src/shared/accountReadiness";
import { supabase } from "@/src/shared/supabase";
import {
  listenOnboardingSuccess,
  parseProgress,
  type OnboardingKey,
  type ProgressStatus,
  type SuccessKey,
} from "./progress";
import type { CopyTone } from "./copy";

type ProgressValue = {
  keys: ReadonlySet<OnboardingKey>;
  status: ProgressStatus;
  firstEntrySession: boolean;
  consumeWelcome: () => void;
  tone: CopyTone;
  quips: boolean;
  mark: (key: OnboardingKey) => Promise<boolean>;
  retry: () => void;
  setTone: (tone: CopyTone) => void;
  setQuips: (value: boolean) => void;
  resetTips: () => void;
  success: SuccessKey | null;
  dismissSuccess: () => void;
};
const Context = createContext<ProgressValue | null>(null);
export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = useBeacon();
  const { userId, demo, viewerEpoch, getViewerEpoch, demoScenario } = account;
  const ready = accountReadiness(account).state === "ready";
  return (
    <AccountProgress
      key={`${userId}:${demo}:${viewerEpoch}:${demo ? demoScenario : "live"}`}
      viewer={userId}
      demo={demo}
      epoch={viewerEpoch}
      getEpoch={getViewerEpoch}
      canEnter={ready}
      initial={
        demoScenario === "fresh" ? ["entry.eligible.v1"] : ["welcome.seen.v1"]
      }
    >
      {children}
    </AccountProgress>
  );
}
function AccountProgress({
  viewer,
  demo,
  epoch,
  getEpoch,
  initial,
  canEnter,
  children,
}: {
  viewer: string | null;
  demo: boolean;
  epoch: number;
  getEpoch: () => number;
  initial: OnboardingKey[];
  canEnter: boolean;
  children: React.ReactNode;
}) {
  const [keys, setKeys] = useState<Set<OnboardingKey>>(
    () => new Set(demo ? initial : []),
  );
  const keysRef = useRef(keys);
  const [firstEntrySession, setFirstEntrySession] = useState(
    demo && initial.includes("entry.eligible.v1"),
  );
  const [status, setStatus] = useState<ProgressStatus>(
    demo ? "ready" : "loading",
  );
  const [tone, setTone] = useState<CopyTone>("playful");
  const [quips, setQuips] = useState(true);
  const [success, setSuccess] = useState<SuccessKey | null>(null);
  const active = useRef(true);
  const sequence = useRef(0);
  const readiness = useRef(canEnter);
  const readinessGeneration = useRef(0);
  // Commit readiness before async results or passive subscriptions can run.
  useLayoutEffect(() => {
    readiness.current = canEnter;
    sequence.current++;
    readinessGeneration.current++;
    return () => {
      readiness.current = false;
    };
  }, [canEnter]);
  const pending = useRef(new Set<OnboardingKey>());
  const inFlight = useRef(new Set<OnboardingKey>());
  const alive = useCallback(
    () => active.current && readiness.current && epoch === getEpoch(),
    [epoch, getEpoch],
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    if (demo || !viewer || !supabase || !canEnter) return;
    const request = ++sequence.current;
    try {
      const { data, error } = await supabase
        .from("onboarding_progress")
        .select("key")
        .eq("user_id", viewer);
      if (!alive() || request !== sequence.current) return;
      if (error) {
        setStatus("error");
        return;
      }
      try {
        const next = new Set([...parseProgress(data), ...keysRef.current]);
        // Reserve the first normal app session, not merely a new profile.
        if (
          next.has("entry.eligible.v1") &&
          !next.has("welcome.seen.v1") &&
          !next.has("welcome.dismissed.v1")
        ) {
          const claim = await supabase.rpc("claim_onboarding_progress", {
            progress_key: "welcome.seen.v1",
            expected_viewer: viewer,
          });
          if (!alive() || request !== sequence.current) return;
          if (claim.error) {
            setStatus("error");
            return;
          }
          next.add("welcome.seen.v1");
          if (claim.data === true) setFirstEntrySession(true);
        }
        keysRef.current = next;
        setKeys(next);
        setStatus("ready");
      } catch {
        if (alive() && request === sequence.current) setStatus("error");
      }
      for (const key of pending.current) {
        const result = await supabase.rpc("claim_onboarding_progress", {
          progress_key: key,
          expected_viewer: viewer,
        });
        if (!alive() || request !== sequence.current) return;
        if (result.error) {
          setStatus("error");
          return;
        }
        pending.current.delete(key);
      }
    } catch {
      if (alive() && request === sequence.current) setStatus("error");
    }
  }, [alive, demo, viewer, canEnter]);
  useEffect(() => {
    void Promise.resolve().then(load);
    if (demo) return;
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active") void load();
    });
    return () => subscription.remove();
  }, [demo, load]);
  const mark = useCallback(
    async (key: OnboardingKey) => {
      if (
        !viewer ||
        !alive() ||
        keysRef.current.has(key) ||
        inFlight.current.has(key)
      )
        return false;
      const celebration = key.startsWith("success.");
      if (
        celebration &&
        (status !== "ready" || !keysRef.current.has("entry.eligible.v1"))
      )
        return false;
      // Dismissals remain effective in this session even when saving fails.
      if (!celebration) {
        pending.current.add(key);
        keysRef.current = new Set([...keysRef.current, key]);
        setKeys(keysRef.current);
      }
      inFlight.current.add(key);
      const generation = readinessGeneration.current;
      const stillCurrent = () =>
        alive() && generation === readinessGeneration.current;
      try {
        let inserted = demo;
        if (!demo) {
          if (!supabase) return false;
          const result = await supabase.rpc("claim_onboarding_progress", {
            progress_key: key,
            expected_viewer: viewer,
          });
          if (!stillCurrent()) return false;
          if (result.error) {
            setStatus("error");
            return false;
          }
          inserted = result.data === true;
        }
        if (!stillCurrent()) return false;
        keysRef.current = new Set([...keysRef.current, key]);
        setKeys(keysRef.current);
        pending.current.delete(key);
        return inserted;
      } catch {
        if (stillCurrent()) setStatus("error");
        return false;
      } finally {
        inFlight.current.delete(key);
      }
    },
    [alive, demo, status, viewer],
  );
  useEffect(
    () =>
      listenOnboardingSuccess((event) => {
        if (event.viewer !== viewer || event.epoch !== epoch || !alive())
          return;
        void mark(event.key).then((inserted) => {
          if (inserted && alive()) setSuccess(event.key);
        });
      }),
    [alive, epoch, mark, viewer],
  );
  const dismissSuccess = useCallback(() => setSuccess(null), []);
  const consumeWelcome = useCallback(() => setFirstEntrySession(false), []);
  return (
    <Context.Provider
      value={{
        keys,
        status: canEnter ? status : "loading",
        firstEntrySession: canEnter && firstEntrySession,
        consumeWelcome,
        tone,
        quips,
        mark,
        retry: () => {
          void load();
        },
        setTone,
        setQuips,
        resetTips: () => {
          if (!demo) return;
          keysRef.current = new Set(
            [...keysRef.current].filter((key) => !key.startsWith("tip.")),
          );
          setKeys(keysRef.current);
        },
        success: canEnter ? success : null,
        dismissSuccess,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error("OnboardingProvider required");
  return value;
}
