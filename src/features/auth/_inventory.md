Authentication feature

- Auth.tsx: authentication and account entry UI, mounted by the app shell.
- accountEntry.ts: required-profile input feedback, validated EXPO_PUBLIC_AUTH_ORIGIN email destinations and link input checks; server validation remains authoritative.
- AuthCallback.tsx: user-confirmed /auth/confirm and legacy automatic /auth/callback, session establishment and verified password recovery.
- ResendAuthEmail.tsx: existing-account signup resend/reset requests with canonical destinations, duplicate-submit protection and neutral responses.
- authLink.ts: one-use callback exchange shared across account-provider remounts, cleared on sign-out; never persists tokens separately.
- entryIntent.ts / entryIntentStorage.ts: supported in-session deep-link continuation; only a validated public Beacon path is persisted for up to 24 hours across reload/email callbacks. No tokens or private-route parameters are persisted. Cleared on sign-out and consumption.
- SignInScreen.tsx: explicit sign-in route with required-profile readiness, reconnect handling and return to the selected destination; Keep exploring cancels account entry.
- AccountGate.tsx: shared root/tab screen authorization boundary. Navigators initialize before individual personal screens are gated; inactive entry forms do not mount.
