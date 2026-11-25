import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import { randomUUID } from "expo-crypto";
import { RadioTower, Store } from "lucide-react-native";
import { Platform, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { priceText } from "@/src/features/beacons/BeaconShopCatalog";
import {
  demoCoinScale,
  demoRewardActions,
} from "@/src/features/beacons/demoRewards";
import { getRewardLook } from "@/src/features/beacons/rewardLooks";
import { Dialog } from "@/src/shared/Dialogs";
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
};
type TapBatch = { request_id: string; week: string; taps: number };

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
  useEffect(() => {
    if (!notice) return;
    const hide = setTimeout(() => setNotice(""), 3600);
    return () => clearTimeout(hide);
  }, [notice]);
  const current = useRef<Wallet | undefined>(undefined);
  const queued = useRef(0);
  const pending = useRef<TapBatch | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(true);
  const flight = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = useCallback(
    async (
      action: "view" | "tap" | "upgrade",
      args: Record<string, string | number> = {},
    ) => {
      if (!userId || demo || !supabase || flight.current) return false;
      const epoch = getViewerEpoch();
      flight.current = true;
      setBusy(true);
      try {
        const { data: response, error } = await supabase.rpc("beacon_rewards", {
          p_viewer: userId,
          p_action: action,
          p_args: args,
        });
        if (error) throw error;
        if (!active.current || epoch !== getViewerEpoch()) return false;
        const next = response as Wallet;
        const previous = current.current;
        current.current = next;
        setWallet(next);
        if (action === "tap" && previous) {
          const unlocked =
            previous.clicker.stage === 0 && next.clicker.stage >= 1;
          const gained = next.balance - previous.balance;
          setNotice(
            unlocked
              ? "Shop unlocked! Use your Coins to customize your experience."
              : gained > 0
                ? `+${priceText(gained, next.coin_scale)} Coins`
                : "",
          );
        } else if (action === "upgrade") setNotice("Mini Beacon upgraded.");
        return true;
      } catch (error) {
        if (active.current && epoch === getViewerEpoch()) {
          const message =
            error && typeof error === "object" && "message" in error
              ? String(error.message)
              : "Couldn’t sync Mini Beacon. Try again.";
          if (action === "tap" && message.startsWith("Refresh Mini Beacon")) {
            pending.current = null;
            queued.current = 0;
            current.current = undefined;
            setWallet(undefined);
          }
          setNotice(message);
        }
        return false;
      } finally {
        flight.current = false;
        if (active.current && epoch === getViewerEpoch()) setBusy(false);
      }
    },
    [demo, getViewerEpoch, userId],
  );

  useFocusEffect(
    useCallback(() => {
      void send("view");
    }, [send]),
  );

  const flush = useCallback(
    async function sendBatch() {
      timer.current = undefined;
      const clicker = current.current?.clicker;
      if (!active.current || !clicker?.remaining) return;
      if (flight.current) {
        timer.current = setTimeout(() => void sendBatch(), 160);
        return;
      }
      if (pending.current?.week !== clicker.week) {
        const taps = Math.min(12, queued.current, clicker.remaining);
        if (!taps) return;
        queued.current -= taps;
        pending.current = {
          request_id: randomUUID(),
          week: clicker.week,
          taps,
        };
      }
      if (!(await send("tap", pending.current))) return;
      pending.current = null;
      if (active.current && queued.current && !timer.current)
        timer.current = setTimeout(() => void sendBatch(), 160);
    },
    [send],
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
    if (!remaining) {
      setInfo(true);
      return;
    }
    if (demo) {
      const epoch = getViewerEpoch();
      void act(demoRewardActions.tap)
        .then(() => {
          if (active.current && epoch === getViewerEpoch())
            setNotice(
              stage === 0 && demoWallet?.taps === 9
                ? "Shop unlocked!"
                : "+0.1 Coins",
            );
        })
        .catch(() => {
          if (active.current && epoch === getViewerEpoch())
            setNotice("Couldn’t tap Mini Beacon. Try again.");
        });
      return;
    }
    if (!pending.current || flight.current)
      queued.current = Math.min(12, queued.current + 1);
    if (!timer.current) timer.current = setTimeout(() => void flush(), 140);
  };
  const close = () => {
    setInfo(false);
    setConfirmUpgrade(false);
  };
  const goToShop = () => router.push("/beacon-shop" as Href);

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap Mini Beacon"
        accessibilityHint="Press and hold for Mini Beacon details."
        accessibilityState={{ busy: !demo && !wallet && !notice }}
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
        <View testID="profile-mini-beacon-face" style={circleStyle}>
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
        </View>
      </Pressable>
      {shopUnlocked && (
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
          {!clicker && !demo && (
            <Button
              compact
              title="Refresh Mini Beacon"
              disabled={busy}
              onPress={() => void send("view")}
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
                });
              }}
            />
          )}
          {!!notice && <Txt muted>{notice}</Txt>}
        </View>
      </Dialog>
    </View>
  );
}
