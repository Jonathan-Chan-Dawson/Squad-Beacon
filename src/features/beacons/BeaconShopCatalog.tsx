import { useId, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowUpRight,
  Check,
  Coffee,
  Coins,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Avatar, Chips, Txt, useTheme } from "@/src/shared/ui";
import { MapProjector } from "@/src/features/maps/components/MapProjector";
import {
  beaconMapLook,
  lookSlotLabels,
  lookSlots,
  rewardLooks,
  type LookId,
  type RewardTarget,
} from "./rewardLooks";

export type ShopProduct = {
  id: LookId;
  slot: string;
  price: number;
  owned: boolean;
  min_tier?: string;
  milestone_level?: number;
};

const categories = [
  "All looks",
  "Beacons",
  "Profile",
  "Communities",
  "Owned",
] as const;
const showcase: Record<RewardTarget, LookId> = {
  activity: "aurora",
  profile: "starter-ring",
  squad: "community-backdrop",
  space: "community-backdrop",
  organization: "community-backdrop",
};
const isLockedMilestone = (item: ShopProduct) =>
  !!item.milestone_level && !item.owned;

export const priceText = (value: number, scale = 12600) =>
  (value / scale).toLocaleString(undefined, { maximumFractionDigits: 4 });

export function ShopPrice({
  product,
  scale,
  equipped,
}: {
  product: ShopProduct;
  scale: number;
  equipped?: boolean;
}) {
  const { semanticColors: colors } = useTheme();
  if (equipped || product.owned) {
    return (
      <View style={layout.inline}>
        <Check size={13} color={colors.success} />
        <Text style={[layout.meta, { color: colors.textPrimary }]}>
          {equipped
            ? "Equipped"
            : product.price === 0 && product.id === "classic"
              ? "Included"
              : "Owned"}
        </Text>
      </View>
    );
  }
  return (
    <View style={[layout.inline, { flexWrap: "wrap" }]}>
      {!product.milestone_level && <Coins size={13} color={colors.accent} />}
      <Text style={[layout.meta, { color: colors.textPrimary }]}>
        {product.milestone_level
          ? `Level ${product.milestone_level}`
          : `${priceText(product.price, scale)} Coins`}
      </Text>
      {!!product.min_tier && (
        <Text style={[layout.meta, { color: colors.textSecondary }]}>
          {product.min_tier === "pro" ? "BEACON+ Pro" : "BEACON+"}
        </Text>
      )}
    </View>
  );
}

export function ShopArtwork({
  product,
  size = "tile",
}: {
  product: ShopProduct;
  size?: "tile" | "spotlight" | "detail";
}) {
  const look = rewardLooks[product.id];
  const color = look.color;
  const mapLook = beaconMapLook({ [product.slot]: product.id });
  const sampleCategoryColor = "#65E5E8";
  const beam = mapLook.beam ?? sampleCategoryColor;
  const projector =
    lookSlots.activity.includes(product.slot) && product.slot !== "card";
  const large = size === "detail";
  const glow = useId().replace(/[^a-zA-Z0-9]/g, "");
  const projectorSize = large ? 78 : 49;
  const CardIcon =
    product.slot === "card"
      ? Coffee
      : product.slot === "community"
        ? Users
        : MessageCircle;
  const cardTitle =
    product.slot === "card"
      ? "Coffee after work"
      : product.slot === "community"
        ? "Weekend Walkers"
        : product.slot === "status"
          ? "Free for a walk"
          : "Sam Rivera";

  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[
        layout.artwork,
        size === "spotlight" && layout.spotlightArt,
        { height: large ? 212 : size === "spotlight" ? 126 : 120 },
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 200 130"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={glow} cx="50%" cy="48%" rx="52%" ry="62%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.31} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="200" height="130" fill={`url(#${glow})`} />
        <Ellipse
          cx="100"
          cy="65"
          rx="61"
          ry="44"
          stroke={color}
          strokeOpacity={0.23}
          strokeWidth={0.7}
          rotation="-21"
          origin="100, 65"
          fill="none"
        />
        <Ellipse
          cx="100"
          cy="65"
          rx="82"
          ry="58"
          stroke={color}
          strokeOpacity={0.13}
          strokeWidth={0.7}
          rotation="-21"
          origin="100, 65"
          fill="none"
        />
        <Circle cx="42" cy="40" r="1.4" fill={color} fillOpacity={0.8} />
        <Circle
          cx="156"
          cy="83"
          r="1.4"
          fill={mapLook.beam ?? color}
          fillOpacity={0.85}
        />
        <Circle cx="148" cy="29" r="0.9" fill="#FFFFFF" fillOpacity={0.55} />
        <Circle cx="67" cy="107" r="0.9" fill="#FFFFFF" fillOpacity={0.45} />
      </Svg>
      {projector ? (
        <View
          style={[layout.projector, { width: 110, height: large ? 165 : 91 }]}
        >
          <MapProjector
            kind="beacon"
            color={beam}
            top={projectorSize + (large ? 3 : 0)}
            center={55}
            width={large ? 103 : 68}
            height={large ? 55 : 33}
            opacity={1}
          />
          <View
            style={[
              layout.lens,
              {
                width: projectorSize,
                height: projectorSize,
                borderColor: mapLook.frame ?? sampleCategoryColor,
                backgroundColor: "#14192B",
              },
            ]}
          >
            <Coffee
              color={sampleCategoryColor}
              size={large ? 35 : 24}
              strokeWidth={1.7}
            />
          </View>
        </View>
      ) : product.slot === "ring" ? (
        <View
          style={[
            layout.ring,
            { borderColor: color, backgroundColor: color + "24" },
          ]}
        >
          <Avatar name="Sam Rivera" size={large ? 78 : 48} />
        </View>
      ) : (
        <View
          style={[
            layout.sampleCard,
            {
              borderColor: color + "88",
              backgroundColor: color + "29",
              maxWidth: large ? 250 : 155,
            },
          ]}
        >
          {product.slot === "profile_set" ? (
            <Avatar name={cardTitle} size={30} />
          ) : (
            <CardIcon size={19} color={color} />
          )}
          <Text
            numberOfLines={1}
            style={[layout.sampleTitle, large && { fontSize: 17 }]}
          >
            {cardTitle}
          </Text>
        </View>
      )}
    </View>
  );
}

export function BeaconShopCatalog({
  products,
  equipped,
  scope,
  scale,
  onPreview,
}: {
  products: ShopProduct[];
  equipped: string[];
  scope?: RewardTarget;
  scale: number;
  onPreview: (item: ShopProduct) => void;
}) {
  const { styles, semanticColors: colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const [category, setCategory] =
    useState<(typeof categories)[number]>("All looks");
  const [gridWidth, setGridWidth] = useState(0);
  const columns = width < 350 || fontScale > 1.4 ? 1 : gridWidth >= 530 ? 3 : 2;
  const tileWidth = gridWidth
    ? (gridWidth - (columns - 1) * 12) / columns
    : undefined;
  const featured = products.find(
    (item) => item.id === showcase[scope ?? "profile"],
  );
  const visible = products
    .filter((product) => {
      if (category === "Owned") return product.owned;
      if (category === "Beacons")
        return lookSlots.activity.includes(product.slot);
      if (category === "Profile")
        return (
          lookSlots.profile.includes(product.slot) ||
          product.slot === "profile_set"
        );
      if (category === "Communities") return product.slot === "community";
      return true;
    })
    .sort(
      (first, second) =>
        Number(isLockedMilestone(first)) - Number(isLockedMilestone(second)) ||
        first.price - second.price,
    );

  return (
    <View style={{ gap: 16 }}>
      {featured && category === "All looks" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${rewardLooks[featured.id].name}`}
          onPress={() => onPreview(featured)}
          style={({ pressed }) => [
            layout.spotlight,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceSelected,
              opacity: pressed ? 0.84 : 1,
            },
          ]}
        >
          <View style={layout.spotlightCopy}>
            <View style={layout.inline}>
              <Sparkles size={14} color={colors.accent} />
              <Text style={[layout.meta, { color: colors.textSecondary }]}>
                {featured.id === "starter-ring"
                  ? "Starter look"
                  : "Featured look"}
              </Text>
            </View>
            <Text style={styles.h2}>{rewardLooks[featured.id].name}</Text>
            <ShopPrice
              product={featured}
              scale={scale}
              equipped={equipped.includes(featured.id)}
            />
          </View>
          <ShopArtwork product={featured} size="spotlight" />
        </Pressable>
      )}
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={styles.h2}>
          Browse looks
        </Text>
        <Chips
          options={scope ? (["All looks", "Owned"] as const) : categories}
          value={category}
          onChange={setCategory}
          accessibilityPrefix="Filter looks"
        />
      </View>
      <View
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        style={layout.grid}
      >
        {visible.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${rewardLooks[item.id].name}`}
            accessibilityHint={lookSlotLabels[item.slot]}
            onPress={() => onPreview(item)}
            style={({ pressed }) => [
              layout.tile,
              {
                width: tileWidth ?? (columns === 1 ? "100%" : "47%"),
                backgroundColor: colors.surface,
                borderColor: pressed ? colors.accent : colors.border,
                opacity: pressed ? 0.84 : 1,
              },
            ]}
          >
            <ShopArtwork product={item} />
            <View style={layout.tileBody}>
              <Text style={[layout.meta, { color: colors.textSecondary }]}>
                {lookSlotLabels[item.slot]}
              </Text>
              <View
                style={[layout.inline, { justifyContent: "space-between" }]}
              >
                <Text style={[styles.body, layout.tileName]}>
                  {rewardLooks[item.id].name}
                </Text>
                <ArrowUpRight size={14} color={colors.textSecondary} />
              </View>
              <ShopPrice
                product={item}
                scale={scale}
                equipped={equipped.includes(item.id)}
              />
            </View>
          </Pressable>
        ))}
        {!visible.length && (
          <Txt muted>No looks owned in this collection yet.</Txt>
        )}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: 12, fontWeight: "600" },
  artwork: {
    backgroundColor: "#13182B",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  spotlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 7,
    borderWidth: 1,
    borderRadius: 20,
  },
  spotlightArt: { flex: 1, alignSelf: "center" },
  spotlightCopy: { flex: 1.25, gap: 9, paddingVertical: 7, paddingLeft: 9 },
  projector: { alignItems: "center", paddingTop: 4 },
  lens: {
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: { borderWidth: 2, padding: 4, borderRadius: 100 },
  sampleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    width: "87%",
    padding: 9,
    borderWidth: 1,
    borderRadius: 12,
  },
  sampleTitle: { flex: 1, color: "#F3F3FA", fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { borderWidth: 1, borderRadius: 17, padding: 5 },
  tileBody: { paddingHorizontal: 6, paddingTop: 7, paddingBottom: 6, gap: 4 },
  tileName: { flex: 1, fontWeight: "700" },
});
