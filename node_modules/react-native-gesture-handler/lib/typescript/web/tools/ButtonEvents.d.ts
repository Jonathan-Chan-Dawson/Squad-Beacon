import type { ButtonEvent } from '../../v3/types';
export declare const ButtonEventName: {
    readonly Press: "gh:buttonPress";
    readonly PressIn: "gh:buttonPressIn";
    readonly PressOut: "gh:buttonPressOut";
    readonly LongPress: "gh:buttonLongPress";
    readonly InteractionFinished: "gh:buttonInteractionFinished";
};
export type ButtonEventTypeName = (typeof ButtonEventName)[keyof typeof ButtonEventName];
export declare function dispatchButtonEvent(view: HTMLElement | null | undefined, name: ButtonEventTypeName, event: ButtonEvent): void;
//# sourceMappingURL=ButtonEvents.d.ts.map