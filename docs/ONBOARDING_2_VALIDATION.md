# SB Onboarding 2 — Phase 4B

## Behavior

Before: a required profile with a pending survey was blocked by both root navigation and Phase 4A progress readiness. Invitations asked users to reopen the link after setup; verification and password recovery shared one ambiguous callback screen.

After: authentication and required profile creation lead directly into the normal app or incoming invitation. `accountReadiness` is the shared root/runtime contract: loaded, viewer-matched, error-free live/demo snapshot and an owner profile. Pending, skipped, and completed survey statuses behave identically. Optional progress reads and claims retain Phase 4A fallback, first-session, dismissal, tip, and confirmed-success behavior.

Personalization opens only from Profile or the existing editor. Close/Not now performs no write. Successful saves merge changed fields into the current owner snapshot and mark completion. Catalog values, aspiration IDs and unrelated preferences remain intact. The existing editor's discard protection is retained. No new schema, migration, provider, or tracking system was introduced.

Secondary account controls and survey navigation use the existing compact button treatment. Survey pills use a slimmer visible surface inside a 44px touch target, with the existing horizontal padding. Primary sign-in and required-profile submission retain their comfortable emphasis. Shared app-wide sizing tokens are unchanged.

## Implementation map

- Shared readiness and root/runtime consumers; progress requests reject stale account, epoch, readiness, and scenario results.
- Existing account store/transport: identity and epoch assertions around onboarding/profile requests, with required-profile confirmation through an authorized refresh. Creating a first profile never requires a pre-existing profile.
- Auth feature: compact entry forms, input validation, duplicate-submit locks, verified callbacks and recovery, supported in-memory destination continuation. A single in-memory callback exchange survives account-provider remounts; sign-out clears it.
- Profile feature: compact entry below the existing profile actions, user-opened survey modal, non-persisting cancellation, owner/session-isolated editor drafts, and scroll reset between steps. Legacy personality prose is preserved without generating oversized badges or overwriting newer tags.
- Tests: `npm run test:onboarding` and `npm run test:onboarding:browser`; browser transport is intercepted and never establishes hosted acceptance.

| Area                         | Files/components changed                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Readiness and isolation      | `src/shared/accountReadiness.ts`, `store.tsx`, `supabase.ts`; root navigation and `onboarding/runtime.tsx`                       |
| Account entry                | `Auth.tsx`, `accountEntry.ts`, `AuthCallback.tsx`, `authLink.ts`, `entryIntent.ts`; existing auth callback and invitation routes |
| Personalization              | `ProfileScreen`, `ProfileEditScreen`, `ProfileSurvey`, `profileEditorDraft`                                                      |
| Verification/navigation docs | Focused account/profile/onboarding tests, browser fixture and config, package scripts, README and canonical inventories          |

Public legal/auth/invitation routes remain public. The invitation preview offers sign-in at the same URL; its entry parameter survives the authentication-provider remount and required setup. Viewing an invitation never sends a request. A positively confirmed account without a profile can sign out without calling a profile-only location action; existing-account location cleanup is retained.

## Hosted callback configuration

The hosted Supabase project's URL allow list must include:

- `squadbeacon://auth/callback`
- `squadbeacon://auth/callback?type=recovery`
- The exact deployed web origin followed by `/auth/callback`, and `/auth/callback?type=recovery`. Include localhost callback variants only for environments used for development.

Keep the production Site URL correct. Email templates must honor the configured redirect. Existing token-hash templates must send `token_hash` and the appropriate verified `type=signup` or `type=recovery` to the callback. A URL label alone never authorizes password replacement: the code exchange must emit `PASSWORD_RECOVERY`, or a recovery token hash must verify successfully.

PKCE requires the initiating verifier. Browser storage is currently sessionStorage, so opening a code link in a different tab/device can fail safely. Token-hash email templates support the existing cross-device verification path. Invalid, expired, incomplete and unsuccessful links offer recovery; verification without a resulting authenticated session offers sign-in. A successful link never grants access without the normal snapshot/profile checks.

Sources: [Supabase native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), and [code exchange](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession).

No hosted redirect settings, email templates, migrations or accounts were modified by this pass. Hosted/native email delivery, redirect handoff, and keyboard behavior require acceptance in those environments. Incoming intent is retained in memory within the current app instance, not across a restart or a new browser tab.

## Validation results

Final checks on October 27, 2026:

| Check                                                                | Result                                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                  | Passed                                                                                                                       |
| `npm run lint`                                                       | Passed, zero warnings                                                                                                        |
| Account/profile/onboarding, aspirations, privacy and snapshot suites | 35 passed, including ordered-migration PGlite coverage                                                                       |
| Full onboarding browser suite                                        | 30 passed; includes all seven Phase 4A journeys                                                                              |
| Final screenshot/selection check                                     | Four phone cases passed again after waiting for scroll completion; interest selection, deselection and 44px targets verified |
| Development and production web exports                               | Passed, 50 static routes each                                                                                                |
| Production bundle inspection                                         | Account guards and personalization present; developer-lab controls excluded                                                  |
| Changed-file whitespace check                                        | Passed                                                                                                                       |

The focused `npm run test:onboarding` command covers 23 of the 35 local tests. The additional suites are `aspirations.test.ts`, `profilePrivacy.test.ts`, and `snapshotNormalization.test.ts`.

Browser acceptance explicitly covers a signed-out new-account fixture, required setup, immediate normal entry with survey still pending and no blocking dialog, all three survey statuses initializing progress, failed/loading reads, safe progress fallback, sign-out before profile creation, delayed progress rejection after switching accounts, invitation preview/continuation with explicit friend-request action, invalid links, verification without a session, one-use PKCE/recovery handling, optional cancellation without writes, partial saves, and editor draft protection.

The database test creates a genuinely new verified-user row in local PGlite and calls the existing `onboard` action. It verifies the resulting profile remains `pending` and receives existing Phase 4A eligibility evidence. This is local database acceptance, not a hosted Supabase signup or email-delivery test.

The earlier Phase 4A first-success journey was updated to dismiss the concurrently introduced creation-success choice before interacting with its receipt. Its confirmed-action and non-replay assertions remain intact. Intermediate runs exposed and fixed callback remount/re-exchange, public-invitation hydration, and oversized legacy-badge issues. Development exports retain existing framework deprecation/import-cycle warnings; no final source-check or browser failures remain in the checks above. Unrelated concurrent work was preserved.

## Screenshots

36 screenshots cover nine screens at 320px and 390px in light and dark themes. The 320px cases also use reduced motion. Reviewed required-field layout, profile-name wrapping, compact controls, clear selected states, scroll return, and persistent close access. Browser screenshots do not establish native software-keyboard acceptance.

| Screen             | Light, 320px                                                                  | Dark, 390px                                                                  |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Sign in            | [Preview](screenshots/onboarding2/onboarding2-signin-light-320.png)           | [Preview](screenshots/onboarding2/onboarding2-signin-dark-390.png)           |
| Create account     | [Preview](screenshots/onboarding2/onboarding2-signup-light-320.png)           | [Preview](screenshots/onboarding2/onboarding2-signup-dark-390.png)           |
| Required profile   | [Preview](screenshots/onboarding2/onboarding2-required-profile-light-320.png) | [Preview](screenshots/onboarding2/onboarding2-required-profile-dark-390.png) |
| First normal entry | [Preview](screenshots/onboarding2/onboarding2-first-entry-light-320.png)      | [Preview](screenshots/onboarding2/onboarding2-first-entry-dark-390.png)      |
| Profile entry      | [Preview](screenshots/onboarding2/onboarding2-profile-entry-light-320.png)    | [Preview](screenshots/onboarding2/onboarding2-profile-entry-dark-390.png)    |
| About you          | [Preview](screenshots/onboarding2/onboarding2-about-you-light-320.png)        | [Preview](screenshots/onboarding2/onboarding2-about-you-dark-390.png)        |
| Interests          | [Preview](screenshots/onboarding2/onboarding2-interests-light-320.png)        | [Preview](screenshots/onboarding2/onboarding2-interests-dark-390.png)        |
| Aspirations        | [Preview](screenshots/onboarding2/onboarding2-aspirations-light-320.png)      | [Preview](screenshots/onboarding2/onboarding2-aspirations-dark-390.png)      |
| Completion         | [Preview](screenshots/onboarding2/onboarding2-completed-light-320.png)        | [Preview](screenshots/onboarding2/onboarding2-completed-dark-390.png)        |

## Phase 4C follow-up

Complete real email verification/recovery and invitation acceptance on hosted Supabase and native devices. Evaluate cross-tab or cross-restart destination persistence separately if needed; it is outside this pass.
