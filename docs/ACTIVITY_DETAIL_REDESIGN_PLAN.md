# Activity detail redesign — Prompt 2

## Scope and invariants

Reuse Prompt 0 design tokens and components and the current activity permission/action contracts. Preserve all in-progress changes. This is a native Expo SDK 57 screen; Exact versioned Expo documentation was checked by the orchestrator: installed react-native-svg 15.15.4 and expo-haptics ~57.0.3 match SDK 57; SDK 57 mapview/linking docs were checked. Use SVG LinearGradient already available, without a new gradient dependency. Do not modify the map browser's independently owned preview-race work.

The initial phone viewport must show activity identity, friendly time, permitted location, host, and the next action. The action bar stays reachable throughout scrolling. At normal screen heights use an approximately 220 pt hero collapsing to a 56 pt navigation header; on a 375 × 667 phone use compact spacing and a shorter responsive expanded hero where needed. Targets are at least 44 pt and safe-area insets determine the bottom bar and content padding.

## Existing contracts

`app/activity/[id].tsx` owns fetching, permission evaluation, Overview/People/Chat/More, comments, reactions, RSVP, reporting, editing, and settings. Keep these handlers authoritative. Use the existing design-system Card, GlassBar, Chip, category tokens, uiHaptics, ProfileAvatar, ChatThread, and BeaconResponse semantics.

Capacity derives from `beaconCapacity`: count, limit, remaining, strict, full, and closed. Accepted seat count is authoritative where present; otherwise approved Going plus host defines count. The crew target is `target_count` and is independent of capacity. Never synthesize a limit or target.

Authorization uses `canManageBeaconSettings` / `canManageBeacon`, `canAdmitBeaconParticipants`, `canUseBeaconModules`, `canReadBeaconActivity`, per-profile `canViewProfile`, and `isBeaconModuleEnabled`. Existing tools are BeaconTools (checklist, journal, focus), BeaconMemories, BeaconScoreboard, and a music link. Place coordinates may be null; online links may be present. Existing actions include `favorite_beacon`, `save_template`, and report with id/reason. Open on map uses `/(tabs)?beacon=id`. No calendar integration was found and expo-calendar is not installed; omit Add to calendar unless actual capability is established, with no new native build or disabled placeholder button.

## Implementation packets

### A — Presentational detail primitives (Luna / XHigh)

Own new `components/activity-detail/ActivityDetailHero.tsx`, `ActivityDetailInfo.tsx`, `ActivityDetailProgress.tsx`, and any narrowly scoped supporting formatting module in that directory. Do not edit the route.

Export typed presentational components whose callbacks and already-authorized data come from the route. Hero accepts title, category label/color/icon, mode label, state chip, audience/join-policy chips, demo state, scroll animated value, back and overflow callbacks. Render category gradient/watermark, glass controls, responsive expanded height, parallax/collapse, and reduced-motion fallback. Info accepts friendly date/time/relative text and authorized online/place data; render a surface card with radius 20, device-different timezone only, a 72 pt static map thumbnail when coordinates and access permit, destination-only directions through the existing physicalDirectionsUrl helper used by MapScreen, and Open on map callbacks. Use no network map snapshot dependencies. Progress accepts authorized avatars, count, nullable capacity, nullable target, and joining animation state; visually distinguish capacity from target. Profile data must be safe to render, and hidden rosters must never be inferred from count.

Exports must use shared tokens and fit the route owner's contract; promptly send props to the route owner before implementation. No fetching, permission decisions, or mutations inside these components.

### B — Authorized tools and people panels (Luna / XHigh)

Own new `components/activity-detail/ActivityDetailTools.tsx` and `ActivityDetailPeople.tsx`. Do not edit the route or packet A files.

Tools accepts an already-filtered array of descriptors (id, icon, label, status, paused, callback) and renders a two-column grid, dimmed paused tiles with readable history access, and device-local Focus Timer labeling. Avoid fabricating completion counts. Preserve existing tool components through route selection/expansion. People accepts authorized Going, Maybe, and Requested rows plus host admission callbacks. Render distinct sections, profile-safe labels/avatars, and swipe approve/deny only when admission authority is true. Existing libraries only; provide accessible explicit action alternatives. Empty/hidden sections follow route permissions.

### C — Route integration and behavior (Luna / XHigh)

Own `app/activity/[id].tsx` only, plus minimal existing shared exports if required and agreed with other owners. Integrate packets A/B; retain existing data/action behavior. Replace the flat stacked layout with collapsing header, compact info, host row/sheet/message, progress, three-line Read more, reactions, sliding Overview/People/Tools/Chat tabs, and safe-area GlassBar.

Determine all chips/actions from true state, including pending/full/ended/host states and current response. Going is editable; join/request/maybe flow uses existing actions. Hosts see Manage with edit, attendance, tools, invite. Share uses the native share API. Move save/template/report to overflow, require destructive confirmation before report submission, and show calendar only with real capability. Online links and directions require validation of authorized destination data. Keep the existing map-entry transition and provide scale/fade fallback with reduced-motion support.

Gate each data section and enabled tool before passing props; never pass unauthorized location, rosters, requests, or private profile data to child components. Host profile opens the existing privacy-aware compact sheet. Put permitted tool detail panels in Tools, retaining paused history. Chat has readable bubbles, a pinned composer, and the requested empty state. Add pull-to-refresh RSVP counts, layout-matching skeletons, retry errors, small DemoChip, long-press emoji tray, brief floating reaction feedback, success haptic/checkmark, and avatar spring. Refresh after actions through existing authoritative fetch paths.

## Integration order and review

Agree prop contracts before parallel component edits. Packet C may start on state/layout plumbing while A/B build independently. Review completed packets with Sol 6.1 / High or Astra / Medium before final acceptance. Run type checks and existing relevant permission/action checks, then inspect narrow phone and browser layouts. Validate overflow/report, RSVP variants, host vs guest, restricted viewers, online/no-coordinate place, paused and disabled tools, refresh/error/loading, reduced motion, and safe area. Native ADB is currently unauthorized; browser verification supplements native testing and must not be reported as physical-device or 60 fps acceptance.

