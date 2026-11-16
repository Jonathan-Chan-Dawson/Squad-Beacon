# Beacon UI redesign — local implementation and validation

## Delivered

The approved plan and 120-item design checklist are in [BEACON_UI_REDESIGN_PLAN.md](BEACON_UI_REDESIGN_PLAN.md). The checklist guides the whole Beacon experience; existing correct behavior is retained rather than replaced merely to claim more changes.

- **Foundation:** reusable Beacon section headings, responsive action rows and controlled disclosure rows; existing palettes and semantic colors retained.
- **Navigation:** grouped tool tiles replace the clipped horizontal tool rail. Phone workspaces have an All tools return action; wide selected workspaces have a 220px contextual sidebar with visible selection. Tool selection and existing route handoffs remain canonical.
- **Activity schedule:** the visible name distinguishes stages inside one Beacon from a Plan connecting several Beacons. A time/duration column aligns with stage names, responsibilities, task links and textual progress. Live progression has one main action. The entire schedule is no longer another nested accordion.
- **Focused editing:** one schedule stage expands at a time. Cancel confirms changed drafts; preset replacement confirms before replacing stages. Schedule and hosting editors retain the revision they opened with so a refresh does not silently replace the draft. Existing server revision checks still reject conflicting saves.
- **People and hosting:** participant counts are compact; reminder preference is a real switch. Optional personal answers, participant coordination and hosting configuration are separate. Search and ten-row paging bound the organizer roster. Check-in sits with the relevant person; restricted answers/notes remain in authorized details. Private editors retain viewer/session identity keys.
- **Detail:** the hero is shorter with a quieter title scale. Management/participation/share actions are in page flow rather than a fixed footer obscuring content. Appearance and Beacon settings stay outside the selected tool's daily working area.
- **Cards and discovery:** more breathing room, smaller category artwork and quieter category/time surfaces give titles, time/place and participation priority. Shared discovery cards carry this into Browse and applicable previews; compact Map tooltip geometry and permission boundaries remain separate.
- **Creation:** optional sections use restrained separators and neutral expanded surfaces. Module families share rows on wider layouts. Unavailable invitees are grouped; the duplicate Clear selection action is removed while clearing remains available even with no matching friends. Appearance Done is part of the scrolling form so it cannot cover background choices.
- **Checklist and timer:** checklist search and a secondary filter disclosure reduce the row of competing filters. Focus goals, presets, sequences and history sit in Focus setup, while clock and active-session controls remain the working area. Timer storage and absolute deadlines are unchanged.
- **Scores, Journal and Memories:** score values use neutral text rather than alternating decorative colors. Existing score/round and Council actions remain canonical. Recap edit/remove actions share a compact row; removal confirms that original memories remain. Journal, media and consent privacy rules remain unchanged.

## Verification

- Typecheck and lint: passed.
- Focused domain/database suite: 67 passed, covering Beacon modules/controls/history, activity/tool navigation, creation contracts/templates, focus timers, media/teams and Phase F ordered-history PGlite enforcement.
- Browser: all 30 journeys passed against the final stable web preview. Coverage includes Beacon controls, Phase F schedule/hosting/scoring/consent, tool picker/workspaces at 320/390/1024/1440px, schedule cancellation, Premium Tools and creation/mobile appearance journeys.
- Creation screenshots additionally cover 320/375/430/1024px in light/dark. Browser journeys use real routes/components and normal actions; demo setup is explicit.
- Web export: 59 routes. iOS export verifies shared-component bundling; device acceptance is separate.
- Generated screenshots: `.expo/beacon-redesign-*`, `.expo/beacon-expansion-*`, and `.expo/creation-mobile/*`.

One early browser run was interrupted by rebuilding its preview directory. Those infrastructure failures are excluded from acceptance and the affected tests are rerun against a stable completed build. The retained browser tests also exposed duplicate invitation actions and an appearance footer overlap; both product issues were corrected.

## Boundaries

This redesign adds no SQL migration, pricing changes or backend API. Earlier Phase F migrations remain source-only unless separately deployed. Hosted Supabase, real push delivery and native-device acceptance are not established by these local checks. General Map behavior, billing, community administration and a new Plan/calendar engine are outside the UI redesign. Existing calendar/Plan/Map links continue using their current routes and authorized data.

The 120-item checklist is a design and acceptance matrix, not a claim of 120 new capabilities. This delivery establishes the common hierarchy and improves the affected Beacon entry, creation, workspace and tool surfaces without rebuilding authorization or data engines. Broad custom layout builders, automatic shared timers and multi-stage voting engines remain the separately documented Phase F extensions.
