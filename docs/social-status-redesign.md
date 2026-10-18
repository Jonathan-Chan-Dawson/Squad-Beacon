# Beacons social status redesign

Implemented order: Your Activity → Your Status → Friends Right Now → existing discovery. Four friends appear initially, expanding inline to at most 12; the full searchable selector uses a virtualized list. Availability, notes, approved Beacon participation, and authorized Pings remain independent.

## Compact homepage revision

The homepage now uses regular/medium typography, flatter navy surfaces, and 30px button faces inside 44px tap targets. Friend rows combine name and status into one content target, keep Profile on the avatar, and show one primary note/activity line. Typical rows measure 64–80px; four friends remain visible initially. Beacon participation and Ping indicators sit beside names, and authorized Beacon decoration/category/count metadata accompanies the activity preview.

Your Activity uses a 72–88px preview with its existing detail destination, replacing the large Open Beacon button and tool footer. Discovery cards on the homepage use smaller controls and tighter metadata. Browse/Map card layouts retain their existing presentations. Beacon icons resolve to an existing custom decoration, then the category icon, then a default Beacon glyph.

The selected-count action is one compact row with an accessible clear control. Status setup, scheduling, privacy, invitees, draft retention, and publication behavior remain unchanged.

Status setup confirms audience and duration on first use, then remembers choices per account on this device through existing device-default storage. Presets are 30 minutes, 1, 2, 4, and 6 hours; Custom uses the existing date/time inputs for intervals. Current status audiences survive quick updates. Explicit audience changes through quick setup do not carry an old meeting location into the new audience. No Sonar/location session is started.

Planning selections and unfinished creation fields survive navigation in account-scoped memory. Editing invitees preserves template/form state; publication uses existing atomic creation/invitation validation and retry handling. Successful publication clears the completed session. Drafts are session-only and do not survive a full application restart or page reload. Status preferences do persist.

Future statuses are manageable through the timing dropdown. Their edits reuse the existing save and owner-only cancellation actions. If replacement saves but cancellation fails, the UI reports the partial result and leaves the previous scheduled status accessible for explicit cleanup. No migration or new endpoint is introduced.

## Verification

- Compact revision: TypeScript and lint on changed source files passed with zero warnings.
- 58 focused unit tests passed across friend/status selection, icon fallback, authorized attendance counts, Beacon controls, privacy, creation handoff, and invitation retry behavior.
- 13 Playwright scenarios passed: layout and selection at 320/375/430px; first-use and one-tap status sharing; clearing active/scheduled notes; template selection with two invitees; editing, resuming, and publishing the draft; full-network search; profile shortcut placement; Browse/Your Activity navigation at 320/390px; sheet reopening; and legacy route destinations.
- Screenshots inspected at the three phone widths for the activity preview, smaller controls, four initial friends, discovery cards, empty status, and the full friend selector. The layout cases also use a temporary rendered-text fixture for unusually long names/notes, restored before interaction tests; account records are unchanged.
- The latest web export succeeded. Atomic database tests and Android JavaScript/Hermes export passed during the underlying status implementation; they were not rerun for the compact visual revision. Native device interactions, native keyboard/safe-area behavior, iOS compilation, and production-server deployment were not exercised.

## Supported content

Status details retain full text, supported linked profile goals, expiration, existing emoji reactions, and authorized Beacon/Ping destinations. Music, pictures/GIFs, and polls are not supported by the current status model and are omitted. Existing advanced status editing remains available. Five-tab navigation, activity business logic, discovery behavior, Map, Saved & Tools, and unrelated profile/chat/Squad layouts are preserved.


## Beacon discovery overhaul — October 17, 2026

The homepage now orders Your Status, Your Activity, Friends Right Now, and Explore Beacons. Activity is one personal timeline container with up to two slim rows, with a My Activity link to the complete timeline. Explore has one Explore all link and one Map shortcut, capped at two current and two upcoming previews.

Homepage and Browse share editorial discovery rows: category/decoration artwork on the left, title and timing/location context on the right, authorized attendance in the upper-right, and one compact integrated action. Direct joining says “I’m In”; membership, requests, closed/full behavior, saved state, menus, and all action handlers remain intact. There is no image-presentation consent field in the current product, so Memory viewing permission is deliberately not used as permission to display cover artwork. No media or database contracts changed.

The compact status control has settings on the left, a note composer in the center, and an availability dropdown on the right. It preserves account/device preferences, status audience and text, scheduled intervals, and explicit clearing. The settings sheet retains access to the existing advanced status editor. Music remains deferred. Sonar uses the same existing component and confirmation logic on homepage and Profile; the compact button alone never starts sharing.

Each friend row has an accessible right-side plus/check selection target. Selection needs no planning-mode toggle and survives inline/full-list browsing and creation. The existing atomic creation and invitation retry protection remain in use.

Discovery selection is shared between homepage and Browse and searches only authorized meeting-place fields. Browse uses a virtualized section list and retains section deep links. Its Map handoff carries categories and shared discovery filters into a removable Beacons context, without changing saved layer preferences. The original local Map camera, categories, and selection snapshot is captured once; intentional camera/category/selection changes prevent their corresponding restoration. Shared search/filter edits remain intact. People/status layers and unrelated Plan/Thread context layers are temporarily suppressed, and all activity/location authorization is reapplied.


### Overhaul verification

- TypeScript and full-project lint passed; no backend or schema changes.
- 84 focused domain/database tests passed, including the new personal-preview ordering and 500-Beacon discovery tests, explicit time filters, status/privacy/reactions, Map permissions, and atomic creation/invitation retry protection.
- All 19 browser scenarios passed across the broad run and the final targeted Map rerun. Coverage includes 320/375/430px social/discovery layouts and touch targets, long-title/count stress, remembered dropdown availability, clearing scheduled notes, Sonar recipient confirmation, template/invitee/draft retention, full friend selection, Browse/personal navigation, and legacy deep links. One stale Profile avatar-size assertion was aligned with the existing 84px design; its privacy/Sonar checks passed.
- Before/after phone screenshots were visually compared. Review captures are retained locally under `.expo/discovery-review/`, including full homepage and Explore detail at all three widths.
- Web export and Android JavaScript/Hermes export passed. Physical-device Sonar/GPS, native keyboard/safe-area interactions, iOS compilation, and live hosted-backend flows were not exercised. No deployment was performed.


## Final interaction polish — October 17, 2026

Discovery cards keep their editorial artwork and upper-right attendance count. Their action footer now spans the available card width and wraps, with natural-width Join/Request/Pending/Open actions and separate 44px Bookmark/More targets. Approved invitations say Join; callbacks and RSVP validation are unchanged. Repeated title-as-location and placeholder metadata are omitted in favor of a useful authorized host label. Countdown labels use compact hours/minutes.

React and Comments occupy the bottom-left where the existing module permissions allow them. Counts exclude unauthorized entries and deduplicate records. Reactions reuse the existing picker/action; Comments opens the existing authorized comment section. Enabled Checklist, Journal, Focus timer, Memories, Scoreboard, and existing Music link destinations remain in More. No new social or media backend was introduced.

More uses grouped icon rows, content-sized phone sheets, and anchored popovers from 768px when there is a valid anchor. The shared sheet exposes dismissal completion so report, RSVP, collection, editor, and navigation transitions wait for cleanup and focus restoration. Basic availability remains a small anchored dropdown.

Saved & Tools is a compact secondary row. Saved Beacons, Favorite friends, and Favorite Squads remain separate collections with their existing removal semantics; My Plans, My Templates, and Library retain their destinations. Browse exposes the same Saved Beacons collection next to search/filter controls. Notifications always exposes Responses & Invitations, including with no pending items; /responses is unchanged.

Quick availability explicitly targets the current record. Available and Busy preserve the current audience/note; Not sharing clears current sharing only. Independently scheduled records remain available through explicit settings editing and clearing. Sonar retains its existing confirmation/controller. Friend plus/check labels explicitly select or deselect a person for planning, without inviting or sending a Ping.

### Final polish validation

- TypeScript, full-project lint, web export, and Android JavaScript/Hermes export passed.
- 44 focused domain/database tests passed after the engagement and approved-invitation refinements, covering authorization, status preservation, reactions, activity tools, creation handoff, and atomic publication/retries. Earlier focused discovery, friend, and Map tests also passed.
- All 26 browser scenarios passed across the main run and targeted reruns. A reaction assertion was corrected to verify the visible emoji rather than an unsupported web button attribute; its accessible selected-emoji label also passed. One overlapping runner artifact-cleanup error was resolved by rerunning sequentially.
- Phone screenshots at 320, 375, and 430px were compared before/after, plus contextual menus at 1024px. Local captures are in `.expo/final-polish/`. Browser coverage includes compact/wrapped action targets, collection sharing/removal, menu dismissal and focus restoration, current/future status coexistence, comments/reactions, Sonar confirmation, friend planning, draft retention, Browse, My Activity, Map, and deep links.
- Physical-device GPS/Sonar, native keyboard/safe-area interaction, screen-reader behavior, iOS compilation, and hosted production-backend flows were not exercised. No deployment was performed.


## Dedicated Friends page — October 17, 2026

Friends Right Now now stays at four rows. A top-right people icon and View all arrow open the normal `/friends` stack page; the 12-row inline expansion and All friends bottom sheet are removed. The section heading can wrap without shrinking. `/find-friends` retains its separate discovery/invitation purpose.

The Friends page has a back arrow, a mint people emblem, authorized summary counts, full-network search, the existing availability/Beacon/Favorites filters, and private-list filters. A virtualized list shares the homepage row, status detail, avatar preference, and planning controller. Existing detail sheets remain, with navigation queued until dismissal completes. Back restores the prior screen; direct entry falls back to Beacons.

A single bottom planning area appears only with selections or a validation error. Selected-person chips support individual removal, alongside Clear and Plan with N. Account-scoped session memory preserves query, filters, list position, and the existing planning draft/selection. Scroll restoration waits for virtualized content measurement and clamps at the actual end if the list shrinks. No backend, schema, or tab changes.

### Friends page validation

- 30 focused domain/database tests passed, including 500-friend search and private-list authorization, account-isolated browse state, selection/draft retention, reaction/status privacy, and atomic creation/invitation retry protection.
- All 17 Friends/social browser scenarios passed. TypeScript, full-project lint, web export, and Android JavaScript/Hermes export passed. Browser checks cover 320/375/430/1024px, four-row homepage limits, icon/link touch targets, the 143-friend demo list and virtualized rendering, full-network search, Favorites/private-list separation, individual removal/Clear, Create handoff, preserved homepage/list positions, Profile/detail return, direct entry, and larger text/long names.
- Screenshots are retained locally under `.expo/friends-page/`, including homepage previews, the new page, selected-person footer, and the 320px text-size stress case.
- Physical-device keyboard/safe-area interactions, screen readers, iOS compilation, and live hosted-backend behavior remain untested. No deployment was performed.

## Smart RSVP — October 17, 2026

Discovery cards now use viewer-specific participation controls: unanswered invitations offer I’m In / I’m Out and Maybe; discovery offers Join or Request to Join; existing responses show Going, Requested, Maybe, or Can’t Go. Hosting opens the Beacon. Following the final visual reference, compact time, Live and Hosting badges sit above the wrapping title beside the category artwork, inside a complete subtle card outline. The live accent is an expanding ring that fades out and restarts, disabled for reduced motion and inactive screens. Actual emoji summaries and More remain at the upper-right, with authorized attendance and optional friend avatars grouped together. Strict limits have a small proportional capacity meter; soft limits use suggested-size text. Artwork remains decoration/category/default only, with no Memory-image reuse.

`participation.ts` and `useBeaconParticipation.tsx` share state, permitted intents, account/Beacon submission serialization, canonical refresh, ambiguous-retry identities, and consequence-aware confirmation across cards, Overview, Map, linked Beacons and Responses. Going is independent of arrival and takes precedence over capacity labels. Leave is explicit; consequential departures and Going-to-Maybe explain capacity, role, unfinished assignments, arrival, live or Plan-stop consequences. Harmless changes do not add a confirmation. Existing role assignments and check-in history are retained.

The additive migration `202610170001_smart_rsvp.sql` supports declined invitation responses while preserving grants, canonical RSVP rows, RLS, legacy withdrawal callers and request replay. Ordinary invitation retries cannot reopen a decline. Reopening uses an explicit manager-authorized Reinvite. Public Maybe/removal and public departure do not create invitation grants. The legacy snapshot retains only invited/requested/interested/going; declined database rows travel through `resolved_beacon_responses` and normalize into the same internal RSVP collection. Unknown statuses fail closed. Updated clients enable decline only with `capabilities.rsvp_decline` (or the local demo).

**Rollout:** apply and verify the compatible database/read/action migration before releasing the updated client. The capability is emitted only by the completed migration. No hosted migration or deployment was performed by this implementation.

### Smart RSVP validation

- TypeScript, full-project lint, web export and Android JavaScript/Hermes export passed.
- The dedicated `npm run test:rsvp` command passes 39 domain/database checks. An additional focused run passes 59 checks covering profile/module privacy, Ping conversion, calendar projection, Map context, planning, Friends session state and publication retry protection (the two runs overlap).
- Database tests exercise decline/reinvite/replay, old/new snapshots, RLS, public tentative responses and departures, invitation departures, capacity release, request cancellation, dormant roles and preserved arrival. Queued transactions contend for the last seat; this is an embedded PostgreSQL test, not a hosted multi-connection load test.
- The final nine-case RSVP/layout rerun passes after the badge and border refinements, including animated-ring progress and reduced-motion suppression. The preceding 15-case RSVP/menu run also passes. There are 26 review captures linked by `.expo/smart-rsvp/review.html`. Phone and desktop browser checks cover invitation responses, shared Overview/Map state, confirmations, answered Responses, menus and focus, collection access, scheduling, Sonar, friend selection, planning drafts and deep links. Review screenshots are under `.expo/smart-rsvp/` at 320/375/430/1024px; compared with the earlier phone captures under `.expo/final-polish/`.
- Physical devices, native screen readers, native keyboard/safe-area interactions, iOS compilation, hosted Supabase flows and real network-loss delivery remain untested. Ambiguous publication retries are tested in the existing handoff suite; RSVP request replay is tested at the database layer.

The final card-spacing follow-up aligns the upper toolbar within the card padding so it no longer creates a tall gap above the title. Title and meaningful location share one content target. Comments/Chat and the bottom-right Open shortcut use matching rounded outlines and mint icons, while their actual touch targets remain at least 44px.
