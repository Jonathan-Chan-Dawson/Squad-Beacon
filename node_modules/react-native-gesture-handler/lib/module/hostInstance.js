"use strict";

export function assignRef(ref, instance) {
  if (typeof ref === 'function') {
    const cleanup = ref(instance);
    return typeof cleanup === 'function' ? cleanup : undefined;
  }
  if (ref) {
    ref.current = instance;
  }
  return undefined;
}
export function isHostInstance(instance) {
  return instance?.__internalInstanceHandle !== undefined;
}
export function preferHostInstance(instance) {
  if (instance === null || instance === undefined || isHostInstance(instance)) {
    return instance;
  }
  const nativeRef = instance.getNativeScrollRef?.();
  return isHostInstance(nativeRef) ? nativeRef : instance;
}
function providesHostInstance(ref) {
  return typeof ref?.getHostInstance === 'function';
}
export function resolveHostInstance(ref) {
  if (!providesHostInstance(ref)) {
    return ref;
  }
  return ref.getHostInstance() ?? ref;
}
//# sourceMappingURL=hostInstance.js.map