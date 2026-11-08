import { SegmentedControl } from "@/src/shared/design-system";
import { ThemedSwitch } from "@/src/shared/ThemedSwitch";
import { useNow } from "@/src/shared/useNow";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  Sparkles,
  Users,
  FlaskConical,
  Eye,
  Clock3,
  Shield,
  Zap,
  Crown,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Field, Screen, Txt, useTheme } from "@/src/shared/ui";
import { resolveSquadEntitlements } from "@/src/shared/entitlements";
import { boostBalance } from "../squadBoosts";
import { PlanChoice } from "@/src/features/plans/PlanPresentation";
import { canViewProfile } from "@/src/features/profile/privacy";
const level = (count: number, tier: string) =>
  tier === "pro"
    ? "Pro Squad"
    : tier === "plus"
      ? "Plus Squad"
      : count === 1
        ? "Supported"
        : "Free Squad";
export function SquadBoostLink({
  squadId,
  showSquadName = false,
}: {
  squadId: string;
  showSquadName?: boolean;
}) {
  const { data, userId } = useBeacon();
  if (
    !data.squad_members.some(
      (m) => m.squad_id === squadId && m.user_id === userId,
    )
  )
    return null;
  const e = resolveSquadEntitlements(data, squadId);
  return (
    <PlanChoice
      title={
        showSquadName
          ? (data.squads.find((s) => s.id === squadId)?.name ?? "Squad")
          : "Boost Squad"
      }
      detail={`${level(e.total, e.tier)} · ${e.total}/5 active Boosts`}
      icon={Sparkles}
      onPress={() =>
        router.push(
          `/squad-boosts?squadId=${encodeURIComponent(squadId)}` as Href,
        )
      }
    />
  );
}
export default function SquadBoostScreen() {
  const { data, userId } = useBeacon();
  const { squadId } = useLocalSearchParams<{ squadId?: string }>();
  const [query, setQuery] = useState("");
  const joined = data.squads.filter(
    (s) =>
      !s.archived_at &&
      data.squad_members.some(
        (m) => m.squad_id === s.id && m.user_id === userId,
      ),
  );
  const squad = joined.find((s) => s.id === squadId);
  return (
    <Screen
      title={squad ? `Boost ${squad.name}` : "Squad Boosts"}
      eyebrow="MORE TOGETHER"
      create={false}
    >
      {squad ? (
        <BoostManagement squadId={squad.id} />
      ) : squadId ? (
        <Txt>This Squad is unavailable to this account.</Txt>
      ) : (
        <>
          <Txt muted>
            Contribute included Boosts to a Squad you belong to. Your personal
            membership works without allocating Boosts.
          </Txt>
          <Field
            label="Find your Squad"
            value={query}
            onChangeText={setQuery}
          />
          {joined
            .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 20)
            .map((s) => (
              <SquadBoostLink key={s.id} squadId={s.id} showSquadName />
            ))}
          {!joined.length && (
            <Txt muted>Join a Squad to contribute a Boost.</Txt>
          )}
        </>
      )}
    </Screen>
  );
}
function BoostManagement({ squadId }: { squadId: string }) {
  const now = useNow();
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const balance = boostBalance(data, userId),
    e = resolveSquadEntitlements(data, squadId);
  const [named, setNamed] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const own = (data.boost_allocations ?? []).filter(
    (b) => b.squad_id === squadId && b.owner_id === userId && !b.released_at,
  );
  const showName = own.length ? own.some((boost) => !boost.hidden) : named;
  const cooling = (data.boost_allocations ?? []).filter(
    (b) =>
      b.owner_id === userId &&
      b.released_at &&
      Date.parse(b.available_at ?? "") >
        (data.is_demo && data.demo_boost_clock
          ? Date.parse(data.demo_boost_clock)
          : now),
  );
  const contributors =
    data.squad_premium?.find((s) => s.squad_id === squadId)?.contributors ?? [];
  const grouped = new Map<string, number>();
  contributors.forEach((c) =>
    grouped.set(
      c.user_id ?? "anonymous",
      (grouped.get(c.user_id ?? "anonymous") ?? 0) + 1,
    ),
  );
  return (
    <View style={{ gap: 14 }}>
      <View
        style={[styles.card, e.total > 0 && { borderColor: colors.primary }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Zap size={23} color={colors.primary} />
          <Text style={styles.h2}>{level(e.total, e.tier)}</Text>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", gap: 5 }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  index < e.total ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
        <Txt>
          {e.total}/5 active Boosts · {Math.max(0, 5 - e.total)} open slots
        </Txt>
        <Txt muted>
          {e.total >= 4
            ? "Pro shared tools unlocked"
            : e.total >= 2
              ? `${e.total}/4 toward Pro`
              : `${e.total}/2 toward Plus`}
        </Txt>
        {e.grace_until && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Clock3 size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt muted>
                Grace benefits until {new Date(e.grace_until).toLocaleString()}.
              </Txt>
            </View>
          </View>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.h2}>Shared benefits</Text>
        {[
          {
            icon: Shield,
            title: "Supported · 1 Boost",
            detail: "Recognition and an accent frame",
          },
          {
            icon: Zap,
            title: "Plus · 2–3 Boosts",
            detail: "Shared assignments, deadlines, focus sequences and albums",
          },
          {
            icon: Crown,
            title: "Pro · 4–5 Boosts",
            detail: "Preparation overviews, grouped sessions and Afterglow",
          },
        ].map(({ icon: Icon, title, detail }) => (
          <View
            key={title}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Icon size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt>{title}</Txt>
              <Txt muted>{detail}</Txt>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Txt>Your contributions · {own.length}</Txt>
        <Txt muted>
          {balance.available} available · {balance.allocated} allocated ·{" "}
          {balance.cooling} cooling down
        </Txt>
        {!data.is_demo && !data.capabilities?.squad_boosts ? (
          <Txt muted>
            Boost management is unavailable until the backend migration is
            deployed.
          </Txt>
        ) : (
          <>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Eye size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Txt>Show contributor name</Txt>
                <Txt muted>Visible to eligible Squad members</Txt>
              </View>
              <ThemedSwitch
                accessibilityLabel="Show contributor name"
                value={showName}
                disabled={savingPrivacy}
                onValueChange={async (value) => {
                  setNamed(value);
                  if (!own.length) return;
                  setSavingPrivacy(true);
                  setPrivacyError("");
                  try {
                    for (const boost of own) {
                      if (boost.hidden === value)
                        await act("set_boost_privacy", {
                          id: boost.id,
                          hidden: !value,
                        });
                    }
                  } catch (error) {
                    setPrivacyError(
                      error instanceof Error
                        ? error.message
                        : "Could not update visibility.",
                    );
                  } finally {
                    setSavingPrivacy(false);
                  }
                }}
              />
            </View>
            {!!privacyError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {privacyError}
              </Text>
            )}
            <Action
              title="Contribute one Boost"
              disabled={savingPrivacy || !balance.available || e.total >= 5}
              run={() =>
                act("assign_boost", { squad_id: squadId, hidden: !showName })
              }
            />
            {own.length > 0 && (
              <>
                <Action
                  compact
                  secondary
                  title="Withdraw one Boost"
                  run={() =>
                    act("withdraw_boost", { id: own[own.length - 1].id })
                  }
                />
              </>
            )}
            {!balance.allowance && (
              <Button
                compact
                secondary
                title="Included Boosts · Premium"
                onPress={() => router.push("/settings/premium" as Href)}
              />
            )}
            <Txt muted>
              Withdrawal starts a 72-hour transfer wait for that slot. Your
              Squad may retain its level temporarily during grace.
            </Txt>
          </>
        )}
        {cooling.map((b) => (
          <Txt key={b.id} muted>
            Slot available {new Date(b.available_at!).toLocaleString()}
          </Txt>
        ))}
      </View>
      {grouped.size > 0 && (
        <View style={styles.card}>
          <Txt>Contributors</Txt>
          {[...grouped].map(([id, count]) => {
            const person = data.profiles.find((p) => p.id === id);
            const name =
              id === userId
                ? "You"
                : person && userId && canViewProfile(data, person, userId)
                  ? person.name
                  : "Anonymous member";
            return (
              <Txt key={id} muted>
                {name} · {count} Boost{count === 1 ? "" : "s"}
              </Txt>
            );
          })}
        </View>
      )}
      <DemoSquadBoostSelector squadId={squadId} />
    </View>
  );
}
export function PremiumBoostSummary() {
  const { data, userId } = useBeacon();
  const { styles } = useTheme();
  const b = boostBalance(data, userId);
  const active = (data.boost_allocations ?? []).filter(
    (b) => b.owner_id === userId && !b.released_at,
  );
  return (
    <View style={styles.card}>
      <Txt>Squad Boosts · {b.allowance} included</Txt>
      <Txt muted>
        {b.allocated} allocated · {b.available} available · {b.cooling} cooling
        down
      </Txt>
      {[...new Set(active.map((b) => b.squad_id))]
        .filter((id): id is string => !!id)
        .map((id) => (
          <Txt key={id} muted>
            {data.squads.find((s) => s.id === id)?.name ?? "Former Squad"}
          </Txt>
        ))}
      <PlanChoice
        title="Manage Boosts"
        detail="Contributions, shared benefits and transfer waits"
        icon={Users}
        onPress={() => router.push("/squad-boosts" as Href)}
      />
    </View>
  );
}
export function DemoSquadBoostSelector({ squadId }: { squadId?: string }) {
  const { data, demo, userId, act } = useBeacon();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(squadId ?? ""),
    [query, setQuery] = useState("");
  if (!demo) return null;
  const squads = data.squads.filter((s) =>
    data.squad_members.some((m) => m.squad_id === s.id && m.user_id === userId),
  );
  const id = squadId || selected || squads[0]?.id;
  const current = id ? resolveSquadEntitlements(data, id) : null;
  return (
    <View style={{ gap: 8 }}>
      <PlanChoice
        title="Simulate Squad Boosts"
        detail="Preview shared perks and grace periods"
        icon={FlaskConical}
        expanded={open}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Txt>Simulated Squad entitlement</Txt>
          {!squadId && (
            <>
              <Field
                label="Find demo Squad"
                value={query}
                onChangeText={setQuery}
              />
              {squads
                .filter((s) =>
                  s.name.toLowerCase().includes(query.toLowerCase()),
                )
                .slice(0, 8)
                .map((s) => (
                  <PlanChoice
                    key={s.id}
                    title={s.name}
                    detail="Preview this Squad"
                    icon={Users}
                    selected={id === s.id}
                    onPress={() => setSelected(s.id)}
                  />
                ))}
            </>
          )}
          <Txt muted>
            {squads.find((s) => s.id === id)?.name ?? "Choose a Squad"} ·{" "}
            {current ? level(current.total, current.tier) : ""}
          </Txt>
          {id && (
            <SegmentedControl
              shape="panel"
              accessibilityLabel="Demo Squad Boost total"
              options={["0", "1", "2", "3", "4", "5"].map((value) => ({
                value,
                label: value,
                accessibilityLabel: `Demo Squad Boost total: ${value}`,
              }))}
              value={String(current?.total ?? 0)}
              onChange={(v) => {
                void act("demo_squad_boost_total", {
                  squad_id: id,
                  total: Number(v),
                }).catch(() => undefined);
              }}
            />
          )}
          <Action
            compact
            secondary
            title="Simulate grace expiry"
            run={() => act("demo_expire_boost_grace")}
          />
          <Txt muted>
            Demo only. Totals do not allocate personal Boosts. Contributing or
            withdrawing clears that Squad’s override.
          </Txt>
        </>
      )}
    </View>
  );
}
