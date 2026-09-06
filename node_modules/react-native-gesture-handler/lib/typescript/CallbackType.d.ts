export declare const CallbackType: {
    readonly UNDEFINED: 0;
    readonly BEGAN: 1;
    readonly START: 2;
    readonly UPDATE: 3;
    readonly CHANGE: 4;
    readonly END: 5;
    readonly FINALIZE: 6;
    readonly TOUCHES_DOWN: 7;
    readonly TOUCHES_MOVE: 8;
    readonly TOUCHES_UP: 9;
    readonly TOUCHES_CANCEL: 10;
};
export type CallbackType = (typeof CallbackType)[keyof typeof CallbackType];
//# sourceMappingURL=CallbackType.d.ts.map