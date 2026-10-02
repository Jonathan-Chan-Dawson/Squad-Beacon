import type { Data } from "@/src/shared/types";
import type { WidgetPreferences } from "@/src/features/widgets/types";

export function prepareWidgetAccount(_accountId: string): Promise<void> {
  return Promise.resolve();
}

export function clearWidgetContent(_forgetAccount = true): Promise<void> {
  return Promise.resolve();
}

export function syncWidgetPayload(
  _data: Data,
  _accountId: string,
  _preferences: WidgetPreferences,
): Promise<void> {
  return Promise.resolve();
}

export function clearWidgetSnapshotsOnly(): Promise<void> {
  return Promise.resolve();
}
