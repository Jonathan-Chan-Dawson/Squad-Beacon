export type WidgetAdviceEligibility = {
  isIOS: boolean;
  isExpoGo: boolean;
  hasRealAccount: boolean;
  dataLoaded: boolean;
  dataErrorFree: boolean;
  preferencesReady: boolean;
  preferencesErrorFree: boolean;
  widgetsEnabled: boolean;
  hasFriendsOrSquad: boolean;
};

export function isWidgetAdviceEligible(input: WidgetAdviceEligibility) {
  return (
    input.isIOS &&
    !input.isExpoGo &&
    input.hasRealAccount &&
    input.dataLoaded &&
    input.dataErrorFree &&
    input.preferencesReady &&
    input.preferencesErrorFree &&
    !input.widgetsEnabled &&
    input.hasFriendsOrSquad
  );
}
