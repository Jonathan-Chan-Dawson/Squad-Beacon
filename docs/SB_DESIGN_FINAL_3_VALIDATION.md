# SB Design Final 3 validation

## Map

The shared presentation benchmark uses 100, 500, 2,000, or 10,000 Beacons, plus 20% as many friends. Dense and wide fixtures use the same camera sequence over zooms 8, 11, 14 and 17. Run it with `node_modules/.bin/tsx scripts/measure-map-presentation.ts`.

| Beacons | Dense p95 before | Dense p95 after | Wide p95 before | Wide p95 after |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 3.8 ms | 2.0 ms | 3.0 ms | 1.8 ms |
| 500 | 7.3 ms | 3.8 ms | 8.2 ms | 1.7 ms |
| 2,000 | 29.1 ms | 11.6 ms | 57.7 ms | 7.8 ms |
| 10,000 | 248.6 ms | 45.3 ms | 258.2 ms | 51.3 ms |

These are Windows workstation Node timings for the shared presentation pipeline. Both captures ran while a web export was in progress. The peak presentation feature count at 10,000 Beacons was 42 dense and 82 wide after the change. Browser element counts, device frame times and device memory require their own runs.

The optional `tests/browser/mapPerformance.spec.ts` journey samples four pan and zoom sequences on the real demo. Enable it with `SB_MEASURE_MAP=1` and point `PREVIEW_DIR` at a local web export. It records frame samples, long tasks, time from entering the demo to first markers, and marker count. Use the same browser, viewport and tile-network policy for comparisons.

In one pair of headless Chrome runs on a 390px viewport, the demo reached its first markers in 7.6s before and 3.0s after. Frame interval p95 was 633ms before and 217ms after. The longest task fell from 1,354ms to 558ms, while recorded long tasks increased from 15 to 23. Both runs peaked at seven Leaflet marker elements. These single-run samples are sensitive to workstation load and still show visible stalls. Device frame and memory acceptance remains open.

## Local acceptance

- The focused Map/social, onboarding, Rewards, living activity and Spontaneity tests cover the changed paths. The Rewards database test exercises capped taps, retry, weekly reset, Stage 1 unlock, historical ownership and the original Coin rate.
- Profile places the 28px Mini Beacon and Shop faces in separate 44pt touch targets (48dp on Android), right-aligned on the status note row. Press and hold Mini Beacon for its allowance and upgrade details.
- Expo produced a production web export and Android and iOS JavaScript bundles. These exports verify bundling. Native binaries and installed-device behavior require separate checks.
- The full `npm test` run passed 621 of 622 checks. The demo multi-Beacon Routine test fails with `PREMIUM_REQUIRED`. The same test fails in the unchanged commit, as verified with a fresh source archive.
- Production web browser journeys use mocked account transport or a local PGlite database. Screenshots and traces are written to the local Playwright output directories.

## Deployment and device acceptance

- Apply the additive Stage 0 migration in a production-like environment before rolling out the updated clients. Check pre-rollout access, stages, inventory and balances with both clients. The migration has been exercised locally in the ordered history.
- Repeat the large-dataset gesture and memory checks on Android and iOS hardware, including selected markers, returning to Map and backgrounding. The Android device check returned no connected devices. No device or hosted release acceptance is recorded here.
