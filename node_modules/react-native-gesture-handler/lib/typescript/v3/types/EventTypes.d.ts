import type { GestureTouchEvent } from '../../handlers/gestureHandlerCommon';
import type { PointerType } from '../../PointerType';
import type { State } from '../../State';
export type NativeEventWrapper<T> = {
    nativeEvent: T;
};
export type ButtonEvent = Readonly<{
    pointerInside: boolean;
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
    numberOfPointers: number;
    pointerType: PointerType;
}>;
type EventPayload = {
    handlerTag: number;
    state: State;
};
type StateChangeEventPayload = EventPayload & {
    oldState: State;
};
type BaseHandlerData = {
    numberOfPointers: number;
    pointerType: PointerType;
};
export type HandlerData<T> = BaseHandlerData & T;
export type GestureUpdateEventWithHandlerData<T> = EventPayload & {
    handlerData: HandlerData<T>;
};
export type GestureStateChangeEventWithHandlerData<T> = StateChangeEventPayload & {
    handlerData: HandlerData<T>;
};
export type GestureHandlerEventWithHandlerData<THandlerData, TExtendedHandlerData extends THandlerData = THandlerData> = UpdateEventWithHandlerData<TExtendedHandlerData> | StateChangeEventWithHandlerData<THandlerData> | TouchEvent;
export type UnpackedGestureHandlerEventWithHandlerData<THandlerData, TExtendedHandlerData extends THandlerData = THandlerData> = GestureUpdateEventWithHandlerData<TExtendedHandlerData> | GestureStateChangeEventWithHandlerData<THandlerData> | GestureTouchEvent;
export type UpdateEventWithHandlerData<THandlerData> = GestureUpdateEventWithHandlerData<THandlerData> | NativeEventWrapper<GestureUpdateEventWithHandlerData<THandlerData>>;
export type StateChangeEventWithHandlerData<THandlerData> = GestureStateChangeEventWithHandlerData<THandlerData> | NativeEventWrapper<GestureStateChangeEventWithHandlerData<THandlerData>>;
export type TouchEvent = GestureTouchEvent | NativeEventWrapper<GestureTouchEvent>;
export type GestureEvent<THandlerData> = {
    handlerTag: number;
} & HandlerData<THandlerData>;
export type GestureEndEvent<THandlerData> = {
    canceled: boolean;
} & GestureEvent<THandlerData>;
export type UnpackedGestureHandlerEvent<THandlerData> = GestureEvent<THandlerData> | GestureTouchEvent;
type AnimatedValue = {
    setValue: (value: number) => void;
};
type AnimatedMapping = {
    [key: string]: AnimatedMapping;
} | AnimatedValue;
export type AnimatedEvent = {
    _argMapping: (AnimatedMapping | null)[];
};
export type ChangeCalculatorType<TExtendedHandlerData> = (current: GestureUpdateEventWithHandlerData<TExtendedHandlerData>, previous?: GestureUpdateEventWithHandlerData<TExtendedHandlerData>) => GestureUpdateEventWithHandlerData<TExtendedHandlerData>;
export type DiffCalculatorType<TExtendedHandlerData> = (current: HandlerData<TExtendedHandlerData>, previous: HandlerData<TExtendedHandlerData> | null) => Partial<HandlerData<TExtendedHandlerData>>;
export {};
//# sourceMappingURL=EventTypes.d.ts.map