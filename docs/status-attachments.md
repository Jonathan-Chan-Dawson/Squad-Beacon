# Status attachments

## Storage and authorization

The existing solo activity remains the Status identity and owns its audience, start, expiry, availability, and scheduling. A private companion `status_config` record retains the note, one attachment reference, presentation mode, note hiding, and sharing preference. A private record is necessary because the existing public activity table permits row reads: adding attachment IDs directly there would disclose private references to viewers of a wider-audience Status. Activity Only and hidden notes store sanitized text on public activity rows; owners receive retained text through an authorized projection.

The additive migration `20261018184636_status_activity_attachments.sql` extends the existing atomic action and snapshot pipeline. Configuration is inaccessible through direct authenticated table reads. Selection and new attachment saves require ownership/cohosting and source access. Viewers need access to both records; unavailable references are omitted. New scheduled configuration does not inherit current paused-sharing state, and current quick updates preserve their own configuration without touching future records. Scheduled replacements cancel the old scheduled record in the same transaction. Original activity lifecycles and responses are unchanged.

No hosted migration or production credential change has been performed. Apply the migration with the application release through the normal approved deployment process. Older servers ignore the new fields, so application-only deployment must not be represented as providing attachment privacy or persistence.

## Phase checkpoints

- Foundation: attachment selection, local preview, presentation modes, owner configuration, atomic persistence, hidden/paused sharing, scheduled independence, and authorized projections implemented. TypeScript and changed-source lint passed. Database checks exercise raw-table text redaction, private config denial, attachment audience intersections, hidden/paused sharing, expired scheduled attachments, and blocks. Existing Status/reaction/Ping/Vote/Draw/RSVP regressions passed. Browser selection/save/mode/removal flow passed; 320/375/430/1024px editor screenshots were inspected.
- Shared viewer: one bottom sheet serves Profile and both Friends surfaces. Profile and the owner editor keep the downward-tail note bubble above the avatar. The expanded viewer uses a compact identity-first header, note, featured attachment, secondary actions, and at most one opt-in Current Beacon row.

Local review captures are under `.expo/status-phase2/` and `.expo/status-phase3/`. Drafts retain the existing session-only lifetime; no new durable draft store is introduced.

## Living Status extension

`20261018201912_living_status_current_beacon.sql` adds `show_current_beacon` (default false) and nullable `current_beacon_id` to the same private configuration. No redundant preview, location, or attendance cache is stored. A null selection means Automatic; a Specific reference is retained after expiry/deletion so it cannot silently switch to Automatic.

The server derives active hosted, eligible cohosted, and approved-Going candidates. Automatic ranks hosting/cohosting first, most recently started next, then stable ID order. It chooses for the owner before intersecting with viewer access. Unauthorized viewers get no alternate candidate or retained configuration ID. Hide Note and Current opt-in are independent; paused sharing suppresses both. Genuine blank solo Status titles are supported without relaxing Beacon title requirements.

The `status_current_beacon` capability gates the new controls and blank-note persistence on hosted servers. Owner projections include saved preferences; viewer projections include only an authorized current reference and role. New independent schedules default off, while explicit-source renewals and ordinary edits retain configuration and do not resume paused sharing. Scheduled/current records remain separate.

No new timeline or Beacons screen is added. Current Beacon artwork/title navigates to the canonical Beacon after dismissal and fresh access checks. Featured responses use the existing canonical activity controllers. The Profile's Current/Next section and Map permissions are unchanged.

Both Status migrations remain local and unapplied to hosted environments. Release their application changes together through the approved migration process. This document does not assert production deployment or native runtime validation.
