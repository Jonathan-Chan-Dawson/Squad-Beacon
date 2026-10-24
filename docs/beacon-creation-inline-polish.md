# Beacon creation — Pass 1.1 implementation

Implemented locally on October 24, 2026, on top of Pass 1. No new backend API, dependency, snapshot migration, or database migration.

## Delivered

- The creator uses an icon-only accessible Back button. The normal 320px header displays Create Beacon and Save Draft in full; enlarged system text can stack the action row.
- People & Community is a flat, always-visible section after Location. Visibility, selected friend invitations, primary community association, joining, and capacity remain separate decisions. Common audiences/joining use inline radio choices; large social selections retain focused searchable pickers.
- Capacity supports Unlimited, Set/Clear, direct numeric entry and bounded steppers, with existing 2–500, soft/strict, and host/accepted-seat rules. Clearing the numeric text while editing leaves the field available for re-entry.
- Modules and Advanced Options expand inline, one at a time. Values remain owned by the existing editor. Module recommendations require Apply; Checklist and Music settings appear directly beneath enabled controls. There are no meaningless Settings buttons or nested module accordions.
- Advanced includes growing description text, relevant preparation questions, shared artwork/emoji/accent controls, a bounded aspiration summary/search with See More, and independent template saving. Timing, appearance, complex selectors, destination selection, and Preview retain their focused presentations.
- Disclosure buttons expose expanded state on web and native, use a restrained 170ms chevron transition, and honor reduced motion. Switching from Modules to Advanced preserves the clicked header position. Validation opens the correct section, scrolls, and then focuses the failing field.
- The active optional section survives the existing Map return session. This presentation value is omitted from durable snapshots, so saved-draft resumes start with optional sections collapsed.
- Quick Access shows three recent draft pills with independent Resume/Remove targets, horizontal scrolling, and See All. Drafts, templates, and published recent Beacons remain distinct.
- Save Draft prevents repeated taps, updates the existing token, waits for confirmed persistence, checks the current account, and returns to a clean Create hub. Failed saves retain the editor and values. Merely opening or exiting Blank Beacon does not persist it.

## Draft safety and compatibility

The existing version-1 chunk/index storage format is retained. Storage IO is exposed through a small repository adapter so behavior can be tested without native platform mocks. Writes and guarded removal use the same per-account serialized queue; reads used for restoration also wait for queued writes.

Draft summaries validate each snapshot independently and distinguish Draft, Recovery required, and Unavailable. One corrupt snapshot does not hide healthy drafts or erase saved data.

User removal requires a confirmation naming the draft and re-reads its current state inside the queue. Any publication attempt/result, atomic invitation attempt, confirmed creation ID, unverified creation, or pending invitation protects the draft. Recovery pills offer Resume recovery; unreadable drafts stay protected. Account transitions are checked before removal commits. Trusted successful-publication cleanup remains separate from user discard.

Canonical publication UUIDs, frozen payloads, invitation eligibility/limits, role management, template ownership, and Plan/Council operations were reused. Unrelated uncommitted Maps changes and the existing package-script additions were preserved.

## Changed areas

| Area | Implementation |
| --- | --- |
| Editor and hub | `screens/CreateScreen.tsx`, `CreateHome.tsx` |
| Controlled presentation | `CreationPeople.tsx`, `CreationDisclosure.tsx`, `CreationAppearance.tsx`, `CreationControls.tsx`, `CreationInvitees.tsx` |
| Draft hub and safeguards | `CreationSavedDrafts.tsx`, `creationDraftRepository.ts`, platform `creationDraftStorage.ts`, `draftSnapshot.ts`, `socialPlanningSession.ts` |
| Shared opt-in UI | `src/shared/ui.tsx`: creator Back presentation, large-text header sizing, scroll requests, and contextual audience-picker trigger label |
| Verification | Draft repository behavioral tests, updated creation browser suites, test-script entry and inventories |

## Verification

- Targeted domain, draft, invitation, permission, template and local database-contract coverage: **73 passed, 0 failed**.
- Browser coverage contains **26 scenarios**. A full run passed 25 and caught one scroll-anchor assertion; that correction was followed by a focused rerun with **10 passed, 0 failed**, covering all six size/theme combinations, exact scroll anchoring, restart restoration, invalid-field focus, selected people/community/capacity, and Map return. No unresolved regressions remain in the exercised scenarios.
- TypeScript and full application lint passed. The final viewport-measurement correction also passed focused source lint and TypeScript.
- Final combined web/Android/iOS export passed (`--platform all --no-bytecode`); web emitted 49 static routes. These are bundle checks, not physical-device certification.
- Earlier browser checks caught a missing web expanded-state attribute; explicit ARIA attributes now accompany native accessibility state. The scroll test caught web onLayout not reporting sibling-only movement; the correction measures the actual viewport position. These introduced issues were fixed and rechecked.

Rendered coverage includes 320/375/430px in light/dark themes, reduced motion, long title/description text, inline choices, expanded modules/Advanced, draft pills and confirmation, protected/corrupt drafts, restart restoration, Preview, and a larger layout with enlarged browser text. Browser tests also exercise keyboard Tab/focus, Map cancellation, template save/edit, Plan/Routine/Council, and recovery/storage failures.

## Rendered evidence

| State | Capture |
| --- | --- |
| Main editor, 320px light | [Editor](../.expo/creation-inline/editor-320-light.png) |
| Main editor, 375px dark | [Editor](../.expo/creation-inline/editor-375-dark.png) |
| Main editor, 430px light | [Editor](../.expo/creation-inline/editor-430-light.png) |
| Inline People & Community | [375px dark](../.expo/creation-inline/people-375-dark.png) |
| Expanded Modules | [375px dark](../.expo/creation-inline/modules-375-dark.png) |
| Expanded Advanced | [375px dark](../.expo/creation-inline/advanced-375-dark.png) |
| Publishing review | [375px dark](../.expo/creation-inline/review-375-dark.png) |
| Multiple drafts | [Pills](../.expo/creation-inline/draft-pills.png) · [See All](../.expo/creation-inline/all-drafts.png) |
| Selected people, community and capacity validation | [Inline state](../.expo/creation-inline/people-selected.png) |
| Guarded deletion | [Confirmation](../.expo/creation-inline/delete-confirmation.png) · [Protected drafts](../.expo/creation-inline/protected-drafts.png) |

## Verification boundaries

Browser flows use the demo backend; database tests execute repository migrations locally in PGlite. Native exports validate JavaScript bundling, not signed application packages. Physical iOS/Android devices, native keyboards, GPS, hosted Supabase, push delivery, and real screen-reader sessions were not exercised. Web roles, labels, expanded states, keyboard focus, and layout were checked in the rendered browser.

Drafts remain device-local without cloud sync. Existing account, storage-size and 100-draft limits remain. Snapshot corruption and uncertain publication are preserved for retry/recovery; they do not authorize deletion or a new creation attempt. No deployment was performed.
