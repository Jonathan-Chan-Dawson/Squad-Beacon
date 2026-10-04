Maps feature

- screens/MapScreen.tsx: full-map tab and map preferences.
- MapPanel.tsx, MapTooltip.tsx: selected beacon and friend/map overlays.
- components/BeaconMap.tsx, BeaconMap.native.tsx, BeaconMap.web.tsx: platform variants; keep these siblings together.
- cluster.ts: pure Web Mercator/screen-pixel grouping shared by native and web markers.
