import type { Data, Payload } from "@/src/shared/types";
import { canManageOrganization } from "@/src/features/organizations/domain";
import { canManageSpace } from "@/src/features/spaces/domain";
import { getRewardLook, lookSlots, type RewardTarget } from "./rewardLooks";

export const demoCoinScale = 12600;
export const demoCoinGrant = 5000;
export const demoRewardActions = {
  grant: "demo_rewards_grant",
  unlock: "demo_rewards_unlock",
  equip: "demo_rewards_equip",
  tap: "demo_rewards_tap",
} as const;

export function applyDemoRewards(
  data: Data,
  viewer: string,
  action: string,
  payload: Payload,
): Data | undefined {
  if (!Object.values<string>(demoRewardActions).includes(action)) return;
  if (!data.is_demo || data.viewer_id !== viewer)
    throw new Error("Open the demo to use demo Coins.");
  const wallet = data.demo_rewards ?? { balance: 0, owned: [] };
  if (action === demoRewardActions.tap) {
    const taps = wallet.taps ?? 0;
    if (taps >= 500) return data;
    return {
      ...data,
      demo_rewards: {
        ...wallet,
        balance: wallet.balance + demoCoinScale / 10,
        stage: wallet.stage === 0 && taps < 9 ? 0 : 1,
        taps: taps + 1,
      },
    };
  }
  if (action === demoRewardActions.grant) {
    const balance = wallet.balance + demoCoinGrant * demoCoinScale;
    return { ...data, demo_rewards: { ...wallet, balance } };
  }

  const item = typeof payload.item === "string" ? payload.item : undefined;
  const look = getRewardLook(item);
  const owned = !!item && (item === "classic" || wallet.owned.includes(item));
  if (action === demoRewardActions.unlock) {
    if (!item || !look || item.startsWith("level-")) {
      throw new Error("This look is unavailable.");
    }
    if (owned) return data;
    if (
      item === "lavender-signal" &&
      (!data.demo_premium_tier || data.demo_premium_tier === "free")
    ) {
      throw new Error("This look requires BEACON+.");
    }
    const price = look.price * demoCoinScale;
    if (payload.expected_price !== price)
      throw new Error("The price changed. Refresh the Shop.");
    if (wallet.balance < price) throw new Error("You need more demo Coins.");
    return {
      ...data,
      demo_rewards: {
        ...wallet,
        balance: wallet.balance - price,
        owned: [...wallet.owned, item],
      },
    };
  }

  const { target_id: id, target_type: target, slot } = payload;
  if (
    typeof id !== "string" ||
    typeof target !== "string" ||
    typeof slot !== "string"
  ) {
    throw new Error("Choose where to equip this look.");
  }
  const network =
    target === "organization" &&
    data.organizations.find((row) => row.id === id);
  const canEquip =
    (target === "profile" && id === viewer) ||
    (target === "activity" &&
      data.activities.some(
        (row) =>
          row.id === id && row.owner_id === viewer && row.mode !== "solo",
      )) ||
    (target === "squad" &&
      data.squad_members.some(
        (row) =>
          row.squad_id === id &&
          row.user_id === viewer &&
          ["owner", "coowner", "admin"].includes(row.role),
      )) ||
    (target === "space" && canManageSpace(data, id, viewer)) ||
    (network &&
      canManageOrganization(network, data.organization_members, viewer));
  if (!canEquip || !lookSlots[target as RewardTarget]?.includes(slot)) {
    throw new Error("You cannot change this appearance.");
  }
  if (
    payload.item !== null &&
    (!owned ||
      (look?.slot !== slot &&
        !(
          look?.slot === "profile_set" &&
          ["profile", "profile_card", "status"].includes(slot)
        )))
  ) {
    throw new Error("Unlock a compatible look first.");
  }
  const equipped = { ...data.equipped_looks?.[id] };
  if (item && item !== "classic") equipped[slot] = item;
  else delete equipped[slot];
  return {
    ...data,
    equipped_looks: { ...data.equipped_looks, [id]: equipped },
  };
}
