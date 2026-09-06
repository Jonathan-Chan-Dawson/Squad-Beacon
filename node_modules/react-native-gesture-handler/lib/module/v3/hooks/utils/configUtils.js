"use strict";

import { useMemo } from 'react';
import { Reanimated } from '../../../handlers/gestures/reanimatedWrapper';
import { normalizeHitSlop } from '../../../handlers/hitSlop';
import { isTestEnv, tagMessage } from '../../../utils';
import { isNativeAnimatedEvent, shouldHandleTouchEvents } from './eventUtils';
import { allowedNativeProps, applyProductionTestIDFilter, EMPTY_WHITE_LIST, PropsToFilter, PropsWhiteLists } from './propsWhiteList';
import { hasWorkletEventHandlers, maybeUnpackValue } from './reanimatedUtils';
import { isComposedGesture } from './relationUtils';
export function isGestureEnabled(gesture) {
  if (isComposedGesture(gesture)) {
    // For composed gestures, we need to check if at least one of the composed gestures is enabled
    return gesture.gestures.some(isGestureEnabled);
  }
  return maybeUnpackValue(gesture.config.enabled) !== false;
}
export function resolveInternalConfigProps(config) {
  if (isTestEnv() && config.disableReanimated === undefined) {
    config.disableReanimated = true;
  }
  if (__DEV__ && isNativeAnimatedEvent(config.onUpdate) && !config.useAnimated) {
    console.warn(tagMessage('You are using Animated.event in onUpdate without setting useAnimated to true. ' + 'This may lead to unexpected behavior. If you intend to use Animated.event, ' + 'please set useAnimated to true in the gesture config.'));
  }
  config.dispatchesAnimatedEvents = config.useAnimated || isNativeAnimatedEvent(config.onUpdate);

  // Validate that the user is not trying to mix Animated and Reanimated before updating the config.
  if (__DEV__ && config.dispatchesAnimatedEvents && (config.disableReanimated === false || config.runOnJS === false)) {
    throw new Error(tagMessage('Animated cannot be used together with Reanimated in the same gesture. Please choose either Animated or Reanimated for handling gesture events.'));
  }
  if (config.dispatchesAnimatedEvents) {
    config.disableReanimated = true;
  }
  config.shouldUseReanimatedDetector = !config.disableReanimated && Reanimated !== undefined && hasWorkletEventHandlers(config) && !config.dispatchesAnimatedEvents;
  config.needsPointerData = shouldHandleTouchEvents(config);
}
export function prepareConfigForNativeSide(handlerType, config) {
  applyProductionTestIDFilter();

  // @ts-ignore Seems like TypeScript can't infer the type here properly because of generic
  const filteredConfig = {
    dispatchesReanimatedEvents: config.shouldUseReanimatedDetector && !maybeUnpackValue(config.runOnJS)
  };
  const handlerPropsWhiteList = PropsWhiteLists.get(handlerType) ?? EMPTY_WHITE_LIST;
  for (const [key, value] of Object.entries(config)) {
    // @ts-ignore That's the point, we want to see if key exists in the whitelists
    if (allowedNativeProps.has(key) || handlerPropsWhiteList.has(key)) {
      const unpackedValue = maybeUnpackValue(value);
      filteredConfig[key] = key === 'hitSlop' ? normalizeHitSlop(unpackedValue) : unpackedValue;
    } else if (PropsToFilter.has(key)) {
      continue;
    } else {
      console.warn(tagMessage(`${key} is not a valid property for ${handlerType} and will be ignored.`));
    }
  }
  return filteredConfig;
}
function cloneConfig(config) {
  return {
    ...config
  };
}
function remapProps(config, propsMapping) {
  propsMapping.forEach((internalKey, key) => {
    if (key in config) {
      config[internalKey] = config[key];

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete config[key];
    }
  });
  return config;
}
const DEFAULT_PROPS_MAPPING = new Map();
const DEFAULT_PROPS_TRANSFORMER = config => config;
export function useClonedAndRemappedConfig(config, propsMapping = DEFAULT_PROPS_MAPPING, propsTransformer = DEFAULT_PROPS_TRANSFORMER) {
  return useMemo(() => {
    const clonedConfig = cloneConfig(config);
    const transformedConfig = propsTransformer(remapProps(clonedConfig, propsMapping));
    resolveInternalConfigProps(transformedConfig);
    return transformedConfig;
  }, [config, propsMapping, propsTransformer]);
}
//# sourceMappingURL=configUtils.js.map