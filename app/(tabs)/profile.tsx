import ProfileScreen from "@/src/features/profile/screens/ProfileScreen";
import GuestProfileScreen from "@/src/features/profile/screens/GuestProfileScreen";
import { useBeacon } from "@/src/shared/store";

export default function ProfileRoute() {
  const { userId } = useBeacon();
  return userId ? <ProfileScreen /> : <GuestProfileScreen />;
}
