import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import { randomUUID } from "expo-crypto";
import { RadioTower, Store } from "lucide-react-native";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  demoCoinScale,
  demoRewardActions,
} from "@/src/features/beacons/demoRewards";
import { getRewardLook, priceText } from "@/src/features/beacons/rewardLooks";
import { Dialog } from "@/src/shared/Dialogs";
import { useReducedMotion } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import { Button, Txt, useTheme } from "@/src/shared/ui";

type Clicker = {
  week: string;
  stage: number;
  starter_taps?: number;
  remaining: number;
  taps_per_coin: number;
  next_price: number | null;
  next_rate: number | null;
};
type Wallet = {
  balance: number;
  coin_scale: number;
  purchases_enabled: boolean;
  shop_unlocked?: boolean;
  clicker: Clicker;
  tap_receipt?: { coin_units: number } | null;
};
type TapBatch = { request_id: string; week: string; taps: number };
const batchDelay = 150;
const maxBatch = 12;

export function MiniBeaconControls() {
  const { userId, viewerEpoch, demo } = useBeacon();
  return <OwnerMiniBeacon key={`${userId}:${viewerEpoch}:${demo}`} />;
}

function OwnerMiniBeacon() {
  const { userId, demo, data, act, getViewerEpoch } = useBeacon();
  const { semanticColors: colors, styles, tokens } = useTheme();
  const [wallet, setWallet] = useState<Wallet>();
  const [notice, setNotice] = useState("");
  const [info, setInfo] = useState(false);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const [pulse] = useState(() => new Animated.Value(1));
  const motion = useMemo(
    () => ({
      scale: pulse.interpolate({
        inputRange: [0, 0.22, 1],
        outputRange: [1.11, 1.04, 1],
      }),
      opacity: pulse.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [1, 1, 0],
      }),
      translateY: pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
      }),
    }),
    [pulse],
  );
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!notice) return;
    const hide = setTimeout(() => setNotice(""), 3600);
    return () => clearTimeout(hide);
  }, [notice]);
  const current = useRef<Wallet | undefined>(undefined);
  const queued = useRef(0);
  const demoTapCount = useRef(data.demo_rewards?.taps ?? 0);
  const demoStarter = useRef(data.demo_rewards?.stage === 0);
  const pending = useRef<TapBatch | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pulseFrame = useRef<number | undefined>(undefined);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const attempts = useRef(0);
  const nextBatchAt = useRef(0);
  const active = useRef(true);
  const flight = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      if (pulseFrame.current !== undefined)
        cancelAnimationFrame(pulseFrame.current);
      pulse.stopAnimation();
      activeRequest.current?.abort();
    };
  }, [pulse]);

  const send = useCallback(
    async (
      action: "view" | "tap" | "upgrade",
      args: Record<string, string | number> = {},
    ) => {
      if (!userId || demo || !supabase || flight.current) return "skipped";
      const epoch = getViewerEpoch();
      flight.current = true;
      if (action !== "tap") setBusy(true);
      const controller = new AbortController();
      activeRequest.current = controller;
      const deadline = setTimeout(() => controller.abort(), 8000);
      try {
        const {
          data: response,
          error,
          status,
        } = await supabase
          .rpc("beacon_rewards", {
            p_viewer: userId,
            p_action: action,
            p_args: { ...args, format: "mini" },
          })
          .abortSignal(controller.signal);
        if (!active.current || epoch !== getViewerEpoch()) return "skipped";
        if (error) {
          const uncertain =
            controller.signal.aborted || status === 0 || status >= 500;
          if (uncertain) {
            setNotice("Couldn’t sync Mini Beacon. Try again.");
            return "retry";
          }
          if (
            action === "tap" &&
            error.message.startsWith("Refresh Mini Beacon")
          ) {
            current.current = undefined;
            setWallet(undefined);
          }
          setNotice(error.message);
          return "rejected";
        }
        const next = response as Wallet;
        if (!next?.clicker || typeof next.balance !== "number") {
          setNotice("Mini Beacon couldn’t load. Try again.");
          return "rejected";
        }
        const previous = current.current;
        current.current = next;
        setWallet(next);
        if (action === "tap" && previous) {
          const unlocked =
            previous.clicker.stage === 0 && next.clicker.stage >= 1;
          const gained =
            next.tap_receipt?.coin_units ??
            Math.max(0, next.balance - previous.balance);
          setNotice(
            unlocked
              ? "Shop unlocked! Use your Coins to customize your experience."
              : gained > 0
                ? `+${priceText(gained, next.coin_scale)} Coins`
                : "",
          );
        } else if (action === "upgrade") setNotice("Mini Beacon upgraded.");
        return "ok";
      } catch {
        if (active.current && epoch === getViewerEpoch()) {
          setNotice("Couldn’t sync Mini Beacon. Try again.");
        }
        return "retry";
      } finally {
        clearTimeout(deadline);
        activeRequest.current = undefined;
        flight.current = false;
        if (action !== "tap" && active.current && epoch === getViewerEpoch())
          setBusy(false);
      }
    },
    [demo, getViewerEpoch, userId],
  );

  const flush = useCallback(
    async function sendBatch() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = undefined;
      if (
        !active.current ||
        flight.current ||
        (!queued.current && !pending.current)
      )
        return;
      const epoch = getViewerEpoch();
      if (demo) {
        const taps = Math.min(queued.current, 500 - demoTapCount.current);
        queued.current = 0;
        if (!taps) return;
        try {
          await act(demoRewardActions.tap, { taps });
          if (!active.current || epoch !== getViewerEpoch()) return;
          demoTapCount.current += taps;
          if (demoStarter.current && demoTapCount.current >= 10) {
            demoStarter.current = false;
            setNotice("Shop unlocked!");
          } else {
            setNotice(
              `+${priceText(taps * (demoCoinScale / 10), demoCoinScale)} Coins`,
            );
          }
        } catch {
          if (active.current && epoch === getViewerEpoch())
            setNotice("Couldn’t tap Mini Beacon. Try again.");
        }
        return;
      }
      const clicker = current.current?.clicker;
      if (!clicker) {
        setNeedsRetry(true);
        return;
      }
      if (!clicker.remaining) {
        queued.current = 0;
        pending.current = null;
        return;
      }
      if (pending.current?.week !== clicker.week) {
        pending.current = null;
        const taps = Math.min(maxBatch, queued.current, clicker.remaining);
        if (!taps) return;
        const wait = nextBatchAt.current - Date.now();
        if (wait > 0) {
          timer.current = setTimeout(() => void sendBatch(), wait);
          return;
        }
        queued.current -= taps;
        pending.current = {
          request_id: randomUUID(),
          week: clicker.week,
          taps,
        };
        // Allow the server's six-per-second tap allowance to recover between batches.
        nextBatchAt.current = Date.now() + Math.ceil((taps * 1000) / 6);
      }
      const result = await send("tap", pending.current);
      if (!active.current || epoch !== getViewerEpoch()) return;
      if (result === "retry") {
        if (attempts.current++ === 0) {
          timer.current = setTimeout(() => void sendBatch(), 700);
        } else {
          setNeedsRetry(true);
        }
        return;
      }
      if (result === "skipped") return;
      pending.current = null;
      attempts.current = 0;
      if (result !== "ok") {
        queued.current = 0;
        setNeedsRetry(true);
        return;
      }
      setNeedsRetry(false);
      if (active.current && queued.current && !timer.current)
        timer.current = setTimeout(() => void sendBatch(), batchDelay);
    },
    [act, demo, getViewerEpoch, send],
  );

  const sync = useCallback(async () => {
    const result = await send("view");
    if (!active.current || result === "skipped") return;
    setNeedsRetry(result !== "ok");
    if (result === "ok") await flush();
  }, [flush, send]);

  useFocusEffect(
    useCallback(() => {
      if (!demo && !pending.current) void sync();
    }, [demo, sync]),
  );

  const demoWallet =
    demo && data.is_demo && data.viewer_id === userId
      ? data.demo_rewards
      : undefined;
  const clicker = wallet?.clicker;
  const remaining = demo
    ? Math.max(0, 500 - (demoWallet?.taps ?? 0))
    : (clicker?.remaining ?? 0);
  const stage = demo ? (demoWallet?.stage ?? 1) : clicker?.stage;
  const shopUnlocked = demo
    ? stage !== 0
    : (wallet?.shop_unlocked ?? (stage != null && stage >= 1));
  const look = userId
    ? getRewardLook(data.equipped_looks?.[userId]?.ring)
    : undefined;
  const size = 28;
  const touchSize = Platform.OS === "android" ? 48 : 44;
  const targetStyle = {
    width: touchSize,
    height: touchSize,
    alignItems: "center",
    justifyContent: "center",
  } as const;
  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  } as const;
  const tap = () => {
    if ((demo || wallet) && !remaining) {
      setInfo(true);
      return;
    }
    if (queued.current < maxBatch) {
      queued.current += 1;
      const wasVisible = !!pulseTimer.current;
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      setPulseCount((count) => (wasVisible ? count + 1 : 1));
      if (!reducedMotion && pulseFrame.current === undefined) {
        pulseFrame.current = requestAnimationFrame(() => {
          pulseFrame.current = undefined;
          pulse.stopAnimation();
          pulse.setValue(0);
          Animated.timing(pulse, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== "web",
          }).start();
        });
      }
      pulseTimer.current = setTimeout(() => {
        pulseTimer.current = undefined;
        setPulseCount(0);
      }, 520);
    }
    if (!demo && !current.current && !flight.current) {
      void sync();
    } else if (!timer.current && !flight.current) {
      attempts.current = 0;
      timer.current = setTimeout(() => void flush(), batchDelay);
    }
  };
  const close = () => {
    setInfo(false);
    setConfirmUpgrade(false);
  };
  const goToShop = () => router.navigate("/beacon-shop" as Href);

  return (
    <View
      testID="profile-status-rewards"
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexShrink: 0,
        zIndex: 1,
      }}
    >
      {shopUnlocked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Shop"
          onPress={goToShop}
          style={({ pressed }) => [
            targetStyle,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <View
            testID="profile-shop-face"
            style={[
              circleStyle,
              { borderWidth: 1, borderColor: colors.border },
            ]}
          >
            <Store color={colors.accent} size={14} />
          </View>
        </Pressable>
      ) : (
        <View style={targetStyle} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap Mini Beacon"
        accessibilityHint="Press and hold for Mini Beacon details."
        accessibilityState={{ busy: !demo && !wallet && !needsRetry }}
        accessibilityActions={[{ name: "details", label: "About Mini Beacon" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "details") setInfo(true);
        }}
        {...(Platform.OS === "web"
          ? {
              onContextMenu: (event: { preventDefault(): void }) => {
                event.preventDefault();
                setInfo(true);
              },
            }
          : {})}
        onPress={tap}
        onLongPress={() => setInfo(true)}
        style={({ pressed }) => [
          targetStyle,
          { transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}
      >
        <Animated.View
          testID="profile-mini-beacon-face"
          style={[
            circleStyle,
            !reducedMotion && {
              transform: [{ scale: motion.scale }],
            },
          ]}
        >
          <Svg
            pointerEvents="none"
            width={size}
            height={size}
            style={{ position: "absolute" }}
          >
            <Circle
              cx={14}
              cy={14}
              r={13}
              stroke={colors.border}
              strokeWidth={1.5}
              fill="none"
            />
            {remaining > 0 && (
              <Circle
                cx={14}
                cy={14}
                r={13}
                stroke={look?.color ?? colors.accent}
                strokeWidth={1.5}
                fill="none"
                strokeDasharray={[(82 * remaining) / 500, 82]}
                transform="rotate(-90 14 14)"
              />
            )}
          </Svg>
          <RadioTower color={colors.accent} size={14} />
        </Animated.View>
      </Pressable>
      {!!pulseCount && (
        <Animated.View
          testID="mini-beacon-tap-feedback"
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 0,
            top: -9,
            backgroundColor: colors.surfaceRaised,
            borderRadius: tokens.radius.sm,
            paddingHorizontal: 5,
            opacity: reducedMotion ? 1 : motion.opacity,
            transform: [
              {
                translateY: reducedMotion ? 0 : motion.translateY,
              },
            ],
          }}
        >
          <Text style={[styles.label, { color: colors.accent }]}>
            +{pulseCount}
          </Text>
        </Animated.View>
      )}
      {!!notice && !info && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: touchSize - 2,
            right: 0,
            maxWidth: 214,
            minWidth: 94,
            borderRadius: tokens.radius.sm,
            backgroundColor: colors.surfaceRaised,
            paddingHorizontal: 8,
            paddingVertical: 5,
          }}
        >
          <Text accessibilityLiveRegion="polite" style={styles.label}>
            {notice}
          </Text>
        </View>
      )}
      <Dialog title="Mini Beacon" visible={info} onClose={close}>
        <View style={{ gap: tokens.space.sm }}>
          <Txt>Tap to earn Coins for customization.</Txt>
          {stage != null && <Txt>Stage {stage}</Txt>}
          {stage === 0 && (
            <Txt muted>
              {demo ? (demoWallet?.taps ?? 0) : (clicker?.starter_taps ?? 0)} /
              10 rewarded taps to open Shop
            </Txt>
          )}
          {(clicker || demo) && (
            <>
              <Txt muted>
                {clicker?.taps_per_coin ?? 10} taps per Coin · {remaining}{" "}
                rewarded taps left this week
              </Txt>
              <Txt muted>
                {priceText(
                  demo ? (demoWallet?.balance ?? 0) : (wallet?.balance ?? 0),
                  wallet?.coin_scale ?? demoCoinScale,
                )}{" "}
                Coins
              </Txt>
            </>
          )}
          {look && <Txt muted>Equipped ring · {look.name}</Txt>}
          {(!clicker || needsRetry) && !demo && (
            <Button
              compact
              title={needsRetry ? "Retry Mini Beacon" : "Refresh Mini Beacon"}
              disabled={busy}
              onPress={() => {
                attempts.current = 0;
                if (clicker && needsRetry && pending.current) void flush();
                else void sync();
              }}
            />
          )}
          {shopUnlocked && (
            <Button
              compact
              secondary
              title="Browse looks in Shop"
              onPress={() => {
                close();
                goToShop();
              }}
            />
          )}
          {clicker?.next_price != null && wallet?.purchases_enabled && (
            <Button
              compact
              secondary
              title={`${confirmUpgrade ? "Confirm upgrade" : "Upgrade"} · ${priceText(clicker.next_price, wallet.coin_scale)} Coins`}
              disabled={busy || wallet.balance < clicker.next_price}
              onPress={() => {
                if (!confirmUpgrade) return setConfirmUpgrade(true);
                setConfirmUpgrade(false);
                void send("upgrade", {
                  stage: clicker.stage + 1,
                  expected_price: clicker.next_price!,
                }).then(() => flush());
              }}
            />
          )}
          {!!notice && <Txt muted>{notice}</Txt>}
        </View>
      </Dialog>
    </View>
  );
}
