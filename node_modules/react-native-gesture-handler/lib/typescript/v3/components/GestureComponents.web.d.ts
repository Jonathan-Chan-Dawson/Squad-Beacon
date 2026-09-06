import * as React from 'react';
import type { FlatListProps } from 'react-native';
export declare const ScrollView: {
    (props: Omit<import("react-native").ScrollViewProps, "ref"> & {
        ref?: React.Ref<import("react-native").ScrollViewInstance> | undefined;
    } & {
        disableReanimated?: boolean | undefined;
        useAnimated?: boolean | undefined;
        testID?: string | undefined;
    } & {
        runOnJS?: boolean | import("../types").SharedValue<boolean> | undefined;
        enabled?: boolean | import("../types").SharedValue<boolean> | undefined;
        shouldCancelWhenOutside?: boolean | import("../types").SharedValue<boolean> | undefined;
        hitSlop?: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | {
            left?: number | import("../types").SharedValue<number> | undefined;
            right?: number | import("../types").SharedValue<number> | undefined;
            top?: number | import("../types").SharedValue<number> | undefined;
            bottom?: number | import("../types").SharedValue<number> | undefined;
            vertical?: number | import("../types").SharedValue<number> | undefined;
            horizontal?: number | import("../types").SharedValue<number> | undefined;
        } | {
            left: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            right: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            top: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | {
            bottom: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | [left: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, top: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, right: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, bottom: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, width: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, height: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null] | null | undefined;
        activeCursor?: import("../..").ActiveCursor | import("../types").SharedValue<import("../..").ActiveCursor> | undefined;
        mouseButton?: import("../..").MouseButton | import("../types").SharedValue<import("../..").MouseButton> | undefined;
        cancelsTouchesInView?: boolean | import("../types").SharedValue<boolean> | undefined;
        cancelsJSResponder?: boolean | import("../types").SharedValue<boolean> | undefined;
        manualActivation?: boolean | import("../types").SharedValue<boolean> | undefined;
    } & import("../types").GestureCallbacks<import("../hooks/gestures/native/NativeTypes").NativeHandlerData> & import("../hooks/gestures/native/NativeTypes").NativeGestureNativeProperties & import("../types").ExternalRelations & import("../types/NativeWrapperType").WrapperSpecificProperties<unknown>): React.JSX.Element;
    displayName: any;
};
export declare const Switch: {
    (props: Omit<import("react-native").SwitchProps, "ref"> & {
        ref?: React.Ref<import("react-native").SwitchInstance> | undefined;
    } & {
        disableReanimated?: boolean | undefined;
        useAnimated?: boolean | undefined;
        testID?: string | undefined;
    } & {
        runOnJS?: boolean | import("../types").SharedValue<boolean> | undefined;
        enabled?: boolean | import("../types").SharedValue<boolean> | undefined;
        shouldCancelWhenOutside?: boolean | import("../types").SharedValue<boolean> | undefined;
        hitSlop?: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | {
            left?: number | import("../types").SharedValue<number> | undefined;
            right?: number | import("../types").SharedValue<number> | undefined;
            top?: number | import("../types").SharedValue<number> | undefined;
            bottom?: number | import("../types").SharedValue<number> | undefined;
            vertical?: number | import("../types").SharedValue<number> | undefined;
            horizontal?: number | import("../types").SharedValue<number> | undefined;
        } | {
            left: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            right: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            top: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | {
            bottom: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | [left: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, top: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, right: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, bottom: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, width: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, height: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null] | null | undefined;
        activeCursor?: import("../..").ActiveCursor | import("../types").SharedValue<import("../..").ActiveCursor> | undefined;
        mouseButton?: import("../..").MouseButton | import("../types").SharedValue<import("../..").MouseButton> | undefined;
        cancelsTouchesInView?: boolean | import("../types").SharedValue<boolean> | undefined;
        cancelsJSResponder?: boolean | import("../types").SharedValue<boolean> | undefined;
        manualActivation?: boolean | import("../types").SharedValue<boolean> | undefined;
    } & import("../types").GestureCallbacks<import("../hooks/gestures/native/NativeTypes").NativeHandlerData> & import("../hooks/gestures/native/NativeTypes").NativeGestureNativeProperties & import("../types").ExternalRelations & import("../types/NativeWrapperType").WrapperSpecificProperties<unknown>): React.JSX.Element;
    displayName: any;
};
export declare const TextInput: {
    (props: Omit<import("react-native").TextInputProps, "ref"> & {
        ref?: React.Ref<import("react-native").TextInputInstance> | undefined;
    } & {
        disableReanimated?: boolean | undefined;
        useAnimated?: boolean | undefined;
        testID?: string | undefined;
    } & {
        runOnJS?: boolean | import("../types").SharedValue<boolean> | undefined;
        enabled?: boolean | import("../types").SharedValue<boolean> | undefined;
        shouldCancelWhenOutside?: boolean | import("../types").SharedValue<boolean> | undefined;
        hitSlop?: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | {
            left?: number | import("../types").SharedValue<number> | undefined;
            right?: number | import("../types").SharedValue<number> | undefined;
            top?: number | import("../types").SharedValue<number> | undefined;
            bottom?: number | import("../types").SharedValue<number> | undefined;
            vertical?: number | import("../types").SharedValue<number> | undefined;
            horizontal?: number | import("../types").SharedValue<number> | undefined;
        } | {
            left: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            right: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            top: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | {
            bottom: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | [left: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, top: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, right: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, bottom: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, width: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, height: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null] | null | undefined;
        activeCursor?: import("../..").ActiveCursor | import("../types").SharedValue<import("../..").ActiveCursor> | undefined;
        mouseButton?: import("../..").MouseButton | import("../types").SharedValue<import("../..").MouseButton> | undefined;
        cancelsTouchesInView?: boolean | import("../types").SharedValue<boolean> | undefined;
        cancelsJSResponder?: boolean | import("../types").SharedValue<boolean> | undefined;
        manualActivation?: boolean | import("../types").SharedValue<boolean> | undefined;
    } & import("../types").GestureCallbacks<import("../hooks/gestures/native/NativeTypes").NativeHandlerData> & import("../hooks/gestures/native/NativeTypes").NativeGestureNativeProperties & import("../types").ExternalRelations & import("../types/NativeWrapperType").WrapperSpecificProperties<unknown>): React.JSX.Element;
    displayName: any;
};
export declare const DrawerLayoutAndroid: () => React.JSX.Element;
export declare const RefreshControl: {
    (props: Omit<import("react-native").ViewProps, "ref"> & {
        ref?: React.Ref<import("react-native").ViewInstance> | undefined;
    } & {
        disableReanimated?: boolean | undefined;
        useAnimated?: boolean | undefined;
        testID?: string | undefined;
    } & {
        runOnJS?: boolean | import("../types").SharedValue<boolean> | undefined;
        enabled?: boolean | import("../types").SharedValue<boolean> | undefined;
        shouldCancelWhenOutside?: boolean | import("../types").SharedValue<boolean> | undefined;
        hitSlop?: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | {
            left?: number | import("../types").SharedValue<number> | undefined;
            right?: number | import("../types").SharedValue<number> | undefined;
            top?: number | import("../types").SharedValue<number> | undefined;
            bottom?: number | import("../types").SharedValue<number> | undefined;
            vertical?: number | import("../types").SharedValue<number> | undefined;
            horizontal?: number | import("../types").SharedValue<number> | undefined;
        } | {
            left: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            right: number | import("../types").SharedValue<number>;
            width: number | import("../types").SharedValue<number>;
        } | {
            top: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | {
            bottom: number | import("../types").SharedValue<number>;
            height: number | import("../types").SharedValue<number>;
        } | [left: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, top: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, right: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, bottom: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, width: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null, height: number | import("../types").SharedValue<number> | import("../types").SharedValue<null> | null] | null | undefined;
        activeCursor?: import("../..").ActiveCursor | import("../types").SharedValue<import("../..").ActiveCursor> | undefined;
        mouseButton?: import("../..").MouseButton | import("../types").SharedValue<import("../..").MouseButton> | undefined;
        cancelsTouchesInView?: boolean | import("../types").SharedValue<boolean> | undefined;
        cancelsJSResponder?: boolean | import("../types").SharedValue<boolean> | undefined;
        manualActivation?: boolean | import("../types").SharedValue<boolean> | undefined;
    } & import("../types").GestureCallbacks<import("../hooks/gestures/native/NativeTypes").NativeHandlerData> & import("../hooks/gestures/native/NativeTypes").NativeGestureNativeProperties & import("../types").ExternalRelations & import("../types/NativeWrapperType").WrapperSpecificProperties<unknown>): React.JSX.Element;
    displayName: any;
};
export declare const FlatList: <ItemT>(props: FlatListProps<ItemT>) => React.JSX.Element;
//# sourceMappingURL=GestureComponents.web.d.ts.map