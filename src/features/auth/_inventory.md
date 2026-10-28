Authentication feature

- Auth.tsx: authentication and account entry UI, mounted by the app shell.
- accountEntry.ts: required-profile input feedback and platform callback URLs; server validation remains authoritative.
- AuthCallback.tsx: verification/session establishment and verified password recovery, exported by app/auth/callback.tsx.
- authLink.ts: one-use callback exchange shared across account-provider remounts, cleared on sign-out; never persists tokens separately.
- entryIntent.ts: supported in-session deep-link continuation across authentication callbacks; cleared on sign-out and consumption.
