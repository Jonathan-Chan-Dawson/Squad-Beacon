Widgets feature

- WidgetStudioScreen.tsx: in-app widget setup.
- WidgetRuntime.tsx, CirclePulseWidget.tsx, FriendsNowWidget.tsx, NextBeaconWidget.tsx, SquadBeaconsWidget.tsx, WidgetAdviceTip.tsx: widget views/runtime.
- derive.ts, adviceEligibility.ts, types.ts: widget data derivation, eligibility, and contracts.
- preferences.tsx, preferencesStorage.ts: widget preferences.
- sync.ts, sync.ios.ts: platform sync entry points.
- QuickCreateWidget.tsx: one configurable Beacon/Status/Plan launcher, reusing existing app routes.

Widgets require an iOS native development/production build. Android, web, and Expo Go cannot host these extensions. Set your own iOS bundle identifier before building; regenerate the native app after changing widget plugin configuration. Status widgets use authorized, short-lived snapshots and never contain coordinates.
