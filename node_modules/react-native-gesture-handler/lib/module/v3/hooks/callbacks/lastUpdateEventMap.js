"use strict";

import { Reanimated, Worklets } from '../../../handlers/gestures/reanimatedWrapper';
export function createLastUpdateEventMap() {
  if (Worklets?.createShareable === undefined || Worklets.UIRuntimeId === undefined || Reanimated === undefined) {
    return undefined;
  }
  return Worklets.createShareable(Worklets.UIRuntimeId, new Map());
}
//# sourceMappingURL=lastUpdateEventMap.js.map