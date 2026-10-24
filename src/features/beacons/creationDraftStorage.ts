import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { createCreationDraftRepository } from "./creationDraftRepository";
export type { CreationDraftSummary } from "./creationDraftRepository";
const read = (key: string) =>
  Platform.OS === "web"
    ? Promise.resolve(
        typeof localStorage === "undefined" ? null : localStorage.getItem(key),
      )
    : SecureStore.getItemAsync(key);
const write = (key: string, value: string) =>
  Platform.OS === "web"
    ? Promise.resolve().then(() => {
        if (typeof localStorage === "undefined")
          throw new Error("Draft storage is unavailable.");
        localStorage.setItem(key, value);
      })
    : SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
const remove = (key: string) =>
  Platform.OS === "web"
    ? Promise.resolve().then(() => localStorage.removeItem(key))
    : SecureStore.deleteItemAsync(key);

const repository = createCreationDraftRepository({
  read,
  write,
  remove,
  newId: randomUUID,
});
export const {
  listSavedCreationDrafts,
  listCreationDraftSummaries,
  writeCreationSnapshot,
  readCreationSnapshot,
  deleteCreationSnapshot,
  discardCreationDraft,
} = repository;
