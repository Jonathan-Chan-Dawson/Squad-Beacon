import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { Text, View } from "react-native";
import { Coins, Info, Sparkles } from "lucide-react-native";
import { Dialog } from "@/src/shared/Dialogs";
import { PrimaryTab } from "@/src/shared/NavigationTabs";
import { supabase } from "@/src/shared/supabase";
import { useBeacon } from "@/src/shared/store";
import { Button, IconButton, Screen, Txt, useTheme } from "@/src/shared/ui";
import { beaconScoreTier } from "@/src/features/profile/beaconScore";
import { BeaconScoreSheet } from "@/src/features/profile/components/BeaconScoreSheet";
import { useBeaconScore } from "@/src/features/profile/useBeaconScore";
import {
  BeaconShopCatalog,
  priceText,
  ShopArtwork,
  ShopPrice,
  type ShopProduct as Product,
} from "./BeaconShopCatalog";
import { demoCoinScale, demoRewardActions } from "./demoRewards";
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
  shop_unlocked?: boolean;
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
const rewardTabs = ["Shop", "Quests", "Progress"] as const;

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
  }>();
  return (
    <Rewards
      key={JSON.stringify([
        userId,
        demo,
        params.type,
        params.target,
        params.tab,
      ])}
      tab={params.tab === "Quests" || params.tab === "Progress" ? params.tab : "Shop"}
      type={isTarget(params.type) ? params.type : undefined}
      target={params.target}
    />
  );
}

function Rewards({
  tab: initialTab,
  type,
  target,
}: {
  tab: "Shop" | "Quests" | "Progress";
  type?: RewardTarget;
  target?: string;
}) {
  const { userId, data, demo, act, getViewerEpoch, refresh } = useBeacon();
  const { styles, semanticColors: colors } = useTheme();
  const score = useBeaconScore(userId, demo);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [serverWallet, setWallet] = useState<Wallet>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Product>();
  const [confirm, setConfirm] = useState<Product>();
  const previousWallet = useRef<Wallet | undefined>(undefined);
  const alive = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;

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
      } catch (error) {
        if (alive.current && epoch === getViewerEpoch()) {
          const message =
            typeof error === "object" && error && "message" in error
              ? String(error.message)
              : "Rewards couldn’t sync. Try again.";
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
          shop_unlocked: demoWallet?.stage !== 0,
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
  const shopLocked = wallet?.shop_unlocked === false;
  const selected = wallet && !shopLocked
    ? catalog.find((item) => item.id === details?.id)
    : undefined;
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
  const runDemoReward = async (
    action: "unlock" | "equip",
    args?: Record<string, string | number | null>,
  ) => {
    const epoch = getViewerEpoch();
    try {
      await act(demoRewardActions[action], args);
      if (!alive.current || getViewerEpoch() !== epoch) return;
      setNotice(
        action === "unlock" ? "Look unlocked and ready to equip." : "Appearance updated.",
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
    if (choice)
      void (demo ? runDemoReward : load)("unlock", {
        item: choice.id,
        expected_price: choice.price,
      });
  };

  return (
    <Screen title="Rewards" eyebrow="" compactHeader create={false} scrollStateKey={tab}
      headerAction={
        <IconButton label="About Rewards" onPress={() => setAboutOpen(true)}>
          <Info size={20} color={colors.textSecondary} />
        </IconButton>
      }
    >
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
          </View>
          {wallet && !demo && tab === "Progress" && (
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
        <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {rewardTabs.map((item) => (
            <PrimaryTab key={item} role="tab" label={item} selected={item === tab} onPress={() => setTab(item)} />
          ))}
        </View>
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
        {tab === "Shop" && shopLocked ? (
          <View style={{ gap: 8 }}>
            <Txt>Tap Mini Beacon 10 times to unlock Shop.</Txt>
            <Button compact title="Open Profile" onPress={() => router.navigate("/profile")} />
          </View>
        ) : tab === "Shop" && !wallet ? null : tab === "Shop" ? (
          <>
            <BeaconShopCatalog
              products={visible}
              equipped={equipped}
              scope={type}
              scale={scale}
              onPreview={setDetails}
            />
            <Button
              compact
              secondary
              title="See BEACON+ Coin bonuses"
              onPress={() => router.push("/settings/premium")}
            />
          </>
        ) : tab === "Progress" ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.h2}>Beacon Score</Text>
            <Txt>{xp.toLocaleString()} lifetime XP</Txt>
            <Txt muted>Earn XP by participating in Squad Beacon. Use Coins to customize your experience.</Txt>
            <Button compact secondary title="View Beacon Score" onPress={() => { setScoreOpen(true); void score.refresh(); }} />
          </View>
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
      <Dialog
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
            ) : confirm ? (
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
                  <Button
                    secondary
                    title="Find ways to earn Coins"
                    onPress={() => { closePreview(); setTab("Quests"); }}
                  />
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
      </Dialog>
      <Dialog title="About Rewards" visible={aboutOpen} onClose={() => setAboutOpen(false)}>
        <View style={{ gap: 8 }}>
          <Txt>XP tracks your lifetime Beacon Score. Coins pay for looks and upgrades.</Txt>
          <Txt muted>Energy is your weekly allowance for rewarded taps on Profile.</Txt>
        </View>
      </Dialog>
      <BeaconScoreSheet score={score} visible={scoreOpen} onClose={() => setScoreOpen(false)} insideRewards />
    </Screen>
  );
}
