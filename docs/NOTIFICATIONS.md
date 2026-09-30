# Notification handling

Client script: `src/notifications.native.ts`, mounted by `app/_layout.tsx` after sign-in and profile loading. Handles foreground delivery, taps while running, and the last tap on cold start. UUID activity IDs open their beacon in the map panel; other notices open the inbox. Responses are deduplicated and cleared after handling. Web uses the no-op `src/notifications.ts`.

Token permission/registration: `src/device.native.ts` (`enablePush`), called explicitly from Profile. No permission prompt on launch.

Server delivery script: `supabase/functions/push-worker/index.ts`. Scheduled with `supabase/schedules.sql`. It sends the activity ID from the notice, respects existing audience checks and quiet hours, retries delivery, and removes invalid tokens. Apply `supabase/migrations/202609290001_simple_beacons.sql` before deploying the updated worker. Follow README environment setup for EAS, Supabase and WORKER_SECRET. Never put the worker secret in the app.

Device check: enable notifications on a physical development build; invite a second account; tap once while running and once after closing the app. Confirm the correct beacon opens once. Try a revoked invitation: protected details must remain unavailable. Check quiet hours and denied permissions.

Contacts: `src/contacts.native.ts` uses the Expo 57 Contact picker and opens an SMS draft for the chosen number. It never uploads the address book or sends automatically. Cancel and denied access leave username/link invitations available. Rebuild the native app after installing expo-contacts; app.json includes its permission plugin. This is an invitation flow, not phone-number account matching.
