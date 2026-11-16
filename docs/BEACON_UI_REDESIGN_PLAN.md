# Beacon UI redesign — implementation plan

## Objective
Implement the approved calm, structured design across Beacon entry, creation, workspace and tools. Use section hierarchy and aligned information rows, rather than a column of equally prominent buttons. Agenda becomes **Activity schedule** in user-facing navigation; database identifiers and existing agenda actions remain unchanged. A Plan continues to mean connected Beacons.

## Delivery passes
1. Establish a Beacon section/header/action-row vocabulary using existing theme tokens. Rebuild the schedule as a timeline and Hosting as participant-oriented rows with focused details. Preserve permissions and private editor identity keys.
2. Replace clipped tool navigation with a wrapping grouped picker and a focused selected-tool header. Keep existing deep links, selection/return behavior and history access. Keep global appearance/settings outside the selected tool's daily controls.
3. Refine Beacon cards, creation rows, Overview metadata, People spacing, score presentation, timer configuration and Memories management using the same vocabulary. Preserve platform siblings and responsive layouts; keep adjacent Map/Plan/Calendar handoffs canonical.
4. Verify actual flows in demo tiers at phone/desktop sizes, light/dark, keyboard and reduced motion. Run typecheck, lint, focused domain/database tests, web export and browser journeys. Record local versus hosted/native validation boundaries.

## Design checklist: 120 improvements
Each row lists ten coordinated improvements. These are design/acceptance targets, not new backend features.

| Area | Ten targets |
| --- | --- |
| Foundation | Page margins; aligned headings; inner spacing; section separation; restrained borders; limited elevation; restrained accents; type hierarchy; consistent radii; no duplicate explanations |
| Cards | Title hierarchy; quieter artwork; time/status grouping; location row; attendee summary; quiet community metadata; fewer badges; compact action row; one overflow entry; shared anatomy |
| Home/Browse | Personal/discovery separation; concise headings; aligned View all; predictable search; visible filters; filter summaries; distinct loading/empty states; consistent previews; retained scroll; clear Map handoffs |
| Creation | Short basics; date/time grouping; duration adjacency; audience grouping; location/edit pairing; proper switches; optional summaries; restrained appearance preview; distinct drafts/templates; one publication action |
| Detail | Compact hero; readable long titles; category/status grouping; host identity; header actions; readable navigation; no obstructive toolbar; clear selection; natural labels; unobscured focus |
| Overview | Timing section; location section; readable description; attendance/capacity summary; preparation summary; next stage; personal participation state; comments entry; bounded Memories; secondary repeat/admin actions |
| People | Separate organizer controls; attendance summary; compact roster; aligned roles/status; trailing actions; invitation section; readable answers; marked private notes; direct check-in; Free Bring Items |
| Schedule | Timeline; time column; aligned titles; secondary duration; current-stage emphasis; quiet completed rows; organizer labels; linked-task context; separate live/edit controls; one item editor |
| Tools | Readable picker; purpose groups; compact summary tiles; less button chrome; focused workspace; separate settings; preserved selection; paused history; useful empty states; consistent names |
| Checklist/Timer | Aligned tasks; quiet item actions; assignment/deadline metadata; section progress; toolbar filters; prerequisite explanation; focused clock; horizontal controls; goals/progress; secondary presets/history |
| Teams/Councils | Score rows; adjacent minus/value/plus; round selector; separate administration; clear standings; scoring summaries; consistent options; separate voting/settings; ordered decisions; distinct results |
| Journal/Memories | Read/edit separation; compact templates; quiet tags; consistent media ratios; attached captions; clear collection entry; readable layout choices; separate consent; distinct destructive actions; useful empty states |

## Contracts and safeguards
No schema or public backend API changes. Keep current actions, revision/replay checks, entitlement resolution, unlimited Free Checklist, Free Bring Items/RSVP/arrival/voting, Journal/media privacy, account/session isolation, timer persistence and checklist paging. Editing must be explicit, cancellable and revision-checked. Existing concurrent user changes are preserved.

## Acceptance
Check 320/390/768/1024/1440px where applicable, light/dark, long content and large text. Controls remain at least44px, essential navigation never clips, no page-level horizontal overflow, one obvious primary action per context. Test schedule save/live progress, hosting answers/check-in, tool picking/return, ordinary creation/RSVP, scoring and consent. Maintain a separate validation report with completed work and release limitations.
