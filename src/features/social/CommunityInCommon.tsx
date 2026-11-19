import { BeaconIcon } from "@/src/features/beacons/components/BeaconIcon";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Button, Field, Sheet, Txt } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";
import {
  ProfileLink,
  ProfileSection,
} from "@/src/features/people/components/ProfilePrimitives";
import { matchesSearch } from "@/src/shared/search";
import { selectCommunityInCommon, type CommonItem } from "./inCommon";
import type { SocialEntityType } from "./types";
import { CommunityActivityRow } from "./CommunityActivityRow";

export function CommunityInCommon({
  type,
  id,
}: {
  type: SocialEntityType;
  id: string;
}) {
  const { userId, viewerEpoch } = useBeacon();
  return (
    <InCommonBody
      key={`${userId}:${viewerEpoch}:${type}:${id}`}
      type={type}
      id={id}
    />
  );
}
function InCommonBody({ type, id }: { type: SocialEntityType; id: string }) {
  const { data, userId } = useBeacon();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const groups = useMemo(
    () => selectCommunityInCommon(data, userId, type, id),
    [data, userId, type, id],
  );
  const group = groups.find((g) => g.id === selected);
  const beacons = groups.find((g) => g.id === "beacons");
  const firstBeacon = beacons?.items.find((item) => item.kind === "beacon");
  if (!groups.length) return null;
  const open = (item: CommonItem) => {
    setSelected(null);
    if (item.kind === "person")
      router.push({ pathname: "/person/[id]", params: { id: item.id } });
    else if (item.kind === "beacon")
      router.push({ pathname: "/activity/[id]", params: { id: item.id } });
    else if (item.entityType === "squad")
      router.push({ pathname: "/squad/[id]", params: { id: item.id } });
    else if (item.entityType === "space")
      router.push({ pathname: "/space/[id]", params: { id: item.id } });
    else
      router.push({ pathname: "/organization/[id]", params: { id: item.id } });
  };
  const row = (item: CommonItem) =>
    item.kind === "beacon" ? (
      <CommunityActivityRow key={item.id} activity={item.activity} />
    ) : (
      <ProfileLink
        surface
        key={`${item.kind}:${item.id}`}
        title={item.name}
        detail={item.detail}
        icon={
          item.kind === "person" ? (
            <ProfileAvatar profile={item.profile} size={44} />
          ) : (
            <CommunityAvatar
              type={item.entityType}
              iconKey={item.iconKey}
              size={44}
            />
          )
        }
        onPress={() => open(item)}
      />
    );
  const filteredGroups = [...groups]
    .sort((a, b) => Number(b.id === selected) - Number(a.id === selected))
    .map((g) => ({
      ...g,
      items: g.items.filter((item) =>
        matchesSearch(query, item.name, item.detail),
      ),
    }))
    .filter((g) => g.items.length);
  return (
    <View testID="community-in-common" style={{ gap: 14 }}>
      {groups
        .filter((g) => g.id !== "beacons")
        .map((g) => (
          <ProfileSection
            key={g.id}
            title={`${g.title} · ${g.items.length}`}
            action={
              g.items.length > 3 ? (
                <Button
                  compact
                  secondary
                  title={`See all · ${g.title}`}
                  onPress={() => {
                    setSelected(g.id);
                    setQuery("");
                    setLimit(10);
                  }}
                />
              ) : undefined
            }
          >
            {g.items.slice(0, 3).map(row)}
          </ProfileSection>
        ))}
      {beacons && (
        <ProfileLink
          surface
          title="Shared Beacons in common"
          detail={`${beacons.items.length} hosted or joined Beacons`}
          icon={
            <BeaconIcon
              category={
                firstBeacon?.kind === "beacon"
                  ? firstBeacon.activity.category
                  : undefined
              }
              size={44}
            />
          }
          onPress={() => {
            setSelected("beacons");
            setQuery("");
            setLimit(10);
          }}
        />
      )}

      <Sheet
        title="In Common"
        visible={!!group}
        onClose={() => setSelected(null)}
      >
        <Field
          label="Search in common"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setLimit(10);
          }}
        />
        {filteredGroups.map((g) => (
          <ProfileSection key={g.id} title={`${g.title} · ${g.items.length}`}>
            {g.items.slice(0, limit).map(row)}
          </ProfileSection>
        ))}
        {!filteredGroups.length && (
          <Txt muted>No matching people or communities.</Txt>
        )}
        {filteredGroups.some((g) => g.items.length > limit) && (
          <Button
            compact
            secondary
            title="Show more"
            onPress={() => setLimit((n) => n + 10)}
          />
        )}
      </Sheet>
    </View>
  );
}
