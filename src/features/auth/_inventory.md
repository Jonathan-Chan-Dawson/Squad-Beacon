Authentication feature

- Auth.tsx: authentication and account entry UI, mounted by the app shell.
- accountEntry.ts: required-profile input feedback, validated EXPO_PUBLIC_AUTH_ORIGIN email destinations and link input checks; server validation remains authoritative.
- AuthCallback.tsx: user-confirmed /auth/confirm and legacy automatic /auth/callback, session establishment and verified password recovery.
- ResendAuthEmail.tsx: existing-account signup resend/reset requests with canonical destinations, duplicate-submit protection and neutral responses.
- authLink.ts: one-use callback exchange shared across account-provider remounts, cleared on sign-out; never persists tokens separately.
- entryIntent.ts: supported in-session deep-link continuation across authentication callbacks; cleared on sign-out and consumption.
