import { router, type Href } from "expo-router";
import { rememberEntryIntent } from "./entryIntent";

/** Real signed-out actions use the existing login screen. Demo stays signed in. */
export function requestSignIn(path?: string) {
  if (path) rememberEntryIntent(path, {});
  router.push("/auth/sign-in" as Href);
}
