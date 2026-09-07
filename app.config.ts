import type { ConfigContext, ExpoConfig } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Squad Beacon",
  slug: "Squad-Beacon",
  userInterfaceStyle: "light",
  ios: { ...config.ios, bundleIdentifier: "com.squadbeacon.app" },
  android: { ...config.android, package: "com.squadbeacon.app" },
  plugins: [
    ...(config.plugins ?? []),
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Choose your position only when you decide to share it.",
        locationAlwaysAndWhenInUsePermission:
          "Temporarily share your location with selected friends until your timer ends.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    "expo-notifications",
    [
      "expo-image-picker",
      {
        photosPermission: "Choose a photo for your Squad Beacon profile.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  extra: {
    ...config.extra,
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID },
  },
});
