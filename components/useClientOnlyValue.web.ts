import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return hydrated ? client : server;
}
