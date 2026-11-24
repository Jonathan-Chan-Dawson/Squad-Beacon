import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { randomUUID } from "expo-crypto";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Coins, Radio, Sparkles } from "lucide-react-native";
import { ConfirmDialog } from "@/src/shared/Dialogs";
import { supabase } from "@/src/shared/supabase";
import { useBeacon } from "@/src/shared/store";
import { Button, Chips, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { beaconScoreTier } from "@/src/features/profile/beaconScore";
import {
  BeaconShopCatalog,
  priceText,
  ShopArtwork,
  ShopPrice,
  type ShopProduct as Product,
} from "./BeaconShopCatalog";
import { demoCoinGrant, demoCoinScale, demoRewardActions } from "./demoRewards";
import {
  getRewardLook,
  lookSlots,
  lookSlotLabels,
  rewardLooks,
  type EquippedLooks,
  type LookId,
  type RewardTarget,
} from "./rewardLooks";

type Wallet = {
  coin_scale: number;
  balance: number;
  xp: number;
  tier: string;
  purchases_enabled: boolean;
  catalog: Product[];
  equipped: EquippedLooks;
  welcome: string[];
  spark_done: boolean;
  firsts: Record<string, number>;
  clicker?: {
    stage: number;
    week: string;
    remaining: number;
    taps_per_coin: number;
    next_price: number | null;
    next_rate: number | null;
    reset_at: string;
    charge: number;
  };
};
const previewCatalog: Product[] = (Object.keys(rewardLooks) as LookId[])
  .filter((id) => !id.startsWith("level-"))
  .map((id) => ({
    id,
    slot: rewardLooks[id].slot,
    price: rewardLooks[id].price * 12600,
    owned: id === "classic",
    min_tier: id === "lavender-signal" ? "plus" : undefined,
  }));
const quests = [
  [
    "welcome_setup",
    "Make It Yours",
    "Set availability or save a status note.",
    150,
    "/(tabs)/activities",
  ],
  [
    "welcome_map",
    "Discover the Map",
    "Explore a Beacon or use the Map’s discovery fallback.",
    300,
    "/(tabs)",
  ],
  [
    "welcome_people",
    "Find Your People",
    "Explore Squads or the Communities directory.",
    150,
    "/community-directory",
  ],
  [
    "welcome_move",
    "Make Your First Move",
    "Publish a Ping, Plan, or Beacon. A private Plan counts.",
    400,
    "/create",
  ],
] as const;
const firstNames: Record<string, string> = {
  ping_response: "First Ping response",
  decision: "First group decision",
  attend: "First verified attendance",
  host: "First verified host",
  welcome_map: "First Map discovery",
  welcome_move: "First creation",
};
const isTarget = (type: string | undefined): type is RewardTarget =>
  !!type && Object.hasOwn(lookSlots, type);

function EquipLookActions({
  product,
  targetType,
  equipped,
  disabled,
  onEquip,
}: {
  product: Product;
  targetType: RewardTarget;
  equipped: Wallet["equipped"];
  disabled: boolean;
  onEquip: (slot: string, item: string | null) => void;
}) {
  const slots =
    product.slot === "profile_set"
      ? ["profile", "profile_card", "status"]
      : [product.slot];
  return (
    <>
      {slots
        .filter((slot) => lookSlots[targetType].includes(slot))
        .map((slot) => {
          const isEquipped = equipped[slot] === product.id;
          return (
            <View key={slot} style={{ gap: 8 }}>
              <Button
                compact
                title={`${isEquipped ? "Equipped" : "Equip"} · ${lookSlotLabels[slot]}`}
                disabled={disabled || isEquipped}
                onPress={() => onEquip(slot, product.id)}
              />
              {isEquipped && (
                <Button
                  compact
                  secondary
                  title={`Reset ${lookSlotLabels[slot]}`}
                  disabled={disabled}
                  onPress={() => onEquip(slot, null)}
                />
              )}
            </View>
          );
        })}
    </>
  );
}

export default function BeaconShopScreen() {
  const { userId, demo } = useBeacon();
  const params = useLocalSearchParams<{
    tab?: string;
    type?: string;
    target?: string;
    mini?: string;
  }>();
  return (
    <Rewards
      key={JSON.stringify([
        userId,
        demo,
        params.type,
        params.target,
        params.tab,
        params.mini,
      ])}
      tab={params.tab === "Quests" ? "Quests" : "Shop"}
      type={isTarget(params.type) ? params.type : undefined}
      target={params.target}
      showMini={params.mini === "true"}
    />
  );
}

function Rewards({
  tab: initialTab,
  type,
  target,
  showMini,
}: {
  tab: "Shop" | "Quests";
  type?: RewardTarget;
  target?: string;
  showMini: boolean;
}) {
  const { userId, data, demo, act, getViewerEpoch, refresh } = useBeacon();
  const { styles, semanticColors: colors } = useTheme();
  const [tab, setTab] = useState(initialTab);
  const [serverWallet, setWallet] = useState<Wallet>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [miniOpen, setMiniOpen] = useState(showMini);
  const [details, setDetails] = useState<Product>();
  const [confirm, setConfirm] = useState<Product | "upgrade">();
  const pendingTap = useRef<{
    week: string;
    request_id: string;
    taps: number;
  } | null>(null);
  const tapQueue = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousWallet = useRef<Wallet | undefined>(undefined);
  const alive = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);
  const load = useCallback(
    async (
      action = "view",
      args: Record<string, number | string | null> = {},
    ) => {
      if (!userId || demo || !supabase) return;
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setNotice(undefined);
      const epoch = getViewerEpoch();
      try {
        const { data, error } = await supabase.rpc("beacon_rewards", {
          p_viewer: userId,
          p_action: action,
          p_args: {
            ...(target && type ? { target_type: type, target_id: target } : {}),
            ...args,
          },
        });
        if (error) throw error;
        if (!alive.current || epoch !== getViewerEpoch()) return;
        const next = data as Wallet;
        const previous = previousWallet.current;
        previousWallet.current = next;
        setWallet(next);
        if (action === "view" && previous && next.xp > previous.xp) {
          const extraCoins = next.balance - previous.balance;
          const earnedXP = `+${(next.xp - previous.xp).toLocaleString()} XP`;
          const title =
            !previous.welcome.includes("welcome_finish") &&
            next.welcome.includes("welcome_finish")
              ? "Adventure complete! "
              : !previous.spark_done && next.spark_done
                ? "Weekly Spark complete! "
                : "";
          setNotice(
            title +
              earnedXP +
              (extraCoins > 0
                ? ` · +${priceText(extraCoins, next.coin_scale)} Coins`
                : ""),
          );
        }
        if (action === "equip") {
          await refresh();
          if (alive.current && epoch === getViewerEpoch())
            setNotice("Appearance updated.");
        }
        if (action === "unlock") setNotice("Look unlocked and ready to equip.");
        if (action === "upgrade") setNotice("Mini Beacon upgraded.");
        if (action === "tap") pendingTap.current = null;
      } catch (error) {
        if (alive.current && epoch === getViewerEpoch()) {
          const message =
            typeof error === "object" && error && "message" in error
              ? String(error.message)
              : "Rewards couldn’t sync. Try again.";
          if (action === "tap" && message.startsWith("Refresh Mini Beacon"))
            pendingTap.current = null;
          setNotice(message);
        }
      } finally {
        inFlight.current = false;
        if (alive.current && epoch === getViewerEpoch()) setBusy(false);
      }
    },
    [demo, getViewerEpoch, refresh, target, type, userId],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const targetType = type ?? "profile";
  const targetId = target ?? (targetType === "profile" ? userId : null);
  const demoWallet = demo && data.is_demo ? data.demo_rewards : undefined;
  const wallet: Wallet | undefined =
    demo && data.is_demo
      ? {
          balance: demoWallet?.balance ?? 0,
          coin_scale: demoCoinScale,
          purchases_enabled: true,
          catalog: previewCatalog.map((item) => ({
            ...item,
            owned: item.owned || !!demoWallet?.owned.includes(item.id),
          })),
          equipped: (targetId && data.equipped_looks?.[targetId]) || {},
          tier: data.demo_premium_tier ?? "free",
          xp: 0,
          welcome: [],
          spark_done: false,
          firsts: {},
        }
      : serverWallet;
  const xp = wallet?.xp ?? 0;
  const { index, stage, nextStage } = beaconScoreTier(xp);
  const scale = wallet?.coin_scale ?? 12600;
  const catalog = (wallet?.catalog ?? previewCatalog).filter((item) =>
    getRewardLook(item.id),
  );
  const visible = catalog.filter(
    (item) =>
      !type ||
      lookSlots[type].includes(item.slot) ||
      (type === "profile" && item.slot === "profile_set"),
  );
  const selected = catalog.find((item) => item.id === details?.id);
  const equipped = Object.values(wallet?.equipped ?? {}).filter(
    (id): id is string => !!id,
  );
  const closePreview = () => {
    setDetails(undefined);
    setConfirm(undefined);
  };
  const clicker = wallet?.clicker;
  const welcome = wallet?.welcome ?? [];
  const complete = welcome.includes("welcome_finish");
  const flushTaps = useCallback(
    async function sendPendingTaps() {
      tapTimer.current = null;
      const activeClicker = previousWallet.current?.clicker;
      if (!alive.current || !activeClicker?.remaining) {
        tapQueue.current = 0;
        return;
      }
      if (inFlight.current) {
        tapTimer.current = setTimeout(() => void sendPendingTaps(), 200);
        return;
      }
      if (pendingTap.current?.week !== activeClicker.week) {
        const taps = Math.min(12, tapQueue.current, activeClicker.remaining);
        if (!taps) return;
        tapQueue.current -= taps;
        pendingTap.current = {
          request_id: randomUUID(),
          taps,
          week: activeClicker.week,
        };
      }
      await load("tap", pendingTap.current);
      if (
        alive.current &&
        !pendingTap.current &&
        tapQueue.current &&
        !tapTimer.current
      )
        tapTimer.current = setTimeout(() => void sendPendingTaps(), 200);
    },
    [load],
  );
  const tap = () => {
    if (!clicker?.remaining) return;
    if (
      !pendingTap.current ||
      inFlight.current ||
      pendingTap.current.week !== clicker.week
    )
      tapQueue.current = Math.min(12, tapQueue.current + 1);
    if (!tapTimer.current)
      tapTimer.current = setTimeout(() => void flushTaps(), 150);
  };
  const runDemoReward = async (
    action: keyof typeof demoRewardActions,
    args?: Record<string, string | number | null>,
  ) => {
    const epoch = getViewerEpoch();
    try {
      await act(demoRewardActions[action], args);
      if (!alive.current || getViewerEpoch() !== epoch) return;
      setNotice(
        action === "grant"
          ? `Added ${demoCoinGrant.toLocaleString()} demo Coins.`
          : action === "unlock"
            ? "Look unlocked and ready to equip."
            : "Appearance updated.",
      );
    } catch (error) {
      if (alive.current && getViewerEpoch() === epoch)
        setNotice(
          error instanceof Error
            ? error.message
            : "Demo Rewards couldn’t update.",
        );
    }
  };
  const equip = (slot: string, item: string | null) => {
    if (targetId)
      void (demo ? runDemoReward : load)("equip", {
        target_type: targetType,
        target_id: targetId,
        slot,
        item,
      });
  };
  const commit = () => {
    const choice = confirm;
    setConfirm(undefined);
    if (choice === "upgrade" && clicker?.next_price != null)
      void load("upgrade", {
        stage: clicker.stage + 1,
        expected_price: clicker.next_price,
      });
    else if (choice && choice !== "upgrade")
      void (demo ? runDemoReward : load)("unlock", {
        item: choice.id,
        expected_price: choice.price,
      });
  };

  const miniPanel = (
    <>
      <Button
        compact
        secondary
        title={miniOpen ? "Hide Mini Beacon" : "Mini Beacon"}
        onPress={() => setMiniOpen(!miniOpen)}
      />
      {miniOpen && (
        <View
          style={{
            gap: 9,
            padding: 14,
            backgroundColor: colors.surfaceSelected,
            borderRadius: 16,
          }}
        >
          <Txt>Mini Beacon</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tap Mini Beacon"
            disabled={!clicker}
            onPress={tap}
            style={({ pressed }) => ({
              alignSelf: "center",
              width: 74,
              height: 74,
              borderRadius: 37,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surfaceRaised,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <Svg
              pointerEvents="none"
              width={74}
              height={74}
              style={{ position: "absolute" }}
            >
              <Circle
                cx={37}
                cy={37}
                r={34}
                stroke={colors.border}
                strokeWidth={3}
                fill="none"
              />
              {!!clicker?.charge && (
                <Circle
                  cx={37}
                  cy={37}
                  r={34}
                  stroke={colors.accent}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={[
                    (2 * Math.PI * 34 * clicker.charge) / scale,
                    2 * Math.PI * 34,
                  ]}
                  transform="rotate(-90 37 37)"
                />
              )}
            </Svg>
            <Radio color={colors.accent} size={29} />
          </Pressable>
          {clicker && (
            <>
              <Txt muted>
                {clicker.taps_per_coin} taps per Coin ·{" "}
                {priceText(clicker.charge, scale)} / 1 Coin charged
              </Txt>
              <Txt muted>{clicker.remaining} rewarded taps left this week</Txt>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: 500,
                  now: 500 - clicker.remaining,
                }}
                style={{
                  height: 3,
                  borderRadius: 3,
                  backgroundColor: colors.border,
                }}
              >
                <View
                  style={{
                    height: 3,
                    backgroundColor: colors.accent,
                    width: `${(clicker.remaining / 500) * 100}%`,
                  }}
                />
              </View>
              <Txt muted>
                Resets {new Date(clicker.reset_at).toLocaleString()}
              </Txt>
              {clicker.next_rate != null && (
                <Txt muted>
                  Next upgrade gives {clicker.next_rate} taps per Coin.
                </Txt>
              )}
              {clicker.next_price != null && (
                <Button
                  compact
                  secondary
                  title={`Upgrade · ${priceText(clicker.next_price, scale)} Coins`}
                  disabled={
                    busy ||
                    !wallet?.purchases_enabled ||
                    (wallet?.balance ?? 0) < clicker.next_price
                  }
                  onPress={() => setConfirm("upgrade")}
                />
              )}
            </>
          )}
        </View>
      )}
    </>
  );

  return (
    <Screen title="Rewards" eyebrow="" compactHeader scrollStateKey={tab}>
      <View style={{ gap: 14 }}>
        <View
          style={{
            padding: 12,
            gap: 9,
            backgroundColor: colors.surfaceSelected,
            borderRadius: 16,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                flexShrink: 1,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 8,
                }}
              >
                <Coins size={20} color={colors.accent} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.h2}>
                  {wallet
                    ? `${priceText(wallet.balance, scale)} Coins`
                    : demo
                      ? "Shop preview"
                      : "Beacon Coins"}
                </Text>
                {demo ? (
                  <Txt muted>Demo session only</Txt>
                ) : (
                  wallet && <Txt muted>Level {index + 1}</Txt>
                )}
              </View>
            </View>
            {demo && data.is_demo ? (
              <Button
                compact
                secondary
                title="Add demo Coins"
                onPress={() => void runDemoReward("grant")}
              />
            ) : (
              tab === "Shop" && (
                <Button
                  compact
                  secondary
                  title="Earn Coins"
                  onPress={() => setTab("Quests")}
                />
              )
            )}
          </View>
          {wallet && !demo && tab === "Quests" && (
            <>
              <Txt muted>
                {(xp - stage.at).toLocaleString()} /{" "}
                {(nextStage.at - stage.at).toLocaleString()} XP to next level
              </Txt>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="XP toward next level"
                accessibilityValue={{
                  min: 0,
                  max: nextStage.at - stage.at,
                  now: xp - stage.at,
                }}
                style={{
                  height: 4,
                  borderRadius: 4,
                  backgroundColor: colors.border,
                }}
              >
                <View
                  style={{
                    height: 4,
                    backgroundColor: colors.accent,
                    width: `${(100 * (xp - stage.at)) / (nextStage.at - stage.at)}%`,
                  }}
                />
              </View>
            </>
          )}
        </View>
        <Chips
          options={["Shop", "Quests"] as const}
          value={tab}
          onChange={setTab}
        />
        {notice && !selected && (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {notice}
          </Text>
        )}
        {!wallet && !demo && userId && (
          <Button
            compact
            secondary
            title={busy ? "Syncing Rewards" : "Refresh Rewards"}
            disabled={busy}
            onPress={() => void load()}
          />
        )}
        {tab === "Shop" ? (
          <>
            {showMini && miniPanel}
            <BeaconShopCatalog
              products={visible}
              equipped={equipped}
              scope={type}
              scale={scale}
              onPreview={setDetails}
            />
            {!showMini && miniPanel}
            <Button
              compact
              secondary
              title="See BEACON+ Coin bonuses"
              onPress={() => router.push("/settings/premium")}
            />
          </>
        ) : (
          <>
            <Text style={styles.h2}>Your First Adventure</Text>
            <Txt muted>
              {quests.filter(([id]) => welcome.includes(id)).length} / 4
              complete · 1,200 XP and 120 base Coins
            </Txt>
            {quests.map(([id, name, description, reward, href]) => (
              <View
                key={id}
                style={{
                  padding: 12,
                  gap: 5,
                  borderRadius: 14,
                  backgroundColor: colors.surfaceSelected,
                }}
              >
                <Txt>
                  {name} · +{reward} XP
                  {welcome.includes(id) ? " · Complete" : ""}
                </Txt>
                <Txt muted>{description}</Txt>
                {!welcome.includes(id) && (
                  <Button
                    compact
                    secondary
                    title={name}
                    onPress={() =>
                      router.push(
                        (id === "welcome_map"
                          ? {
                              pathname: href,
                              params: { rewardDiscovery: "true" },
                            }
                          : id === "welcome_people"
                            ? {
                                pathname: href,
                                params: { rewardDiscovery: "true" },
                              }
                            : href) as Href,
                      )
                    }
                  />
                )}
              </View>
            ))}
            {complete && (
              <Button
                compact
                title="Explore Shop"
                onPress={() => setTab("Shop")}
              />
            )}
            <Text style={styles.h2}>Weekly Spark</Text>
            <Txt>
              Make Something Happen · +300 XP
              {wallet?.spark_done ? " · Complete" : ""}
            </Txt>
            <Txt muted>
              Host or attend a completed Beacon, help turn a shared Plan or
              decision into one, or respond to a Ping that becomes one.
            </Txt>
            {clicker && (
              <Txt muted>
                Resets {new Date(clicker.reset_at).toLocaleString()}
              </Txt>
            )}
            {!!Object.keys(wallet?.firsts ?? {}).length && (
              <>
                <Text style={styles.h2}>Firsts</Text>
                {Object.entries(wallet?.firsts ?? {}).map(([kind, amount]) => (
                  <Txt key={kind}>
                    {firstNames[kind] ?? kind} · +{amount.toLocaleString()} XP
                  </Txt>
                ))}
              </>
            )}
          </>
        )}
      </View>
      <Sheet
        title={selected ? rewardLooks[selected.id].name : "Look preview"}
        visible={!!selected}
        onClose={closePreview}
      >
        {selected && (
          <View style={{ gap: 13 }}>
            <ShopArtwork product={selected} size="detail" />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Txt muted>{lookSlotLabels[selected.slot]}</Txt>
              <ShopPrice
                product={selected}
                scale={scale}
                equipped={equipped.includes(selected.id)}
              />
            </View>
            {notice && (
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {notice}
              </Text>
            )}
            {selected.owned ? (
              targetId &&
              (lookSlots[targetType].includes(selected.slot) ||
                (targetType === "profile" &&
                  selected.slot === "profile_set")) ? (
                <EquipLookActions
                  product={selected}
                  targetType={targetType}
                  equipped={wallet?.equipped ?? {}}
                  disabled={busy || !wallet}
                  onEquip={equip}
                />
              ) : (
                <Txt muted>
                  {lookSlots.activity.includes(selected.slot)
                    ? "Open a Beacon you own to equip this look."
                    : "Open a community you manage to equip this look."}
                </Txt>
              )
            ) : selected.milestone_level ? (
              <Txt muted>
                Unlocks automatically at level {selected.milestone_level}.
              </Txt>
            ) : selected.min_tier &&
              (!wallet ||
                (selected.min_tier === "pro"
                  ? wallet.tier !== "pro"
                  : wallet.tier === "free")) ? (
              <Button
                title="Explore BEACON+"
                secondary
                onPress={() => {
                  closePreview();
                  router.push("/settings/premium");
                }}
              />
            ) : confirm && confirm !== "upgrade" ? (
              <View style={{ gap: 9 }}>
                <Txt>
                  Spend {priceText(confirm.price, scale)} Coins to unlock{" "}
                  {rewardLooks[confirm.id].name}?
                </Txt>
                <Button title="Confirm" disabled={busy} onPress={commit} />
                <Button
                  title="Cancel"
                  secondary
                  onPress={() => setConfirm(undefined)}
                />
              </View>
            ) : (
              <>
                {wallet?.purchases_enabled &&
                  wallet.balance < selected.price && (
                    <Txt muted>
                      {priceText(selected.price - wallet.balance, scale)} more
                      Coins needed.
                    </Txt>
                  )}
                {wallet?.purchases_enabled &&
                wallet.balance < selected.price ? (
                  demo ? (
                    <Button
                      secondary
                      title="Add demo Coins"
                      onPress={() => void runDemoReward("grant")}
                    />
                  ) : (
                    <Button
                      secondary
                      title="Find ways to earn Coins"
                      onPress={() => {
                        closePreview();
                        setTab("Quests");
                      }}
                    />
                  )
                ) : (
                  <Button
                    title="Buy"
                    disabled={busy || !wallet?.purchases_enabled}
                    onPress={() => setConfirm(selected)}
                  />
                )}
              </>
            )}
            {!wallet?.purchases_enabled && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <Sparkles size={15} color={colors.accent} />
                <Txt muted>Coin spending is currently in preview.</Txt>
              </View>
            )}
          </View>
        )}
      </Sheet>
      <ConfirmDialog
        visible={confirm === "upgrade"}
        title="Upgrade Mini Beacon?"
        message={`Spend ${priceText(clicker?.next_price ?? 0, scale)} Coins.`}
        confirmLabel="Confirm"
        onConfirm={commit}
        onClose={() => setConfirm(undefined)}
      />
    </Screen>
  );
}
