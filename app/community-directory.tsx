import MessagingHubScreen from "@/src/features/people/screens/MessagingHubScreen";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useBeacon } from "@/src/shared/store";
import { recordRewardDiscovery } from "@/src/features/beacons/rewardLooks";

export default function CommunityDirectory() {
  const { rewardDiscovery } = useLocalSearchParams<{ rewardDiscovery?: string }>();
  const { userId, demo, loading } = useBeacon();
  useEffect(() => {
    if (rewardDiscovery && userId && !demo && !loading) void recordRewardDiscovery(userId, "people").catch(() => {});
  }, [demo, loading, rewardDiscovery, userId]);
  return <MessagingHubScreen directory />;
}
