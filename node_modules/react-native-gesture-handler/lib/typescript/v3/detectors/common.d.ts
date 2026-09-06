import type React from 'react';
import type { TouchAction, UserSelect } from '../../handlers/gestureHandlerCommon';
import type { GestureDetectorProps as LegacyDetectorProps } from '../../handlers/gestures/GestureDetector';
import type { Gesture } from '../types';
import { type RNGestureHandlerDetectorNativeComponentProps } from './HostGestureDetector';
export declare enum GestureDetectorType {
    Native = 0,
    Virtual = 1,
    Intercepting = 2
}
interface CommonGestureDetectorProps {
    children?: React.ReactNode;
    userSelect?: UserSelect | undefined;
    touchAction?: TouchAction | undefined;
    enableContextMenu?: boolean | undefined;
}
export interface NativeDetectorProps<TConfig, THandlerData, TExtendedHandlerData extends THandlerData> extends CommonGestureDetectorProps {
    gesture: Gesture<TConfig, THandlerData, TExtendedHandlerData>;
}
export interface InterceptingGestureDetectorProps<TConfig, THandlerData, TExtendedHandlerData extends THandlerData> extends CommonGestureDetectorProps {
    gesture?: Gesture<TConfig, THandlerData, TExtendedHandlerData>;
}
export interface VirtualDetectorProps<TConfig, THandlerData, TExtendedHandlerData extends THandlerData> extends CommonGestureDetectorProps {
    gesture: Gesture<TConfig, THandlerData, TExtendedHandlerData>;
}
export type GestureDetectorProps<TConfig, THandlerData, TExtendedHandlerData extends THandlerData> = NativeDetectorProps<TConfig, THandlerData, TExtendedHandlerData> | InterceptingGestureDetectorProps<TConfig, THandlerData, TExtendedHandlerData> | LegacyDetectorProps;
export declare const AnimatedNativeDetector: React.ComponentType<RNGestureHandlerDetectorNativeComponentProps>;
export declare const nativeDetectorStyles: Readonly<{
    detector: {
        display: "contents";
    };
}>;
export {};
//# sourceMappingURL=common.d.ts.map