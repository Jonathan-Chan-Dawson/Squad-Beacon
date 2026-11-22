import { Platform } from "react-native";
import { draftStorageIO } from "@/src/features/beacons/creationDraftStorage";
import { createPlanEditorRepository } from "./planEditorRepository";

// SecureStore accepts a narrower set of characters than browser storage.
const storageKey = (key: string) =>
  Platform.OS === "web"
    ? key
    : key.replace(
        /[^a-z0-9.-]/gi,
        (character) => `_${character.charCodeAt(0).toString(16)}_`,
      );

export { planDraftKey } from "./planEditorRepository";
export const {
  cachedPlanDraft,
  readPlanDraft,
  writePlanDraft,
  deletePlanDraft,
  rememberPlanDraft,
  forgetPlanDraft,
  resumablePlanDraft,
} = createPlanEditorRepository({
  read: (key) => draftStorageIO.read(storageKey(key)),
  write: (key, value) => draftStorageIO.write(storageKey(key), value),
  remove: (key) => draftStorageIO.remove(storageKey(key)),
});
