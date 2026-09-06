import { CallbackType } from '../../../CallbackType';
import { TouchEventType } from '../../../TouchEventType';
import type { GestureCallbacks, UnpackedGestureHandlerEvent } from '../../types';
export declare function useMemoizedGestureCallbacks<THandlerData, TExtendedHandlerData extends THandlerData>(callbacks: GestureCallbacks<THandlerData, TExtendedHandlerData>): GestureCallbacks<THandlerData, TExtendedHandlerData>;
export declare function touchEventTypeToCallbackType(eventType: TouchEventType): CallbackType;
export declare function runCallback<THandlerData, TExtendedHandlerData extends THandlerData>(type: CallbackType, callbacks: GestureCallbacks<THandlerData, TExtendedHandlerData>, event: UnpackedGestureHandlerEvent<THandlerData>): void;
//# sourceMappingURL=eventHandlersUtils.d.ts.map