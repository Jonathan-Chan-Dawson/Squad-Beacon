import * as React from 'react';
export type KeyboardShouldPersistTaps = boolean | 'always' | 'never' | 'handled' | undefined;
export type JSResponderContextValue = {
    isRNGHResponderEvent: React.MutableRefObject<boolean>;
    keyboardShouldPersistTaps: KeyboardShouldPersistTaps;
};
export declare const JSResponderContext: React.Context<JSResponderContextValue | null>;
export declare function updateResponderEventValue(jsResponderContext: JSResponderContextValue | null | undefined, value: boolean): void;
export declare function setKeyboardVisibility(visible: boolean): void;
export declare function isKeyboardDismissingTap(jsResponderContext: JSResponderContextValue | null | undefined): boolean;
//# sourceMappingURL=scrollViewInterop.d.ts.map