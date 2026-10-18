# CARTO basemaps

The existing Leaflet web renderer uses CARTO raster styles: Dark Matter in dark mode and Positron in light mode. Android keeps Google Maps and iOS keeps its existing Apple Maps provider; native rendering is unchanged. Web has no configured satellite provider; its Satellite option explicitly reports that it is unavailable.

## Configuration

Set `EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY` in the untracked local `.env` and in the EAS development, preview, and production environments selected by `eas.json`. Use only a credential issued specifically by the CARTO Basemaps dashboard. This value is public: Expo includes it in app configuration. Never use a workspace secret or service-account credential here. Do not commit key values or print resolved Expo configuration.

The pre-existing app-config change correctly forwards this variable through Expo extra. Only web consumes that CARTO configuration. No production environment changes were made.

## Failure behavior

Web keeps markers/camera/controls and attribution, retries a failed tile batch once, then offers an explicit Retry action.

OpenStreetMap and CARTO attribution links remain visible. Tile URLs and keys are never included in application error messages.

## Verification

Live authenticated sample tile requests returned HTTP 200 with image/png for Dark Matter, Positron, and Voyager. Focused map tests cover URL encoding, clustering, and contextual Plan/Vote/Draw privacy. See the phase report for final static, browser, export, and native-runtime results. No production deployment or credential modification is part of this change.

Phase 1: TypeScript and changed-source lint passed; 27 retained map tests passed (the native tile helper test was removed with the web-only correction). Web export and Android/Hermes export passed. Both browser scenarios passed, including tile failure/retry and screenshots at 320/375/430/1024px. Style screenshots were inspected; Positron was chosen for its restrained light palette. Android device bridge startup was unavailable, so no native runtime rendering is claimed. Native CARTO code was removed following the web-only clarification.
