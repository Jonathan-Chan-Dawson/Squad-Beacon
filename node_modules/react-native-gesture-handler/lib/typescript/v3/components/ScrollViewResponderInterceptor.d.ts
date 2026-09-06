import type { PropsWithChildren } from 'react';
import React from 'react';
import type { ScrollViewProps as RNScrollViewProps } from 'react-native';
type ScrollViewResponderInterceptorProps = PropsWithChildren<{
    keyboardShouldPersistTaps?: RNScrollViewProps['keyboardShouldPersistTaps'];
}>;
export declare const ScrollViewResponderProvider: ({ children, keyboardShouldPersistTaps, }: ScrollViewResponderInterceptorProps) => React.JSX.Element;
export {};
//# sourceMappingURL=ScrollViewResponderInterceptor.d.ts.map