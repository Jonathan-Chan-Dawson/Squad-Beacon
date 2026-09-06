import type { PropsWithChildren, ReactElement } from 'react';
import React from 'react';
import type { FlatListProps as RNFlatListProps, RefreshControlProps as RNRefreshControlProps, ScrollViewProps as RNScrollViewProps, SwitchProps as RNSwitchProps, TextInputProps as RNTextInputProps } from 'react-native';
import { FlatList as RNFlatList, RefreshControl as RNRefreshControl, ScrollView as RNScrollView, Switch as RNSwitch, TextInput as RNTextInput } from 'react-native';
import type { NativeWrapperProperties } from '../types/NativeWrapperType';
export declare const RefreshControl: React.ComponentType<RNRefreshControlProps & NativeWrapperProperties<React.ComponentRef<typeof RNRefreshControl> | null>>;
export type RefreshControl = typeof RefreshControl & RNRefreshControl;
export declare const ScrollView: (props: RNScrollViewProps & NativeWrapperProperties<React.ComponentRef<typeof RNScrollView> | null>) => React.JSX.Element;
export type ScrollView = typeof ScrollView & RNScrollView;
export declare const Switch: React.ComponentType<RNSwitchProps & NativeWrapperProperties<React.ComponentRef<typeof RNSwitch> | null>>;
export type Switch = typeof Switch & RNSwitch;
export declare const TextInput: React.ComponentType<RNTextInputProps & NativeWrapperProperties<React.ComponentRef<typeof RNTextInput> | null>>;
export type TextInput = typeof TextInput & RNTextInput;
export declare const FlatList: <ItemT = any>(props: PropsWithChildren<Omit<RNFlatListProps<ItemT>, "renderScrollComponent" | "ref"> & NativeWrapperProperties<RNFlatList<ItemT> | null>>) => ReactElement | null;
export type FlatList<ItemT = any> = typeof FlatList & RNFlatList<ItemT>;
//# sourceMappingURL=GestureComponents.d.ts.map