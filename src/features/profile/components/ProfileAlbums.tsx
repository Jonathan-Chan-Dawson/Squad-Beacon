import React, { useEffect, useId, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Images, Play } from "lucide-react-native";
import { router } from "expo-router";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { Button, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { Skeleton, useReducedMotion } from "@/src/shared/design-system";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { signedBeaconMediaUrl } from "@/src/features/beacons/beaconMedia";
import type { ProfileContentRow } from "../profileContent";
import { useProfileContent } from "../useProfileContent";

export function openProfileBeacon(id: string, memories = false) {
  router.push({
    pathname: "/activity/[id]",
    params: { id, ...(memories ? { tab: "tools", tool: "experiences" } : {}) },
  });
}
function AlbumTile({
  album,
  accessKey,
  large = false,
  enabled = true,
}: {
  album: ProfileContentRow;
  accessKey: string;
  large?: boolean;
  enabled?: boolean;
}) {
  const { semanticColors: colors, tokens } = useTheme();
  const reduced = useReducedMotion();
  const shadeId = "album-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [signed, setSigned] = useState<{
    key: string;
    url: string;
    expires: number;
  }>();
  const [failed, setFailed] = useState<string | null>(null);
  const key = JSON.stringify([accessKey, album.id, album.coverPath]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    async function sign() {
      if (!album.coverPath) return;
      try {
        const url = await signedBeaconMediaUrl(album.coverPath);
        if (active && url) {
          setSigned({ key, url, expires: Date.now() + 55000 });
          clearTimeout(expiry);
          expiry = setTimeout(() => {
            if (active) setSigned(undefined);
          }, 55000);
        }
      } catch {
        /* Category artwork remains available if storage rejects a read. */
      }
    }
    void sign();
    const renewal = setInterval(() => void sign(), 45000);
    return () => {
      active = false;
      clearInterval(renewal);
      clearTimeout(expiry);
      setSigned((previous) => (previous?.key === key ? undefined : previous));
    };
  }, [key, album.coverPath, enabled]);
  const url =
    enabled && signed?.key === key && failed !== signed.url
      ? signed.url
      : undefined;
  const date = new Date(album.startsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const count = [
    album.photoCount
      ? `${album.photoCount} ${album.photoCount === 1 ? "photo" : "photos"}`
      : "",
    album.videoCount
      ? `${album.videoCount} ${album.videoCount === 1 ? "video" : "videos"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <MotionPressable
      onPress={() => openProfileBeacon(album.id, true)}
      accessibilityRole="button"
      accessibilityLabel={`${album.title}, ${date}, ${count}. Open memories`}
      style={{
        flex: 1,
        minHeight: large ? 246 : 119,
        borderRadius: 17,
        overflow: "hidden",
        backgroundColor: colors.surfaceRaised,
      }}
    >
      {url ? (
        <Image
          key={url}
          source={{ uri: url }}
          cachePolicy="none"
          transition={reduced ? 0 : 180}
          contentFit="cover"
          onError={() => setFailed(url)}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      ) : (
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.categories[album.category].tint,
          }}
        >
          <ActivityBadge category={album.category} size={large ? 68 : 48} />
        </View>
      )}
      <Svg
        pointerEvents="none"
        style={{ position: "absolute", inset: 0 }}
        width="100%"
        height="100%"
      >
        <Defs>
          <LinearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#07101E" stopOpacity={0.03} />
            <Stop
              offset={large ? "0.35" : "0.12"}
              stopColor="#07101E"
              stopOpacity={large ? 0.12 : 0.35}
            />
            <Stop
              offset={large ? "0.73" : "0.28"}
              stopColor="#07101E"
              stopOpacity={large ? 0.75 : 0.82}
            />
            <Stop offset="1" stopColor="#07101E" stopOpacity={0.96} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${shadeId})`} />
      </Svg>
      {!!album.videoCount && (
        <View
          style={{
            position: "absolute",
            right: 10,
            top: 10,
            padding: 5,
            borderRadius: 10,
            backgroundColor: "#07101EB3",
          }}
        >
          <Play size={13} color="#FFFFFF" />
        </View>
      )}
      <View style={{ marginTop: "auto", padding: large ? 13 : 10, gap: 3 }}>
        <Text
          numberOfLines={2}
          style={{
            color: "#FFFFFF",
            fontWeight: "700",
            fontSize: large ? 17 : 14,
            lineHeight: large ? 22 : 19,
          }}
        >
          {album.title}
        </Text>
        <Text style={{ color: "#FFFFFF", fontSize: 11, lineHeight: 16 }}>
          {date} · {count}
        </Text>
      </View>
    </MotionPressable>
  );
}
export function ProfileAlbums({
  personId,
  own,
  active = true,
}: {
  personId: string;
  own: boolean;
  active?: boolean;
}) {
  const { styles, semanticColors: colors } = useTheme();
  const [all, setAll] = useState(false);
  const albums = useProfileContent({ personId, filter: "albums", pageSize: 6 });
  const rows = albums.page?.rows ?? [];
  if (!own && !albums.loading && !albums.error && !rows.length) return null;
  return (
    <View style={{ gap: 12 }} testID="profile-memories">
      <View style={styles.between}>
        <View style={[styles.row, { gap: 8 }]}>
          <Images size={18} color={colors.textPrimary} />
          <Text style={styles.h2}>Beacon Memories</Text>
        </View>
        {!!rows.length && (
          <Button
            title="See all memories"
            secondary
            compact
            onPress={() => setAll(true)}
          />
        )}
      </View>
      {albums.loading ? (
        <Skeleton height={246} borderRadius={17} />
      ) : rows.length ? (
        <View style={{ flexDirection: "row", gap: 9 }}>
          <AlbumTile
            album={rows[0]}
            accessKey={albums.accessKey}
            large
            enabled={active}
          />
          {rows.length > 1 && (
            <View style={{ flex: 0.9, gap: 9 }}>
              <AlbumTile
                album={rows[1]}
                accessKey={albums.accessKey}
                large={rows.length === 2}
                enabled={active}
              />
              {rows[2] && (
                <AlbumTile
                  album={rows[2]}
                  accessKey={albums.accessKey}
                  enabled={active}
                />
              )}
            </View>
          )}
        </View>
      ) : !albums.error ? (
        <View style={{ paddingVertical: 14, gap: 6 }}>
          <Txt>Good days belong here.</Txt>
          <Txt muted>
            Photos and videos you add to completed Beacons become your albums.
          </Txt>
          <Button
            title="Explore your Beacons"
            secondary
            compact
            onPress={() => router.push("/your-activity")}
          />
        </View>
      ) : null}
      {albums.error && (
        <>
          <Txt muted>{albums.error}</Txt>
          <Button
            title="Retry memories"
            secondary
            compact
            onPress={albums.retry}
          />
        </>
      )}
      <Sheet
        title="Beacon Memories"
        visible={all}
        onClose={() => setAll(false)}
      >
        {all &&
          rows.map((row) => (
            <View key={row.id} style={{ minHeight: 210 }}>
              <AlbumTile album={row} accessKey={albums.accessKey} large />
            </View>
          ))}
        {albums.page?.nextCursor && (
          <Button
            title={albums.loadingMore ? "Loading…" : "More memories"}
            secondary
            disabled={albums.loadingMore}
            onPress={() => void albums.more()}
          />
        )}
      </Sheet>
    </View>
  );
}
