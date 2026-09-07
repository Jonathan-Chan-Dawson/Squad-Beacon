export async function startDeviceLocation(_session: {
  id: string;
  expires_at: string;
}) {
  throw new Error(
    "Live location requires the iOS or Android development build.",
  );
}
export async function stopDeviceLocation() {}
export async function enablePush() {
  throw new Error(
    "Push notifications require the mobile app on a physical device.",
  );
}
export async function clearPush() {}
