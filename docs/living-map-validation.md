# Living Map — Pass 1

Native iOS/Android and web reuse the existing map engines and explorer. Web now renders the same shared constellation policy with a DOM adapter and static geographic atmosphere. Backend contracts and stored coordinates are unchanged.

## Behavior

- One item retains its original pin. A 2–5 item stack expands into separate touch targets before exact-item selection; native accessibility actions also select individual items.
- Stacks of 6–10 show every marker and open the searchable explorer. Larger stacks show ten priority markers and an exact `+N` hidden-item badge.
- A tidy, slightly staggered petal fan represents overlaps visually. Expansion never writes geographic coordinates.
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

No successful native device session was available in this run: the local Android bridge could not start its daemon, and iOS device/simulator checks were not performed.

On both platforms, verify the original artwork and ownership stars, native marker snapshot clipping, avatar photo refresh, expanded-stack hit targets near screen edges and preview overlays, searchable explorer actions, pan/rotation/pinch behavior, hardware Back, VoiceOver/TalkBack actions, themes, and reduced motion. Brief marker fades use bounded native snapshot tracking; atmosphere uses static map primitives.

## Web follow-up

The web pass retains Leaflet/CARTO and ports the constellation presentation only. Existing controls, cards, contextual focus, basemaps and search remain in place. Small stacks expand into individual buttons; six or more open the existing searchable explorer, ten are visible before overflow, and keyboard Enter/Space/Escape actions work. Transparent marker margins pass through to map gestures. Both singleton rendering and aggregation deduplicate physical Beacons and select the freshest eligible friend session.

Validation: 60 relevant policy/privacy tests and 10 headless browser adapter/ripple tests pass. TypeScript, targeted ESLint and the production web export pass. A headless browser loaded the real static app, entered the demo, rendered constellation stacks/atmosphere, opened the existing explorer, entered a search query, and selected a person into the existing preview with zero page errors. Localhost access was denied by the sandbox, so the real exported files were served through file-backed browser request interception; external tiles were blocked, so live basemap loading was not verified. One repeat adapter test hit a browser-setup timeout under build load; its isolated rerun passed.
