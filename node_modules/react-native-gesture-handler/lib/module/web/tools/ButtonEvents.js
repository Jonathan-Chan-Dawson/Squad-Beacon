"use strict";

export const ButtonEventName = {
  Press: 'gh:buttonPress',
  PressIn: 'gh:buttonPressIn',
  PressOut: 'gh:buttonPressOut',
  LongPress: 'gh:buttonLongPress',
  InteractionFinished: 'gh:buttonInteractionFinished'
};
export function dispatchButtonEvent(view, name, event) {
  view?.dispatchEvent(new CustomEvent(name, {
    detail: event
  }));
}
//# sourceMappingURL=ButtonEvents.js.map