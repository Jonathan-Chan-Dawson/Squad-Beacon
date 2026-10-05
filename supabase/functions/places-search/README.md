# Worldwide place search

`index.ts` proxies explicit Google Places Text Search (New) requests for signed-in accounts. It sends no GPS or social data and stores no queries/results. Migration `202610040005_places_search_budget.sql` limits requests to 30/account/hour and 1,000/app/hour. Configure Google Cloud quotas and billing alerts too.

## Operator setup

1. Enable **Places API (New)** with billing. The Android Maps SDK key alone is insufficient. Restrict a separate server key to Places API (New), not an Android package/browser referrer.
2. Apply the budget migration. Set server-only `GOOGLE_PLACES_API_KEY` through the Supabase secret editor; never use `EXPO_PUBLIC_`, commit the key, or put it in shell history.
3. Set `WEB_ORIGINS` to exact web origins. Run `supabase functions deploy places-search`. The function validates Supabase Auth itself, like existing Edge functions.
4. Ensure public Terms/Privacy pages cover Google Maps Platform usage and the actual operator setup.

Google requires Places results displayed on a map to use Google Maps. Web's OpenStreetMap and iOS's Apple Maps cannot silently consume these coordinates as Google-derived map results. Until the provider choice is completed, use a separately attributed result list with Google Maps links on those platforms. Keep returned third-party attribution visible. Results stay in memory, never offline caches or app storage; place IDs are the general storage exception.

References: [Places policy](https://developers.google.com/maps/documentation/places/web-service/policies), [Text Search fields and billing](https://developers.google.com/maps/documentation/places/web-service/text-search).

No key was copied, paid API called, or hosted function deployed by this implementation.
