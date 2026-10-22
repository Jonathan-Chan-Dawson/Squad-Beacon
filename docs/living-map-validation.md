# Living Map — Pass 1

Native iOS/Android presentation uses the existing map engine and explorer. Web presentation, backend contracts, and stored coordinates are unchanged.

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
