import React, { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { ImageIcon, Play } from "lucide-react-native";
import { router, type Href } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { canReadBeaconModuleEntry } from "@/src/features/beacons/beaconModules";
import { canViewProfile } from "@/src/features/profile/privacy";
import { usePastMemoryThumbnails } from "@/src/features/beacons/usePastMemoryThumbnails";
import { selectPastMemoryPhotos } from "@/src/features/beacons/pastMemoryPrivacy";
import { Button, Txt, useTheme } from "@/src/shared/ui";

export function ProfileMemories() {
  const { data, userId } = useBeacon();
  const { styles, semanticColors: colors } = useTheme();
  const ownedData = useMemo(() => ({ ...data, beacon_memories: data.beacon_memories.filter((memory) => memory.author_id === userId) }), [data, userId]);
  const photos = selectPastMemoryPhotos(ownedData, data.activities, userId);
  const urls = usePastMemoryThumbnails(ownedData, data.activities, userId, true);
  const memories = userId && data.viewer_id === userId ? data.beacon_memories.filter((memory) => memory.author_id === userId)
    .flatMap((memory) => {
      const activity = data.activities.find((item) => item.id === memory.activity_id);
      const current = data.beacon_memories.some((entry) => entry.id === memory.id && entry.activity_id === activity?.id &&
        entry.author_id === memory.author_id && entry.object_path === memory.object_path);
      return activity && current && canViewProfile(data, memory.author_id, userId) && canReadBeaconModuleEntry(data, activity, memory.author_id, userId) &&
        (memory.media_type === "video" || photos.some((photo) => photo.activityId === activity.id && photo.path === memory.object_path))
        ? [{ memory, activity }] : [];
    }).sort((left, right) => right.memory.created_at.localeCompare(left.memory.created_at)).slice(0, 12) : [];
  return <View style={[styles.card, { gap: 12 }]} testID="profile-memories">
    <Text style={styles.h2}>Beacon Memories</Text>
    <Txt muted>Photos and videos stay connected to their Beacon and its audience.</Txt>
    {!memories.length && <Txt muted>Your readable Beacon Memories will appear here.</Txt>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      {memories.map(({ memory, activity }) => <Pressable key={memory.id} accessibilityRole="button"
        accessibilityLabel={`Open ${memory.media_type === "video" ? "video" : "photo"} memory from ${activity.title}`}
        onPress={() => router.push(`/activity/${activity.id}` as Href)} style={{ width: 144, minHeight: 176, gap: 8 }}>
        <View style={{ width: 144, height: 116, borderRadius: 16, backgroundColor: colors.surfaceRaised, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          {memory.media_type === "image" && urls[activity.id]
            ? <Image key={urls[activity.id]} source={{ uri: urls[activity.id] }} accessibilityLabel={memory.caption || `Photo from ${activity.title}`}
                style={{ width: 144, height: 116 }} contentFit="cover" cachePolicy="none" />
            : memory.media_type === "video" ? <Play size={28} color={colors.textPrimary} /> : <ImageIcon size={28} color={colors.textSecondary} />}
        </View>
        <Text numberOfLines={2} style={styles.body}>{memory.caption || activity.title}</Text>
        {memory.media_type === "video" && <Txt muted>Video{memory.duration_seconds ? ` · ${memory.duration_seconds}s` : ""}</Txt>}
      </Pressable>)}
    </ScrollView>
    <Button title="See past Beacons" secondary onPress={() => router.push({ pathname: "/(tabs)/activities", params: { filter: "Past" } })} />
  </View>;
}
