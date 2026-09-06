"use strict";

import { CallbackType } from '../../../CallbackType';
import { State } from '../../../State';
import { TouchEventType } from '../../../TouchEventType';
import { flattenAndFilterEvent, isEventForHandlerWithTag, maybeExtractNativeEvent, runCallback, touchEventTypeToCallbackType } from '../utils';
import { isStateChangeEvent, isTouchEvent } from '../utils/eventUtils';
function handleStateChangeEvent(eventWithData, callbacks, context, fillInDefaultValues) {
  'worklet';

  const {
    oldState,
    state
  } = eventWithData;
  const event = flattenAndFilterEvent(eventWithData);
  if (oldState === State.UNDETERMINED && state === State.BEGAN) {
    runCallback(CallbackType.BEGAN, callbacks, event);
  } else if ((oldState === State.BEGAN || oldState === State.UNDETERMINED) && state === State.ACTIVE) {
    fillInDefaultValues?.(event);
    runCallback(CallbackType.START, callbacks, event);
  } else if (oldState !== state && (state === State.END || state === State.FAILED || state === State.CANCELLED)) {
    const canceled = state === State.FAILED || state === State.CANCELLED;
    const endEvent = {
      ...event,
      canceled
    };
    if (oldState === State.ACTIVE) {
      fillInDefaultValues?.(endEvent);
      runCallback(CallbackType.END, callbacks, endEvent);
    }
    runCallback(CallbackType.FINALIZE, callbacks, endEvent);
    if (context) {
      context.lastUpdateEvent = undefined;
    }
  }
}
export function handleUpdateEvent(eventWithData, handlers, changeEventCalculator, context) {
  'worklet';

  const eventWithChanges = changeEventCalculator ? changeEventCalculator(eventWithData, context ? context.lastUpdateEvent : undefined) : eventWithData;
  const event = flattenAndFilterEvent(eventWithChanges);
  runCallback(CallbackType.UPDATE, handlers, event);
  if (context) {
    context.lastUpdateEvent = eventWithData;
  }
}
export function handleTouchEvent(event, handlers) {
  'worklet';

  if (event.eventType !== TouchEventType.UNDETERMINED) {
    runCallback(touchEventTypeToCallbackType(event.eventType), handlers, event);
  }
}
export function eventHandler(handlerTag, sourceEvent, handlers, changeEventCalculator, jsContext, dispatchesAnimatedEvents, fillInDefaultValues) {
  'worklet';

  const eventWithData = maybeExtractNativeEvent(sourceEvent);
  if (!isEventForHandlerWithTag(handlerTag, eventWithData)) {
    return;
  }
  if (isStateChangeEvent(eventWithData)) {
    handleStateChangeEvent(eventWithData, handlers, jsContext, fillInDefaultValues);
    return;
  }
  if (isTouchEvent(eventWithData)) {
    handleTouchEvent(eventWithData, handlers);
    return;
  }

  // Guard against malformed events
  if (eventWithData.handlerData === undefined) {
    return;
  }
  if (!dispatchesAnimatedEvents) {
    handleUpdateEvent(eventWithData, handlers, changeEventCalculator, jsContext);
  }
}
//# sourceMappingURL=eventHandler.js.map