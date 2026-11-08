import { draftStorageIO } from "@/src/features/beacons/creationDraftStorage";
import { createPlanEditorRepository } from "./planEditorRepository";
export { planDraftKey } from "./planEditorRepository";
export const {
  cachedPlanDraft,
  readPlanDraft,
  writePlanDraft,
  deletePlanDraft,
} = createPlanEditorRepository(draftStorageIO);
