import type { Ref } from 'react';
export type WrapRef = Ref<unknown> | undefined;
export declare function assignRef(ref: WrapRef, instance: unknown): (() => void) | undefined;
export declare function isHostInstance(instance: unknown): boolean;
export declare function preferHostInstance(instance: unknown): unknown;
export interface HostInstanceProvider {
    getHostInstance: () => unknown;
}
export declare function resolveHostInstance<T>(ref: T): T;
//# sourceMappingURL=hostInstance.d.ts.map