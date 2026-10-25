# Centered dialogs

`src/shared/Dialogs.tsx` exports:

- `ConfirmDialog`: `title`, `visible`, `onClose`, `onConfirm`, optional `message`, context children, `confirmLabel`, `cancelLabel`, `destructive`, and `onDismiss`. It awaits `onConfirm`, blocks repeated submissions/dismissal while pending, retains thrown errors, and closes after success. Existing workflows that navigate or close themselves use `closeOnConfirm={false}` so cancellation does not run after successful confirmation.
- `QuickChoiceDialog`: the same visibility/dismissal props, optional description, and `items` containing `label`, `onPress`, optional icon/description/disabled/destructive. Selection runs once after dismissal; ordinary choices do not request another confirmation.
- `useConfirmation`: returns `requestConfirmation` and `confirmationDialog` for safeguards within existing editors and management lists.

The foundation uses the existing overlay registry and scroll locks, now shared through `overlays.tsx`. Sheet and dialogs share keyboard containment through `overlayFocus.ts`. Web uses a portal rather than React Native Web's independent modal/focus stack. Native uses the existing React Native Modal presentation pattern, with no sheet slide animation. The card is limited to 400px, respects safe areas, and keeps actions outside scrolling content. Confirmations initially focus the safe action.

## Migrated interactions

| Presentation | Interactions |
| --- | --- |
| Quick choices | Do with Others; Activity Note actions; conversation/community shortcuts; Routine actions; Activity actions; Manage Beacon; Friendship; Safety & Privacy |
| Confirmations | End Routine; friendship removal/block; list deletion; report review; attendance denial/removal/reinvitation; Squad membership/access; Organization/Network leave/discard; Beacon participation; Plan cancellation; Council replacement; saved-draft deletion; profile discard/retake; unblock; Featured activity replacement |
| Added safeguards | Beacon note and memory deletion; template deletion; Organization/Network member removal and role changes; Network banning/unbanning and invitation cancellation |

Canonical actions, authorization boundaries, payloads, draft state, and success navigation remain with their existing workflows. No database changes or future Planning features were added.

## Intentional exclusions

Anchored context menus remain anchored. Searchable audiences, member directories, report forms, creation/editing fields, date/time/location selection, Sonar, scheduling, and long management lists retain their existing space. Fast responses, voting, toggles, and filters remain immediate. Ending an Activity Note remains immediate because it retains private history. Existing RSVP choices and the single-action Plan panel remain in their existing presentation; consequential follow-up confirmations use the shared dialog.

## Verification

- Baseline TypeScript and full lint passed before edits.
- Final TypeScript, affected-file lint, and the production web build passed. The final full lint run found an unrelated unused `overflow` variable in `src/features/maps/webConstellation.ts:35`; that concurrent Map work was preserved.
- 68 relevant domain/regression tests passed.
- The final focused browser run passed all 14 checks, including preserved desktop anchoring and profile menu restoration.
- Browser checks exercise long content, safe cancellation, focus trapping/restoration, pending dismissal protection, duplicate submission, failure/retry, chooser handoff, nested list drafts, profile drafts, community settings, and real Ping/Vote creation from Activity Notes.
- Rendered community choices were checked at 320, 390, 430, and 1280px in light/dark themes. Controlled dialog tests cover reduced motion and normal animation.
- Two older Activity Note tests referenced an obsolete field label and modal Planning editor. Their selectors now match the existing full-screen composer; both creation flows pass.
- Native runtime validation remains outstanding: the Android device bridge could not start in this environment. iOS/Android centering, Android Back, native accessibility text scaling, and VoiceOver/TalkBack require a device check. Native behavior is implemented but not claimed as visually verified.

Unrelated working-tree changes, including Map work, were left untouched.
