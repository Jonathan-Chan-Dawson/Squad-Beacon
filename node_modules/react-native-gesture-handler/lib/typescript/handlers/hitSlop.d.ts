import type { HitSlop } from './gestureHandlerCommon';
/**
 * Canonical representation of `hitSlop`, shared by every platform:
 * `[left, top, right, bottom, width, height]`, where `null` marks an edge that
 * the user did not specify.
 *
 * The public `HitSlop` type accepts a number, `horizontal`/`vertical`
 * shorthands and per-edge values; normalizing all of that here means each
 * platform only ever parses these six slots. `width` and `height` cannot be
 * flattened into the four edges because they are resolved against the measured
 * view bounds at hit-test time, so they are carried through as-is.
 */
export type CanonicalHitSlop = [
    left: number | null,
    top: number | null,
    right: number | null,
    bottom: number | null,
    width: number | null,
    height: number | null
];
/**
 * What actually travels to the platforms: either a plain number, which every
 * reader expands into four equal edges itself, or the six canonical slots.
 * A number stays a number on purpose — it avoids the array wrapper the bridge
 * would otherwise allocate for the far more common uniform case.
 */
export type NormalizedHitSlop = number | CanonicalHitSlop;
export declare const HIT_SLOP_LEFT_IDX = 0;
export declare const HIT_SLOP_TOP_IDX = 1;
export declare const HIT_SLOP_RIGHT_IDX = 2;
export declare const HIT_SLOP_BOTTOM_IDX = 3;
export declare const HIT_SLOP_WIDTH_IDX = 4;
export declare const HIT_SLOP_HEIGHT_IDX = 5;
/**
 * Converts the user-facing `hitSlop` into `CanonicalHitSlop`.
 *
 * `undefined` is passed through so that the property stays out of partial
 * config updates (the platforms leave the previous value alone when the key is
 * missing), while an explicit `null` becomes six unset slots, which is how the
 * platforms already represent a cleared hit slop.
 *
 * A plain number is forwarded untouched, so the uniform case never allocates an
 * array on the way to the platforms.
 *
 * Already normalized values are returned as-is, which keeps the function
 * idempotent.
 *
 * Runs on the UI thread as well, since `hitSlop` can be a shared value.
 */
export declare function normalizeHitSlop(hitSlop: HitSlop | NormalizedHitSlop): NormalizedHitSlop | undefined;
//# sourceMappingURL=hitSlop.d.ts.map