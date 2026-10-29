import type { ConfigContext, ExpoConfig } from 'expo/config';
// The same validated domain/credential inputs drive the server association files.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { linkConfiguration } = require('./server/guest/associations.cjs');

export default ({ config }: ConfigContext): ExpoConfig => {
  const links = linkConfiguration(process.env);
  return ({
  ...config,
  name: 'Squad Beacon',
  slug: 'Squad-Beacon',
  userInterfaceStyle: 'automatic',
  ios: { ...config.ios, bundleIdentifier: 'com.squadbeacon.app',...(links.apple ? {associatedDomains:[...new Set([...(config.ios?.associatedDomains ?? []),`applinks:${links.host}`])]} : {}) },
  android: { ...config.android, package: 'com.squadbeacon.app',...(links.android ? {intentFilters:[...(config.android?.intentFilters ?? []),{action:'VIEW',autoVerify:true,category:['BROWSABLE','DEFAULT'],data:[{scheme:'https',host:links.host,pathPrefix:'/g/'}]}]} : {}) },
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
          config.android?.config?.googleMaps?.apiKey,
      },
    ],
    ['expo-web-browser'],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Choose your position only when you decide to share it.',
        locationAlwaysAndWhenInUsePermission:
          'Temporarily share your location with selected friends until your timer ends.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    'expo-notifications',
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a photo for your Squad Beacon profile.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    'expo-image',
  ],
  extra: {
    ...config.extra,
    cartoBasemapsApiKey:
      process.env.EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY?.trim() || undefined,
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID },
  },
});
};
