import React from 'react';
import type { PressableProps } from '../../components/Pressable/PressableProps';
/**
 * `Pressable` dispatches between two implementations:
 *
 * - {@link StatefulPressable} — the state-machine engine, used whenever any of
 *   the `simultaneousWith` / `requireToFail` / `block` relation props is passed,
 *   since coordinating the press with an external gesture needs the composed
 *   gesture recognizers.
 * - {@link PressableWithTouchable} — the simpler engine built on the native
 *   button `Touchable`, used for everything else (the common case).
 *
 * The choice is re-evaluated each render: toggling a relation prop at runtime
 * swaps engines, which remounts and drops any in-progress press.
 */
declare const Pressable: (props: PressableProps) => React.JSX.Element;
export default Pressable;
//# sourceMappingURL=Pressable.d.ts.map