# Living Map — Pass 1

Native iOS/Android and web reuse the existing map engines and explorer. Web now renders the same shared constellation policy with a DOM adapter and static geographic atmosphere. Backend contracts and stored coordinates are unchanged.

## Behavior

- One item retains its original pin. A 2–5 item stack expands into separate touch targets before exact-item selection; native accessibility actions also select individual items.
- Stacks of 6–10 show every marker and open the searchable explorer. Larger stacks show ten priority markers and an exact `+N` hidden-item badge.
- A fixed circular petal layout represents overlaps visually: 32px artwork inside 72px circles for 2–5 items and 88px circles for 6+. One black disk at 22% opacity sits beneath the pile; hidden counts stay bottom-right and combined ownership stays top-right. Expansion never writes geographic coordinates.
- Zoom boundaries are 12 and 16 with a 0.35 zoom buffer. Sparse groups stay recognizable; groups of six eligible Beacons can become Spark Swarms or feathered geographic atmosphere.
- Friend locations never contribute to Beacon density. Marker membership is deduplicated by entity ID after the existing permission, timing, and filter pipeline; friend sessions use the newest eligible update.
- Ownership stars remain independent of selection. Atmospheric ownership anchors open the existing explorer; atmospheric shapes zoom to the swarm stage.
- The 150-feature budget conservatively includes visible stack artwork, geographic layers, ownership anchors, and reserved map context objects. Dense Beacon groups can become swarms under rendering pressure.

## Automated verification

- 19 native presentation policy tests cover stack boundaries, counts, priority, duplicate entities, identical locations, unchanged coordinates, hysteresis, friend/density separation, filtering inputs, date-line geometry, pan stability, selected markers, touch rectangle separation, and budget pressure.
- The surrounding map, identity, filtering, contextual-focus, discovery, themes, basemaps, and demo-fixture checks pass (58 existing tests).
- New policy tests are included in both `npm test` and `npm run test:map-social`.
- TypeScript and ESLint checks pass. Both iOS and Android production exports with Hermes bytecode pass; output is in the ignored `dist-native/living-map/` directory. The first attempt failed to write Hermes output in the sandbox temporary directory; rerunning with a workspace-local temporary directory succeeded.

## Native device checks still required

Native device checks were not performed for this pass. Per the user’s request, no computer emulator was launched; browser verification was headless.

On both platforms, verify the original artwork and ownership stars, native marker snapshot clipping, avatar photo refresh, expanded-stack hit targets near screen edges and preview overlays, searchable explorer actions, pan/rotation/pinch behavior, hardware Back, VoiceOver/TalkBack actions, themes, and reduced motion. Artwork changes use bounded native snapshot tracking; atmosphere uses static map primitives.

## Web follow-up

The web pass retains Leaflet/CARTO and ports the constellation presentation only. Existing controls, cards, contextual focus, basemaps and search remain in place. Small stacks expand into individual buttons; six or more open the existing searchable explorer, ten are visible before overflow, and keyboard Enter/Space/Escape actions work. Transparent marker margins pass through to map gestures. Both singleton rendering and aggregation deduplicate physical Beacons and select the freshest eligible friend session.

Validation: 60 relevant policy/privacy tests and 10 headless browser adapter/ripple tests pass. TypeScript, targeted ESLint and the production web export pass. A headless browser loaded the real static app, entered the demo, rendered constellation stacks/atmosphere, opened the existing explorer, entered a search query, and selected a person into the existing preview with zero page errors. Localhost access was denied by the sandbox, so the real exported files were served through file-backed browser request interception; external tiles were blocked, so live basemap loading was not verified. One repeat adapter test hit a browser-setup timeout under build load; its isolated rerun passed.


## Compact circular clusters (2026-10-24)

Native and web now share `clusterLayout.ts`: fixed count-specific slots, priority at the center, circle bounds, shadow metrics, and badge anchors. Geographic member positions do not control collapsed slots. Singletons, geographic destinations, swarms and atmosphere retain their existing behavior. Collapsed artwork omits stems, time chips and individual shadows.

Web retains layers by stable entity/group ID and focused visual revision. Geographic decoration layers have their own registry, so ordinary marker updates leave paths and atmosphere intact. Retained handlers dispatch current actions; changed eligibility removes old layers. Native uses indexed member models, memoized clusters, the parent clock and an artwork-only bitmap revision. Accessibility name/age updates do not restart bitmap tracking; avatar load or artwork changes do. Spatial grouping is cached separately from labels and availability; ranking changes can reuse existing geographic groups.

### Measured dense-demo marker updates

The headless Chrome fixture used the actual authorized dense demo (142 eligible points, 39 rendered groups, including nine clusters), actual Leaflet, and the actual DOM constellation adapter. Five warmups preceded 40 timed unchanged updates; each update forced layout. Artwork payloads were held consistent across runs. Baseline used the original adapter and full layer teardown; the updated run used the circular adapter and keyed layer registry.

| Measurement | Before | After |
| --- | ---: | ---: |
| Median marker-update loop | 8.8ms | 0.1ms |
| 95th percentile | 25.3ms | 0.2ms |
| Markers recreated over 40 unchanged updates | 1,560 | 0 |

This is approximately 99% less unchanged marker-update time in this isolated benchmark, exceeding the 50% target. It measures the suspected layer-rebuild cost, not full application frame rate, network tiles, initial rendering, or native device performance. Changed groups still rebuild their own artwork. Camera/group membership changes still require geographic work, so remaining lag on devices cannot be ruled out.

Regression coverage includes shared circle containment for 2/5/6/10/11/25 items, actual Leaflet DOM identity across settled pans, current callbacks, isolated updates/removals, separate decoration retention, exact overflow routing, keyboard/expanded targets, stable member models and grouping-cache invalidation. Native touch handling, bitmap snapshots/clipping, VoiceOver/TalkBack, avatar network refresh and device frame rate still require physical-device checks. No emulator was launched for this pass. Browser visual previews are component captures, not native screenshots.

Automated results for this pass: 95 targeted map, identity, filtering, discovery, contextual-focus, profile-privacy, exploration and theme tests passed; 17 headless browser tests passed; TypeScript passed. The browser suites cover circular bounds, exact overflow, explorer and keyboard routing, expanded touch targets, ripple/identity regressions and actual Leaflet layer retention.

Full application ESLint and both iOS/Android production exports with Hermes bytecode passed for this pass. Mobile output is in ignored `dist-native/tight-clusters/mobile/`. The initial web bundle and static routes compiled, but saving its output failed with Windows `EPERM` while creating `_expo/static/js`; export validation was retried in a prepared output directory.

The web export retry passed at `dist-native/cluster-web/` after preparing its output folders. Native and web production exports are validated; native device performance remains unverified.
