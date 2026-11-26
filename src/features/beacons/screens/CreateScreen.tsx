import {resolveBeaconEntitlements,resolvePersonalEntitlements} from "@/src/shared/entitlements";
import {tierRank,premiumFeatures} from "@/src/shared/premiumFeatures";
import {toolFeature,type ToolSettings} from "../premiumTools";
import { readPlanDraft, writePlanDraft, planDraftKey } from "@/src/features/plans/planEditorStorage";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import { ActivityCategoryChoices } from "../components/ActivityCategoryChoices";
import { QuickQuest } from "../spontaneity/QuickQuest";
import { finishCreationPublicListing, type CreationPublicListing } from "../creationPublicListing";
import { CreationTimingFields } from "../components/CreationTimingFields";
import { CreationPicker } from "../components/CreationPicker";
import { ActionRow, ContextMenu } from "@/src/shared/ContextMenu";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import { ConfirmDialog } from "@/src/shared/Dialogs";
import { needsLargeInviteConfirmation } from "../createHandoff";
import { LinkedPlanningBeacon } from "@/src/features/planning/ConnectedPlanningActions";
import { saveComposerOption } from "@/src/features/planning/composerSession";
import {
  CreationPeople,
  type CreationPeoplePanel,
} from "../components/CreationPeople";
import { useCommunityTopics } from "@/src/features/discovery/useCommunityTopics";
import { BeaconMapIconEditor } from "../components/BeaconMapIconEditor";
import { CreationAppearance } from "../components/CreationAppearance";
import { rewardsHref } from "../rewardLooks";
import { BeaconCardArtwork, type BeaconArtworkStyle } from "../components/BeaconCardArtwork";
import { CreationDisclosure } from "../components/CreationDisclosure";
import { validCreationMeetingLink } from "../creationValidation";
import { BeaconIdentity } from "../components/BeaconIdentity";
import { validateActivity } from "@/src/shared/domain";
import {
  CreationRow,
  CreationSwitch,
  CreationModuleControls,
} from "../components/CreationControls";
import { creationModules } from "../creationModules";
import { runFrozenPublication, type FrozenPublication } from "../draftSnapshot";

import { activityNoteSeed } from "../livingActivity";
import { CreationLocationInput } from "../components/CreationLocationInput";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { Ellipsis } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { usesSharedStatusEditor } from "../statusRouteSeed";
import { LegacyStatusScreen } from "./LegacyStatusScreen";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pressable, Text, View, type TextInput } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  saveCreationDraft,
  restoreCreationDraft,
  setCreationDraftField,
  startCreationDraft,
  beginCreationLocationPick,
  usePlanningDraftState,
  usePlanningInvitees,
  planningDraftObject,
  hasPlanningDraftField,
  completePlanningDraft,
} from "../socialPlanningSession";

import { CreationInvitees } from "../components/feed/CreationInvitees";
import { CreateHome } from "@/src/features/beacons/CreateHome";
import { LoginToUse } from "@/src/features/auth/LoginToUse";
import { openGuestEntry } from "@/src/features/auth/guestEntry";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import type { BeaconDraft } from "@/src/features/planning/types";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import {
  beaconControlValuesFromActivity,
  defaultBeaconControlValues,
  validateBeaconControlValues,
  type BeaconControlValues,
} from "@/src/features/beacons/controls";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { readViewerDeviceDefaults } from "@/src/features/profile/settings/deviceDefaults";
import {
  resolveDefaultAudience,
  eligibleDefaultTargets,
} from "@/src/features/profile/settings/beaconDefaults";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { canViewProfile } from "@/src/features/profile/privacy";
import {
  atomicCreateAndInvite,
  createAndInvite,
  creationHandoffParams,
  creationStatusSeed,
  mergeCreationStatusSeed,
  newCreationInviteSession,
  parseCreationInvitees,
  validateCreationInvitees,
  type CreationInviteSession,
} from "@/src/features/beacons/createHandoff";
import { canReadSpace, activeSpaceRole } from "@/src/features/spaces/domain";
import {
  canReadOrganization,
  activeOrganizationRole,
} from "@/src/features/organizations/domain";
import type { SocialEntityType } from "@/src/features/social/types";
import type {
  Activity,
  Audience,
  BeaconModuleDefaults,
  Category,
} from "@/src/shared/types";

import {
  creationScheduleSummary,
  durationMinutesForLabel,
  fixedHalfHourStart,
  formatDurationLabel,
  resolveActivityEndAt,
  resolveCreationStartAt,
} from "@/src/features/beacons/createTiming";
import { beaconTemplateCatalog, templates, type BeaconTemplate } from "@/src/shared/templates";
import {
  Action,
  Button,
  Chips,
  Field,
  IconButton,
  Screen,
  Txt,
  useTheme,
} from "@/src/shared/ui";

function moduleDefaultsFromControls(
  controls: BeaconControlValues,
): BeaconModuleDefaults {
  return {
    enable_chat: controls.enable_chat,
    enable_checklist: controls.enable_checklist,
    enable_journal: controls.enable_journal,
    enable_experiences: controls.enable_experiences,
    enable_focus: controls.enable_focus,
    enable_scoreboard: controls.enable_scoreboard,
    enable_comments: controls.enable_comments,
    enable_music: controls.enable_music,
  };
}
const publicRecipes = [...templates, ...beaconTemplateCatalog];

function recipeModules(recipe: BeaconTemplate) {
  const modules = new Set(recipe.suggestedTools ?? []);
  return {
    enable_chat: modules.size === 0 || modules.has("chat"),
    enable_checklist: modules.has("checklist"),
    enable_journal: modules.has("notes"),
    enable_focus: modules.has("focus"),
    enable_experiences: modules.has("memories"),
    enable_scoreboard: modules.has("scoreboard"),
    enable_music: modules.has("music"),
  };
}

export default function CreateActivity({ templateBrowser = false }: { templateBrowser?: boolean } = {}) {
  const params = useLocalSearchParams();
  const { userId } = useBeacon();
  if (!userId) {
    const route = templateBrowser ? "/beacon-templates" : "/create";
    const routeParams = Object.fromEntries(
      Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    if (usesSharedStatusEditor(params) || [
      "editor", "resumeDraft", "repeat", "template", "editTemplate", "saveTemplate", "recipe",
      "savedChecklist", "planId", "threadId", "squadId", "spaceId", "organizationId",
    ].some((key) => routeParams[key]) || (routeParams.kind && routeParams.kind !== "beacon")) {
      return (
        <Screen title="Create" eyebrow="" compactHeader create={false}>
          <LoginToUse destination={route} params={routeParams} detail="Log in to continue creating." resumeCurrentPage />
        </Screen>
      );
    }
    const context = creationHandoffParams(params);
    const start = (extra: Record<string, string> = {}) =>
      openGuestEntry("/create", "create", undefined, { ...context, editor: "yes", ...extra });
    return (
      <CreateHome
        browserScreen={templateBrowser}
        context={context}
        onBlank={() => start()}
        onTemplate={(recipe) => start({ recipe: String(publicRecipes.indexOf(recipe)) })}
        onReuse={(id) => start({ repeat: id })}
      />
    );
  }
  if (typeof params.resumeDraft === "string")
    return (
      <RestoreDraft
        key={userId + params.resumeDraft}
        token={params.resumeDraft}
      />
    );
  if (usesSharedStatusEditor(params))
    return <LegacyStatusScreen params={params} />;
  return <CreateEditor templateBrowser={templateBrowser} key={userId + JSON.stringify(params)} />;
}

function RestoreDraft({ token }: { token: string }) {
  const { userId } = useBeacon();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (userId)
      void restoreCreationDraft(userId, token)
        .then((context) => {
          if (active)
            router.replace({
              pathname: "/create",
              params: { ...context, planSession: token, editor: "yes" },
            });
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "Draft could not be restored.",
            );
        });
    return () => {
      active = false;
    };
  }, [userId, token]);
  return (
    <Screen title="Continue Draft" eyebrow="" compactHeader>
      <Txt>{error || "Restoring your saved draft..."}</Txt>
      {error ? (
        <Button
          title="Back to Create"
          onPress={() => router.replace("/create")}
        />
      ) : null}
    </Screen>
  );
}

function CreationKeyboardScreen(props: React.ComponentProps<typeof Screen>) {
  return (
    <ChatKeyboardFrame compact>
      <Screen {...props} />
    </ChatKeyboardFrame>
  );
}

function CreateEditor({ templateBrowser = false }: { templateBrowser?: boolean } = {}) {
  const { styles, colors } = useTheme();

  const { data, userId, demo, act, getViewerEpoch } = useBeacon();
  const currentTime = useNow();
  const params = useLocalSearchParams<{
    kind?: string;
    editor?: string;
    planId?: string;
    planDraftKey?: string;
    planDraftStopId?: string;
    returnPlanId?: string;
    planStopId?: string;
    stopPosition?: string;
    stopAfterId?: string;
    threadId?: string;
    planningSessionId?: string;
    planningOptionId?: string;
    planningKind?: string;
    sourcePlanningId?: string;
    planningClaimToken?: string;
    planningProposalId?: string;
    planningSlotId?: string;
    squadId?: string;
    spaceId?: string;
    organizationId?: string;
    latitude?: string;
    longitude?: string;
    placeLabel?: string;
    repeat?: string;
    template?: string;
    recipe?: string;
    editTemplate?: string;
    saveTemplate?: string;
    savedChecklist?: string;
    inviteeIds?: string;
    planSession?: string;
    activityNoteId?: string;
    featureAfter?: string;
    statusSourceId?: string;
    startsAt?: string;
    fromMap?: string;
    timezone?: string;
  }>();
  const routeRecipe = typeof params.recipe === "string" && /^\d+$/.test(params.recipe)
    ? publicRecipes[Number(params.recipe)]
    : undefined;
  const planningSource = data.planning_threads.find(t=>t.id===params.sourcePlanningId);
  const allowedPlanningInvitees = planningSource ? data.planning_backup_invitees?.find(row=>row.thread_id===planningSource.id)?.user_ids ?? data.profiles.filter(p=>canReadPlanningThread(data,planningSource,p.id)).map(p=>p.id) : undefined;
  const [draftToken] = useState(
    () => params.planSession ?? startCreationDraft(userId),
  );
  let creationTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if (typeof params.timezone === "string" && params.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: params.timezone });
      creationTimezone = params.timezone;
    } catch {
      /* Invalid route zones retain the normal creation default. */
    }
  }
  const parsedInvitees = parseCreationInvitees(params.inviteeIds);
  const [inviteeIds, setInviteeIds] = usePlanningInvitees(
    userId,
    draftToken,
    parsedInvitees.ids,
  );
  const [inviteeError, setInviteeError] = useState(parsedInvitees.error);
  const [largeInviteSelection, setLargeInviteSelection] = useState<string[] | null>(null);
  const [statusSourceDismissed, setStatusSourceDismissed] =
    usePlanningDraftState(userId, draftToken, "statusSourceDismissed", false);
  const statusSourceId = statusSourceDismissed
    ? undefined
    : params.statusSourceId;
  const statusSeed = params.activityNoteId
    ? activityNoteSeed(data, userId, params.activityNoteId, currentTime)
    : creationStatusSeed(data, userId, statusSourceId, currentTime);
  const dataRef = useRef(data);
  useLayoutEffect(() => {
    dataRef.current = data;
  }, [data]);
  const [initialInvitationSession] = useState(() =>
    planningDraftObject(
      userId,
      draftToken,
      "invitationSession",
      newCreationInviteSession,
    ),
  );
  const invitationSession = useRef(initialInvitationSession);
  const [createdSession, setCreatedSession] =
    useState<CreationInviteSession | null>(() =>
      initialInvitationSession.atomicAttempt ||
      initialInvitationSession.createdId ||
      initialInvitationSession.creationUnverified
        ? { ...initialInvitationSession }
        : null,
    );
  const [retryBusy, setRetryBusy] = useState(false);
  const retryBusyRef = useRef(false);
  const [templateNotice, setTemplateNotice] = useState("");
  const [workflowError, setWorkflowError] = useState("");
  const sourceError =
    statusSourceId && !statusSeed
      ? "This status is no longer available. Clear the status source to continue with a new Beacon."
      : "";
  const handoff = creationHandoffParams({
    ...params,
    inviteeIds: inviteeError ? params.inviteeIds : JSON.stringify(inviteeIds),
    statusSourceId,
  });
  const inviteeLabel = (id: string) => {
    const profile = data.profiles.find((person) => person.id === id);
    return userId &&
      data.viewer_id === userId &&
      (!createdSession || createdSession.viewerId === userId) &&
      profile &&
      canViewProfile(data, profile, userId)
      ? profile.name
      : "Unavailable friend";
  };
  const controlsRouteKey = JSON.stringify([
    params.kind ?? null,
    params.squadId ?? null,
    params.spaceId ?? null,
    params.organizationId ?? null,
    params.repeat ?? null,
    params.template ?? null,
    params.editTemplate ?? null,
    params.saveTemplate ?? null,
  ]);
  const saved = data.templates.find(
    (t) => t.id === params.template && t.owner_id === userId,
  );
  const templateEditor =
    params.editTemplate === "yes" || params.saveTemplate === "yes";
  const previous = statusSourceId
    ? undefined
    : data.activities.find(
        (a) =>
          a.id === params.repeat &&
          a.owner_id === userId &&
          data.viewer_id === userId &&
          a.mode !== "solo",
      );
  const associationCandidates =
    userId && data.viewer_id === userId
      ? [
          ...data.squads
            .filter((squad) => canOpenSquadProfile(data, squad.id, userId))
            .map((squad) => ({
              entity_type: "squad" as const,
              entity_id: squad.id,
              name: squad.name,
              joined: data.squad_members.some(
                (member) =>
                  member.squad_id === squad.id && member.user_id === userId,
              ),
            })),
          ...data.spaces
            .filter(
              (space) =>
                canReadSpace(data, space.id, userId) &&
                !!activeSpaceRole(space, data.space_members, userId),
            )
            .map((space) => ({
              entity_type: "space" as const,
              entity_id: space.id,
              name: space.name,
              joined: true,
            })),
          ...data.organizations
            .filter(
              (organization) =>
                canReadOrganization(data, organization.id, userId) &&
                !!activeOrganizationRole(
                  organization,
                  data.organization_members,
                  userId,
                ),
            )
            .map((organization) => ({
              entity_type: "organization" as const,
              entity_id: organization.id,
              name: organization.name,
              joined: true,
            })),
        ].sort((first, second) => first.name.localeCompare(second.name))
      : [];
  const associationRouteSeed = params.organizationId
    ? { entity_type: "organization" as const, entity_id: params.organizationId }
    : params.spaceId
      ? { entity_type: "space" as const, entity_id: params.spaceId }
      : params.squadId
        ? { entity_type: "squad" as const, entity_id: params.squadId }
        : null;
  const associationRouteKey = JSON.stringify([
    params.squadId ?? null,
    params.spaceId ?? null,
    params.organizationId ?? null,
  ]);
  const [associationDraft, setAssociationDraft] = usePlanningDraftState<{
    routeKey: string;
    value: { entity_type: SocialEntityType; entity_id: string } | null;
  }>(userId, draftToken, "associationDraft", () => ({
    routeKey: associationRouteKey,
    value: associationRouteSeed,
  }));
  const selectedAssociation =
    associationDraft.routeKey === associationRouteKey
      ? associationDraft.value
      : associationRouteSeed;
  const selectedAssociationRow = selectedAssociation
    ? associationCandidates.find(
        (row) =>
          row.entity_type === selectedAssociation.entity_type &&
          row.entity_id === selectedAssociation.entity_id,
      )
    : undefined;
  const routePlan = data.plans.find((item) => item.id === params.planId);
  const routeDecision = data.planning_threads.find(
    (item) => item.id === params.threadId,
  );
  const routeStart = routeDecision
    ? Date.parse(routeDecision.deadline_at) + 3600000
    : routePlan
      ? Math.max(
          currentTime + 1800000,
          ...data.activities
            .filter(
              (item) =>
                item.plan_id === routePlan.id &&
                item.plan_started_at !== null &&
                item.plan_step?.end_mode !== "manual",
            )
            .map((item) => Date.parse(item.ends_at)),
        )
      : params.startsAt && Number.isFinite(Date.parse(params.startsAt))
        ? Date.parse(params.startsAt)
        : currentTime;
  const aspirations =
    data.profiles.find((p) => p.id === userId)?.aspiration_goals ?? [];
  const currentAspirationIds = new Set(
    aspirations.map((aspiration) => aspiration.id),
  );
  const [home, setHome] = usePlanningDraftState(
    userId,
    draftToken,
    "home",
    !params.editor &&
      !params.template &&
      !params.repeat &&
      !params.editTemplate &&
      !params.saveTemplate &&
      !params.savedChecklist &&
      !params.planId &&
      !params.threadId &&
      !params.squadId &&
      !params.spaceId &&
      !params.organizationId &&
      (!params.kind || params.kind === "beacon"),
  );
  const [addTo, setAddTo] = usePlanningDraftState(
    userId,
    draftToken,
    "addTo",
    params.threadId ? "Vote / Draw" : params.planId ? "Plan" : "Standalone",
  );
  const [decisionKind, setDecisionKind] = usePlanningDraftState(
    userId,
    draftToken,
    "decisionKind",
    "Vote",
  );
  const [decisionTitle, setDecisionTitle] = usePlanningDraftState(
    userId,
    draftToken,
    "decisionTitle",
    "",
  );
  const [decisionId, setDecisionId] = usePlanningDraftState(
    userId,
    draftToken,
    "decisionId",
    params.threadId ?? "",
  );
  const [selectedPlanId, setSelectedPlanId] = usePlanningDraftState(
    userId,
    draftToken,
    "selectedPlanId",
    params.planId ?? "",
  );
  const [planPosition, setPlanPosition] = usePlanningDraftState(
    userId,
    draftToken,
    "planPosition",
    "End",
  );
  const decisions = data.planning_threads.filter(
    (thread) =>
      thread.kind !== "ping" &&
      thread.status === "open" &&
      Date.parse(thread.deadline_at) > currentTime &&
      canReadPlanningThread(data, thread, userId ?? ""),
  );
  const decision = data.planning_threads.find(
    (thread) => thread.id === decisionId,
  );
  const ownPlans = data.plans.filter(
    (plan) => plan.owner_id === userId && plan.status === "scheduled",
  );
  const [timing, setTiming] = useState(false);
  const [timingErrors, setTimingErrors] = useState({ start: false, end: false, order: false, duration: false });
  const dateError = timingErrors.start || timingErrors.end
    ? "Choose a valid start and end time."
    : timingErrors.order
      ? "The end time must be at least one minute after the start time."
      : "";
  const durationError = timingErrors.duration ? "Enter a valid duration." : "";
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBackground, setPreviewBackground] = useState<BeaconArtworkStyle>("Constellation");
  const [peoplePanel, setPeoplePanel] = useState<CreationPeoplePanel>("none");
  const [selectedRecipe, setSelectedRecipe] =
    usePlanningDraftState<BeaconTemplate | null>(
      userId,
      draftToken,
      "selectedRecipe",
      routeRecipe ?? null,
    );
  const [prepAnswers, setPrepAnswers] = usePlanningDraftState<string[]>(
    userId,
    draftToken,
    "prepAnswers",
    routeRecipe?.prepPrompts?.map(() => "") ?? [],
  );
  const [kind] = usePlanningDraftState(
    userId,
    draftToken,
    "kind",
    params.kind === "status"
      ? "Status"
      : params.kind === "squad"
        ? "Squad"
        : "Beacon",
  );
  const [title, setTitle] = usePlanningDraftState(
    userId,
    draftToken,
    "title",
    statusSeed?.title ?? saved?.title ?? previous?.title ?? routeRecipe?.title ?? "",
  );
  const [description, setDescription] = usePlanningDraftState(
    userId,
    draftToken,
    "description",
    statusSeed?.description ??
      saved?.description ??
      previous?.description ??
      routeRecipe?.description ??
      "",
  );
  const [templateName, setTemplateName] = usePlanningDraftState(
    userId,
    draftToken,
    "templateName",
    saved?.name ?? previous?.title ?? "",
  );
  const [available] = usePlanningDraftState(
    userId,
    draftToken,
    "available",
    false,
  );
  const [category, setCategory] = usePlanningDraftState<Category>(
    userId,
    draftToken,
    "category",
    statusSeed?.category ?? saved?.category ?? previous?.category ?? routeRecipe?.category ?? "Social",
  );
  const sourceHydrated = useRef(!!statusSeed);
  const textEdited = useRef({
    title: false,
    description: false,
    category: false,
  });
  useEffect(() => {
    if (!statusSeed || sourceHydrated.current) return;
    const seeded = mergeCreationStatusSeed(
      { title, description, category },
      statusSeed,
      textEdited.current,
    );
    setTitle(seeded.title);
    setDescription(seeded.description);
    setCategory(seeded.category as Category);
    sourceHydrated.current = true;
  }, [
    statusSeed,
    title,
    description,
    category,
    setTitle,
    setDescription,
    setCategory,
  ]);
  const audienceEdited = useRef(
    hasPlanningDraftField(userId, draftToken, "audience"),
  );
  const appliedDeviceDefault = useRef<string | null>(null);
  const [defaultNotice, setDefaultNotice] = useState("");
  const [audience, setAudienceValue] = usePlanningDraftState<Audience>(
    userId,
    draftToken,
    "audience",
    routeDecision
      ? routeDecision.audience
      : routePlan
        ? routePlan.squad_id
          ? "squad"
          : "private"
        : params.organizationId
          ? "organization"
          : params.kind === "squad"
            ? "squad"
            : (data.profiles.find((p) => p.id === userId)?.default_audience ??
              "friends"),
  );
  const [audienceId, setAudienceId] = usePlanningDraftState<string | null>(
    userId,
    draftToken,
    "audienceId",
    routeDecision?.audience_id ??
      routePlan?.squad_id ??
      params.organizationId ??
      params.squadId ??
      null,
  );
  const setAudience = (value: Audience) => {
    audienceEdited.current = true;
    setDefaultNotice("");
    setAudienceValue(value);
  };
  useEffect(() => {
    if (
      !userId ||
      data.viewer_id !== userId ||
      params.planId ||
      params.threadId ||
      params.kind ||
      params.squadId ||
      params.organizationId ||
      params.spaceId ||
      saved ||
      previous ||
      templateEditor || params.planDraftKey
    )
      return;
    const key = `${userId}:${controlsRouteKey}`;
    if (appliedDeviceDefault.current === key || audienceEdited.current) return;
    let active = true;
    // Device storage is an external source. Apply its initial audience once;
    // never replace an audience the viewer has already chosen in this draft.
    void readViewerDeviceDefaults(userId)
      .then((preferences) => {
        if (!active || audienceEdited.current) return;
        const resolved = resolveDefaultAudience(data, userId, preferences);
        appliedDeviceDefault.current = key;
        setAudienceValue(resolved.audience);
        setAudienceId(resolved.audienceId);
        if (resolved.fellBack)
          setDefaultNotice(
            "Your saved audience target is no longer available. Using your account default.",
          );
      })
      .catch(() => {
        if (active)
          setDefaultNotice(
            "This device’s default could not be loaded. Using your account default.",
          );
      });
    return () => {
      active = false;
    };
  }, [
    userId,
    data,
    params.planDraftKey,
    params.kind,
    params.squadId,
    params.organizationId,
    params.spaceId,
    params.planId,
    params.threadId,
    saved,
    previous,
    templateEditor,
    controlsRouteKey,
    setAudienceValue,
    setAudienceId,
  ]);
  const [target] = usePlanningDraftState(
    userId,
    draftToken,
    "target",
    saved?.target_count ? String(saved.target_count) : "",
  );
  const [approval, setApproval] = usePlanningDraftState(
    userId,
    draftToken,
    "approval",
    saved?.approval_required ? "Host approval" : "Open joining",
  );
  const [when, setWhen] = usePlanningDraftState(
      userId,
      draftToken,
      "when",
      params.threadId ||
        params.planId ||
        (params.startsAt && Number.isFinite(Date.parse(params.startsAt)))
        ? "Pick time"
        : "Now",
    ),
    [duration, setDuration] = usePlanningDraftState(
      userId,
      draftToken,
      "duration",
      formatDurationLabel(saved?.minutes ?? routeRecipe?.minutes ?? 60),
    );
  const [starts, setStarts] = usePlanningDraftState(
    userId,
    draftToken,
    "starts",
    () => new Date(routeStart).toISOString(),
  );
  const [ends, setEnds] = usePlanningDraftState(
    userId,
    draftToken,
    "ends",
    () => new Date(routeStart + (saved?.minutes ?? routeRecipe?.minutes ?? 60) * 60000).toISOString(),
  );
  const [label, setLabel] = usePlanningDraftState(
    userId,
    draftToken,
    "label",
    params.placeLabel ??
      (params.activityNoteId && statusSeed ? data.places.find(place => place.activity_id === params.activityNoteId)?.label : undefined) ??
      (previous
        ? data.places.find((place) => place.activity_id === previous.id)?.label
        : undefined) ??
      saved?.label ??
      "",
  );
  const [placeType, setPlaceType] = usePlanningDraftState(
      userId,
      draftToken,
      "placeType",
      "In person",
    ),
    [url, setUrl] = usePlanningDraftState(userId, draftToken, "url", "");
  const [pin, setPin] = usePlanningDraftState<{
    latitude: number;
    longitude: number;
  } | null>(userId, draftToken, "pin", () => {
    if (params.latitude == null || params.longitude == null) {
      const place = previous
        ? data.places.find((place) => place.activity_id === previous.id)
        : undefined;
      return place?.latitude != null && place.longitude != null
        ? { latitude: place.latitude, longitude: place.longitude }
        : null;
    }
    const latitude = Number(params.latitude),
      longitude = Number(params.longitude);
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
      ? { latitude, longitude }
      : null;
  });
  const [reuseReviewed, setReuseReviewed] = usePlanningDraftState(
    userId,
    draftToken,
    "reuseReviewed",
    false,
  );
  const [toolsOpen, setToolsOpen] = useState(false);
  const [premiumAppearance,setPremiumAppearance]=usePlanningDraftState<ToolSettings|null>(userId,draftToken,"premiumAppearance",(planningDraftObject(userId,draftToken,"planBeaconPayload",()=>({})) as {premium_appearance?:ToolSettings}).premium_appearance??saved?.premium_appearance??null);
  const appearanceContext=resolveBeaconEntitlements(data,{id:"draft-premium",owner_id:userId??"",audience,audience_id:audienceId} as Activity);
  const personalAppearance=resolvePersonalEntitlements(data,userId);
  const appearanceTier=templateEditor?personalAppearance.tier:appearanceContext.tier;
  const canUseAppearance=(data.is_demo||data.capabilities?.advanced_beacon_tools===true)&&appearanceTier!=="free";
  const appearanceAllowed=!premiumAppearance||tierRank(appearanceTier)>=tierRank(premiumFeatures[toolFeature("appearance",premiumAppearance)].tier);
  const [allAspirations, setAllAspirations] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const headerAnchor = useRef<View>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const savingDraftRef = useRef(false);
  const capacityInput = useRef<TextInput>(null),
    listingInput = useRef<TextInput>(null),
    descriptionInput = useRef<TextInput>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [scrollRequest, setScrollRequest] = useState<{
    y: number;
    sequence: number;
  }>();
  const scrollSequence = useRef(0);
  function recordSection(key: string, y: number) {
    sectionY.current[key] = y;
  }
  function reveal(
    section: "people" | "modules" | "description" | "timing",
    input?: React.RefObject<TextInput | null>,
    panel: CreationPeoplePanel = input ? "joining" : "visibility",
  ) {
    if (section === "people") setPeoplePanel(panel);
    if (section === "modules") setToolsOpen(true);
    if (section === "description") setDescriptionOpen(true);
    if (section === "modules") return;
    requestAnimationFrame(() => {
      setScrollRequest({
        y: sectionY.current[section] ?? 0,
        sequence: ++scrollSequence.current,
      });
      if (input) requestAnimationFrame(() => input.current?.focus());
    });
  }
  const titleInput = useRef<TextInput>(null);
  const locationInput = useRef<TextInput>(null);
  const [destination, setDestination] = useState<
    | { kind: "Plan"; id: string; position: string }
    | { kind: "Vote / Draw"; id: string; voteKind: string; title: string }
    | null
  >(null);
  const stagedPlan = destination?.kind === "Plan"
    ? ownPlans.find((item) => item.id === destination.id)
    : undefined;
  const stagedPlanStops = stagedPlan
    ? data.activities.filter((item) => item.plan_id === stagedPlan.id)
    : [];
  const stagedDecision = destination?.kind === "Vote / Draw"
    ? decisions.find((item) => item.id === destination.id)
    : undefined;
  const routeDestination = !!(params.planId || params.threadId || params.planningOptionId || params.planDraftKey);
  const closeDestination = () => setDestination(null);
  function openPlan() {
    setDestination({ kind: "Plan", id: selectedPlanId, position: planPosition });
  }
  function openDecision() {
    setDestination({ kind: "Vote / Draw", id: decisionId, voteKind: decisionKind, title: decisionTitle });
  }
  function applyDestination() {
    if (!destination) return;
    if (destination.kind === "Plan") {
      if (!stagedPlan) return;
      setSelectedPlanId(stagedPlan.id);
      setPlanPosition(destination.position);
      setAudience(stagedPlan.squad_id ? "squad" : "private");
      setAudienceId(stagedPlan.squad_id);
    } else {
      if (inviteeIds.length || inviteeError || (destination.id && !stagedDecision)) return;
      setDecisionId(destination.id);
      setDecisionKind(destination.voteKind);
      setDecisionTitle(destination.title);
      if (stagedDecision) {
        setAudience(stagedDecision.audience);
        setAudienceId(stagedDecision.audience_id);
      }
    }
    setWorkflowError("");
    setAddTo(destination.kind);
    closeDestination();
  }
  function removeDestination() {
    setSelectedPlanId("");
    setPlanPosition("End");
    setDecisionId("");
    setAddTo("Standalone");
    setWorkflowError("");
  }
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [aspirationQuery, setAspirationQuery] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [fieldError, setFieldError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const [pendingPublication, setPendingPublication] =
    usePlanningDraftState<FrozenPublication | null>(
      userId,
      draftToken,
      "pendingPublication",
      null,
    );
  const [publicListing, setPublicListing] = usePlanningDraftState<CreationPublicListing>(userId, draftToken, "publicListing", () => ({ enabled: false, area: "" }));
  const [publicWorking, setPublicWorking] = useState(false);
  const publicEligible = kind !== "Status" && audience !== "organization" && !templateEditor && addTo !== "Vote / Draw" && !params.planningOptionId;
  async function applyPublicListing(id: string) {
    if (!publicListing.enabled || !userId) return;
    const epoch = getViewerEpoch();
    setPublicWorking(true);
    try {
      await finishCreationPublicListing(publicListing, userId, id, placeType === "In person" ? pin : null,
        () => getViewerEpoch() === epoch && dataRef.current.viewer_id === userId,
        async () => { setCreationDraftField(userId, draftToken, "publicListing", publicListing); setPublicListing({ ...publicListing }); await checkpoint(); },
        (value, requestId) => act("publish_beacon_discovery", { ...value }, requestId), randomUUID);
    } finally { if (epoch === getViewerEpoch()) setPublicWorking(false); }
  }
  function finishCreatedFlow(id: string) {
    completePlanningDraft(userId, draftToken);
    const planId = params.returnPlanId || (addTo === "Plan" ? selectedPlanId : undefined);
    if (planId) router.dismissTo({ pathname: "/plan/[id]", params: { id: planId } });
    else if (params.sourcePlanningId) router.replace({ pathname: "/activity/[id]", params: { id } });
    else router.replace({ pathname: "/activity-created", params: { id, type: "beacon" } });
  }
  const publicationBusy = useRef(false);
  const [beaconControlDraft, setBeaconControlDraft] = usePlanningDraftState<{
    routeKey: string;
    value: BeaconControlValues;
  }>(userId, draftToken, "beaconControlDraft", () => ({
    routeKey: controlsRouteKey,
    value: params.planDraftKey
      ? { ...defaultBeaconControlValues(), ...planningDraftObject(userId,draftToken,"planBeaconPayload",()=>({})) }
      : saved?.module_defaults
      ? { ...defaultBeaconControlValues(), ...saved.module_defaults }
      : previous
        ? {
            ...beaconControlValuesFromActivity(previous),
            capacity_limit: null,
            capacity_policy: "soft" as const,
            manual_closed: false,
            checklist_edit_policy: "participants" as const,
          }
        : { ...defaultBeaconControlValues(), ...(routeRecipe && recipeModules(routeRecipe)) },
  }));
  const [mapIcon, setMapIcon] = usePlanningDraftState<string | null>(userId, draftToken, "mapIcon", null);
  const [mapIconPublic, setMapIconPublic] = usePlanningDraftState(userId, draftToken, "mapIconPublic", false);
  const mapIconEditor = kind !== "Status" && (demo || data.capabilities?.beacon_map_icons) ? (
    <BeaconMapIconEditor category={category} value={mapIcon} shared={mapIconPublic}
      onChange={(value, shared) => { setMapIcon(value); setMapIconPublic(shared); }} />
  ) : null;
  const { rows: communityTopics, ready: communityTopicsReady } = useCommunityTopics(selectedAssociationRow?.entity_type, selectedAssociationRow?.entity_id);
  const [draftTopic, setDraftTopic] = usePlanningDraftState<{ id: string; type: string; community: string } | null>(userId, draftToken, "beaconTopic", null);
  const scopedTopic = draftTopic?.community === selectedAssociationRow?.entity_id && draftTopic?.type === selectedAssociationRow?.entity_type ? draftTopic : null;
  const beaconControls =
    beaconControlDraft.routeKey === controlsRouteKey
      ? beaconControlDraft.value
      : defaultBeaconControlValues();
  const setBeaconControls = (value: BeaconControlValues) =>
    setBeaconControlDraft({ routeKey: controlsRouteKey, value });
  const [aspirationIds, setAspirationIds] = usePlanningDraftState<string[]>(
    userId,
    draftToken,
    "aspirationIds",
    () => ([] as string[]).filter((id) => currentAspirationIds.has(id)),
  );
  function applyTemplate(t: BeaconTemplate) {
    if (!statusSeed) {
      setTitle(t.title);
      setCategory(t.category);
      setDescription(t.description ?? "");
    }
    setSelectedRecipe(t);
    setPrepAnswers(t.prepPrompts?.map(() => "") ?? []);
    setDuration(formatDurationLabel(t.minutes));
    setEnds(new Date(Date.parse(starts) + t.minutes * 60000).toISOString());
    setBeaconControls({
      ...beaconControls,
      ...recipeModules(t),
    });
  }
  function descriptionWithPrep() {
    const answers = (selectedRecipe?.prepPrompts ?? []).flatMap(
      (prompt, index) => {
        const answer = prepAnswers[index]?.trim();
        return answer ? [`${prompt}\n${answer}`] : [];
      },
    );
    return [description.trim(), ...answers].filter(Boolean).join("\n\n");
  }
  function effectiveStartAt(now = currentTime) {
    return resolveCreationStartAt(when, starts, now);
  }
  function chooseStart(at: number, choice: string) {
    const minutes = durationMinutesForLabel(duration, starts, ends);
    if (duration === "Custom" && minutes > 0) setDuration(formatDurationLabel(minutes));
    setStarts(new Date(at).toISOString());
    setWhen(choice === "Choose date" ? "Pick time" : choice === "In 30 min" ? fixedHalfHourStart : choice);
    setTimingErrors((current) => ({ ...current, start: false, end: false, order: false }));
  }
  function changeDuration(minutes: number) {
    const valid = Number.isInteger(minutes) && minutes > 0 &&
      Number.isFinite(new Date(effectiveStartAt() + minutes * 60000).getTime());
    setTimingErrors((current) => ({ ...current, duration: !valid, order: valid ? false : current.order }));
    if (valid) setDuration(formatDurationLabel(minutes));
  }
  function chooseEnd(value: string) {
    const start = effectiveStartAt();
    if (Date.parse(value) - start < 60000) {
      setTimingErrors((current) => ({ ...current, order: true }));
      return false;
    }
    if (when === "Now" || when === "In 30 min") {
      setStarts(new Date(start).toISOString());
      setWhen("Pick time");
    }
    setEnds(value);
    setDuration("Custom");
    setTimingErrors((current) => ({ ...current, order: false, duration: false }));
    return true;
  }
  function checkTiming() {
    const start = effectiveStartAt();
    const end = Date.parse(resolveActivityEndAt(start, duration, ends));
    if (!dateError && !durationError && end > start) return true;
    if (!(end > start)) setTimingErrors((current) => ({ ...current, order: true }));
    if (dateError || !(end > start)) setTiming(true);
    reveal("timing");
    return false;
  }
  async function saveTemplate() {
    if (!checkTiming()) return;
    const templateDescription = descriptionWithPrep();
    if (templateDescription.length > 1000)
      throw new Error(
        `Combined details are ${templateDescription.length}/1000 characters. Shorten the description or template answers before saving.`,
      );
    const minutes = durationMinutesForLabel(duration, starts, ends);
    if (!templateName.trim() || !title.trim())
      throw new Error("Give your template a name and activity.");
    await act("save_template", {
      id: templateEditor ? saved?.id : undefined,
      name: templateName.trim(),
      title: title.trim(),
      description: templateDescription,
      category,
      minutes,
      label: label.trim(),
      target_count: target.trim() ? Number(target) : null,
      approval_required: approval === "Host approval",
      module_defaults: moduleDefaultsFromControls(beaconControls),
      ...(premiumAppearance&&tierRank(personalAppearance.tier)>=tierRank(premiumFeatures[toolFeature("appearance",premiumAppearance)].tier)?{premium_appearance:premiumAppearance}:{}),
    });
    if (
      !templateEditor ||
      inviteeIds.length ||
      inviteeError ||
      statusSourceId
    ) {
      setTemplateNotice(
        "Template saved. Your Beacon draft and selected friends are still here.",
      );
      return;
    }
    router.replace("/your-activity?historyExpanded=yes" as Href);
  }
  const checkpoint = () =>
    saveCreationDraft(
      userId,
      draftToken,
      Object.fromEntries(
        Object.entries(params).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    );
  async function saveDraft() {
    if (savingDraftRef.current) return;
    savingDraftRef.current = true;
    setSavingDraft(true);
    setSaveNotice("");
    const epoch = getViewerEpoch();
    try {
      setCreationDraftField(userId, draftToken, "home", false);
      await checkpoint();
      if (getViewerEpoch() !== epoch || dataRef.current.viewer_id !== userId)
        return;
      router.replace({
        pathname: "/create",
        params: { savedDraft: draftToken },
      });
    } catch (error) {
      if (getViewerEpoch() === epoch)
        setSaveNotice(
          error instanceof Error
            ? error.message
            : "Draft could not be saved. Keep this editor open and try again.",
        );
    } finally {
      savingDraftRef.current = false;
      if (getViewerEpoch() === epoch) setSavingDraft(false);
    }
  }
  async function durableAction(
    action: string,
    payload: Record<string, unknown> = {},
    requestId?: string,
  ) {
    if (!userId || dataRef.current.viewer_id !== userId)
      throw new Error(
        "Your account changed. Return to the account that started this draft.",
      );
    const requestEpoch = getViewerEpoch();
    const stored = planningDraftObject<FrozenPublication | null>(
      userId,
      draftToken,
      "pendingPublication",
      () => null,
    );
    if (stored && !stored.result && stored.action !== action)
      throw new Error(
        "Confirm the saved publication before starting another operation.",
      );
    const attempt =
      stored && stored.action === action
        ? stored
        : {
            action,
            payload: structuredClone({ ...payload, expected_actor_id: userId }),
            requestId: requestId ?? randomUUID(),
            viewer: userId,
          };
    setCreationDraftField(userId, draftToken, "pendingPublication", attempt);
    try {
      const result = await runFrozenPublication(
        attempt,
        userId,
        checkpoint,
        async (a, p, id) => {
          if (
            dataRef.current.viewer_id !== userId ||
            getViewerEpoch() !== requestEpoch
          )
            throw new Error("Your account changed before publication.");
          const result = await act(a, p, id);
          if (
            dataRef.current.viewer_id !== userId ||
            getViewerEpoch() !== requestEpoch
          )
            throw new Error(
              "Your account changed while confirming publication. Return to the original account.",
            );
          return result;
        },
      );
      setPendingPublication(null);
      setCreationDraftField(userId, draftToken, "pendingPublication", null);
      return result;
    } catch (error) {
      if (
        (error as { definitive?: boolean })?.definitive === true &&
        !(error instanceof Error && /account changed/i.test(error.message))
      ) {
        setPendingPublication(null);
        setCreationDraftField(userId, draftToken, "pendingPublication", null);
        await checkpoint();
      } else setPendingPublication({ ...attempt });
      throw error;
    }
  }
  async function submit(largeBatchConfirmed = false) {
    if (!checkTiming()) return;
    if (!params.planDraftKey && !largeBatchConfirmed && needsLargeInviteConfirmation(inviteeIds) && !invitationSession.current.atomicAttempt) {
      setLargeInviteSelection([...inviteeIds]);
      return;
    }
    if (publicationBusy.current) return;
    publicationBusy.current = true;
    setFieldError(null);
    try {
      await publish(resolveCreationStartAt(when, starts));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not publish this Beacon.";
      setWorkflowError(message);
      setFieldError({
        field:
          /public listing/i.test(message) ? "people" :
          /capacity|spots|limit|approval|audience|share with|friend|eligible|community/i.test(
            message,
          )
            ? "people"
            : /music/i.test(message)
              ? "modules"
              : /description|details|characters/i.test(message)
                ? "description"
                : /end time|start time|duration|future time|deadline/i.test(message)
                  ? "timing"
                  : "publication",
        message,
      });
      if (/public listing/i.test(message))
        reveal("people", publicEligible ? listingInput : undefined, "listing");
      else if (
        /capacity|spots|limit|approval|audience|share with|friend|eligible|community/i.test(message)
      )
        reveal(
          "people",
          /capacity|spots|limit/i.test(message) ? capacityInput : undefined,
          /community/i.test(message)
            ? "community"
            : /capacity|spots|limit|approval/i.test(message)
              ? "joining"
              : "visibility",
        );
      else if (
        /end time|start time|duration|future time|deadline/i.test(message)
      ) {
        setTiming(true);
        reveal("timing");
      } else if (/music/i.test(message)) reveal("modules");
      else if (/description|details|characters/i.test(message))
        reveal("description", descriptionInput);
      throw error;
    } finally {
      publicationBusy.current = false;
    }
  }
  async function publish(start: number) {
    if (
      invitationSession.current.createdId ||
      invitationSession.current.creationUnverified
    )
      throw new Error(
        "This Beacon has already been created. Use Retry invitations or Open Beacon.",
      );
    if (pendingPublication)
      throw new Error(
        "Confirm the pending publication before creating another Beacon.",
      );
    if (publicListing.enabled && (!publicEligible || !publicListing.area.trim() || publicListing.area.trim().length > 120)) throw new Error("Review Public listing: choose an eligible Beacon and a city or general area (up to 120 characters).");
    if (previous && !reuseReviewed) {
      reveal("people");
      throw new Error(
        "Review the reused location and People & Access, then confirm your review before creating.",
      );
    }
    if (inviteeError) throw new Error(inviteeError);
    if (sourceError) throw new Error(sourceError);
    if (
      userId &&
      ["list", "squad", "organization"].includes(audience) &&
      !eligibleDefaultTargets(dataRef.current, userId, audience).some(
        (row) => row.id === audienceId,
      )
    ) {
      reveal("people");
      throw new Error(
        "This audience is no longer available. Choose an eligible audience before publishing.",
      );
    }
    if (inviteeIds.length && (kind === "Status" || addTo === "Vote / Draw"))
      throw new Error(
        "Selected friends can be invited to a Beacon. Clear the selected friends before sharing a status or submitting a Vote / Draw proposal.",
      );
    if (inviteeIds.length)
      validateCreationInvitees(dataRef.current, userId, inviteeIds);
    if (!title.trim()) {
      titleInput.current?.focus();
      setFieldError({ field: "title", message: "Give your Beacon a title." });
      throw new Error("Give your Beacon a title.");
    }
    if (
      kind !== "Status" &&
      addTo !== "Vote / Draw" &&
      !params.planningOptionId && !params.planDraftKey &&
      placeType === "In person" &&
      !pin
    ) {
      setFieldError({
        field: "location",
        message: "Choose a place or a point on the Map.",
      });
      locationInput.current?.focus();
      throw new Error("Choose a place or a point on the Map.");
    }
    if (
      kind !== "Status" &&
      addTo !== "Vote / Draw" &&
      !params.planningOptionId &&
      !params.planDraftKey && placeType === "Online" &&
      !validCreationMeetingLink(url)
    ) {
      setFieldError({
        field: "location",
        message: "Enter a secure meeting link beginning with https://.",
      });
      throw new Error("Enter a secure meeting link beginning with https://.");
    }
    const finalDescription = descriptionWithPrep();
    const controls =
      kind === "Status"
        ? null
        : validateBeaconControlValues({ ...beaconControls });
    if (finalDescription.length > 2000)
      throw new Error(
        `Combined details are ${finalDescription.length}/2000 characters. Shorten the description or template answers before publishing.`,
      );
    if (kind !== "Status" && scopedTopic && !communityTopicsReady)
      throw new Error("Wait for the selected community topic to load.");
    if (kind !== "Status" && scopedTopic && !communityTopics.some(row => row.id === scopedTopic.id))
      throw new Error("This topic is unavailable. Choose another topic or publish without it.");
    const payload = {
      ...(kind !== "Status" && scopedTopic ? { beacon_topic_id: scopedTopic.id } : {}),
      template_source_id: saved
        ? `mine:${saved.id}`
        : selectedRecipe?.id
          ? `app:${selectedRecipe.id}`
          : null,
      title: title.trim(),
      description: finalDescription,
      available: kind === "Status" && available,
      category,
      mode: kind === "Status" ? "solo" : "squad",
      starts_at: new Date(start).toISOString(),
      ends_at: resolveActivityEndAt(start, duration, ends),
      timezone: creationTimezone,
      audience,
      audience_id: audienceId,
      ...(selectedAssociationRow
        ? {
            social_entity_type: selectedAssociationRow.entity_type,
            social_entity_id: selectedAssociationRow.entity_id,
          }
        : {}),
      target_count: kind === "Status" || !target.trim() ? null : Number(target),
      approval_required: kind !== "Status" && approval === "Host approval",
      aspiration_ids: aspirationIds.filter((id) =>
        currentAspirationIds.has(id),
      ),
      label: label.trim(),
      online_url: placeType === "Online" ? url.trim() : null,
      latitude: placeType === "In person" ? (pin?.latitude ?? null) : null,
      longitude: placeType === "In person" ? (pin?.longitude ?? null) : null,
      ...(controls ?? {}),
      ...(kind !== "Status" && mapIcon && (demo || data.capabilities?.beacon_map_icons)
        ? { map_icon: mapIcon, map_icon_public: mapIconPublic }
        : {}),
      ...(kind!=="Status"&&premiumAppearance&&appearanceAllowed?{premium_appearance:premiumAppearance}:{}),
      ...(params.savedChecklist
        ? { saved_checklist_id: params.savedChecklist }
        : {}),
    };
    if (
      payload.target_count != null &&
      (!Number.isInteger(payload.target_count) ||
        payload.target_count < 2 ||
        payload.target_count > 100)
    )
      throw new Error("Choose a crew target from 2 to 100, or leave it blank.");
    if (params.planDraftKey && params.planDraftStopId) {
      if (!userId || !params.planDraftKey.startsWith(planDraftKey(data.is_demo?`${userId}:${data.demo_session_id??"fixture"}`:userId, data.is_demo === true, ""))) throw new Error("Your account changed. Reopen this Plan draft.");
      const stageEpoch = getViewerEpoch();
      const parent = await readPlanDraft(params.planDraftKey);
      if(stageEpoch!==getViewerEpoch() || dataRef.current.viewer_id!==userId) throw new Error("Your account changed. Reopen this Plan draft.");
      if (!parent || parent.request || !parent.stops.some(s => s.id === params.planDraftStopId)) throw new Error("This Plan draft changed. Return to the Plan before adding this Beacon.");
      if (!payload.title) throw new Error("Give this Beacon a title.");
      const planTiming = when === "Now" || when === "In 30 min" ? when : "Pick time";
      await writePlanDraft(params.planDraftKey, { ...parent, stops: parent.stops.map(s => s.id === params.planDraftStopId ? { ...s, kind: "beacon", creation_token: undefined, title: payload.title, details: "", beacon: { ...payload, invitee_ids: inviteeIds, draft_timing: planTiming, duration_minutes: durationMinutesForLabel(duration, starts, ends), public_listing: publicListing.enabled?{enabled:true,area:publicListing.area}:undefined }, include: !!(payload.label || payload.online_url || payload.latitude != null) } : s) });
      if(stageEpoch!==getViewerEpoch() || dataRef.current.viewer_id!==userId) throw new Error("Your account changed. Your draft is preserved.");
      completePlanningDraft(userId, draftToken);
      router.back();
      return;
    }
    validateActivity(payload);
    if (
      (audience === "list" ||
        audience === "squad" ||
        audience === "organization") &&
      !audienceId
    )
      throw new Error("Choose who to share with first.");
    if (selectedAssociation && !selectedAssociationRow)
      throw new Error(
        "That community is no longer available for this Beacon. Clear the association or choose another community.",
      );
    if (params.sourcePlanningId) {

      const result = await durableAction("publish_planning_beacon", {thread_id: params.sourcePlanningId, claim_token: params.planningClaimToken || undefined, proposal_id: params.planningProposalId || undefined, slot_id: params.planningSlotId || undefined, invitee_ids: inviteeIds, payload, confirmed: true});
      if (typeof result.id !== "string") throw new Error("Could not verify the resulting Beacon. Keep this draft and retry.");
      await applyPublicListing(result.id);
      if (result.already_published) return;
      if(params.returnPlanId) router.dismissTo({pathname:"/plan/[id]",params:{id:params.returnPlanId}});
      else router.replace({pathname:"/activity/[id]",params:{id:result.id}});
      return;
    }
    if (params.planningSessionId && params.planningOptionId) {
      if (!userId || dataRef.current.viewer_id !== userId) throw new Error("Your account changed. Return to the original account.");
      if (inviteeIds.length) throw new Error("Council options use their Council audience, without individual invitations.");
      saveComposerOption(userId, params.planningSessionId, params.planningOptionId, payload as BeaconDraft);
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/planning/create", params: { sessionId: params.planningSessionId, kind: params.planningKind ?? "vote" } });
      return;
    }
    if (addTo === "Vote / Draw") {
      if (start <= currentTime + 120000)
        throw new Error(
          "Choose a future time so people can decide before the Beacon starts.",
        );
      const thread = decision;
      if (
        thread &&
        (thread.audience !== audience || thread.audience_id !== audienceId)
      )
        throw new Error("Use the same audience as this Vote / Draw.");
      if (thread && start <= Date.parse(thread.deadline_at))
        throw new Error("Choose a Beacon time after the decision deadline.");
      let threadId = decisionId;
      if (!threadId) {
        const created = await durableAction("create_planning_thread", {
          kind: decisionKind.toLowerCase(),
          title: decisionTitle.trim() || title.trim(),
          body: "",
          audience,
          audience_id: audienceId,
          coowner_ids: [],
          deadline_at: new Date(
            Math.min(currentTime + 86400000, start - 60000),
          ).toISOString(),
        });
        if (typeof created.id !== "string")
          throw new Error("The decision could not be opened.");
        threadId = created.id;
        setDecisionId(threadId);
      }
      await durableAction("add_council_proposal", {
        thread_id: threadId,
        payload: payload as BeaconDraft,
        approve_if_manager: true,
      });
      router.replace({ pathname: "/council/[id]", params: { id: threadId } });
      return;
    }
    if (addTo === "Plan") {
      const plan = ownPlans.find((item) => item.id === selectedPlanId);
      if (!plan) throw new Error("Choose a Plan first.");
      const count = data.activities.filter(
        (item) => item.plan_id === plan.id,
      ).length;
      const create = () =>
        durableAction("create_plan_beacon", {
          ...payload,
          plan_id: plan.id,
          position: planPosition === "End" ? count : Number(planPosition) - 1,
        });
      const result = inviteeIds.length
        ? await publishAtomic("create_plan_beacon_with_invitees", {
            ...payload,
            plan_id: plan.id,
            position: planPosition === "End" ? count : Number(planPosition) - 1,
          })
        : await create();
      if (result.id) await applyPublicListing(String(result.id));
      if (invitationSession.current.pendingIds.length) return;
      if (!result.id)
        throw new Error("The Beacon could not be added to this Plan.");
      completePlanningDraft(userId, draftToken);
      router.replace({ pathname: "/plan/[id]", params: { id: plan.id } });
      return;
    }
    const contextualPayload = {...payload,...(params.returnPlanId?{return_plan_id:params.returnPlanId,plan_stop_id:params.planStopId,stop_position:params.stopPosition,stop_after_id:params.stopAfterId}: {})};
    const create = () => durableAction("create_activity", contextualPayload);
    const result = inviteeIds.length
      ? await publishAtomic("create_activity_with_invitees", contextualPayload)
      : {
          id: (
            await createAndInvite(
              invitationSession.current,
              [],
              () => dataRef.current,
              userId,
              create,
              act,
              checkpoint,
            )
          ).createdId,
        };
    if (typeof result.id === "string") await applyPublicListing(result.id);
    if (invitationSession.current.pendingIds.length) return;
    if (typeof result.id !== "string") throw new Error("The Beacon publication could not be verified.");
    completePlanningDraft(userId, draftToken);
    if (typeof result.id === "string" && params.returnPlanId) {
      router.dismissTo({pathname:"/plan/[id]",params:{id:params.returnPlanId}});
      return;
    }
    if (typeof result.id === "string")
      router.replace({
        pathname: "/activity-created",
        params: { id: result.id, type: "beacon" },
      });
    else throw new Error("The Beacon publication could not be verified.");
  }
  async function publishAtomic(
    action:
      "create_activity_with_invitees" | "create_plan_beacon_with_invitees",
    payload: Record<string, unknown>,
  ) {
    try {
      const session = await atomicCreateAndInvite(
        invitationSession.current,
        inviteeIds,
        () => dataRef.current,
        userId,
        action,
        payload,
        durableAction,
        randomUUID,
      );
      setCreatedSession(session);
      await checkpoint();
      return { id: session.createdId };
    } finally {
      setCreatedSession(
        invitationSession.current.atomicAttempt ||
          invitationSession.current.createdId ||
          invitationSession.current.creationUnverified
          ? { ...invitationSession.current }
          : null,
      );
    }
  }
  async function confirmPublication() {
    const attempt = invitationSession.current.atomicAttempt;
    if (!attempt || retryBusyRef.current) return;
    retryBusyRef.current = true;
    setRetryBusy(true);
    setWorkflowError("");
    try {
      const result = await publishAtomic(attempt.action, attempt.payload);
      if (result.id) await applyPublicListing(String(result.id));
      if (result.id && !invitationSession.current.pendingIds.length)
        router.replace({
          pathname: "/activity/[id]",
          params: { id: result.id },
        });
    } catch (failure) {
      setWorkflowError(
        failure instanceof Error
          ? failure.message
          : "Could not confirm publication. Try again.",
      );
    } finally {
      retryBusyRef.current = false;
      setRetryBusy(false);
    }
  }
  async function publishWithInvitees(
    create: () => Promise<Record<string, unknown>>,
  ) {
    try {
      const session = await createAndInvite(
        invitationSession.current,
        inviteeIds,
        () => dataRef.current,
        userId,
        create,
        act,
        checkpoint,
      );
      setCreatedSession(session);
      return { id: session.createdId };
    } finally {
      if (
        invitationSession.current.createdId ||
        invitationSession.current.creationUnverified
      )
        setCreatedSession({ ...invitationSession.current });
    }
  }
  async function retryInvitations() {
    if (retryBusyRef.current) return;
    retryBusyRef.current = true;
    setRetryBusy(true);
    try {
      await publishWithInvitees(async () => {
        throw new Error("This Beacon has already been created.");
      });
    } finally {
      retryBusyRef.current = false;
      setRetryBusy(false);
    }
  }
  if (publicListing.createdId && (!publicListing.completed || !createdSession?.pendingIds.length)) return <Screen title="Finish public listing" eyebrow="" create={false}>
    <Txt>Beacon created; public listing {publicWorking ? "is being confirmed." : "needs confirmation."}</Txt>
    {!!workflowError && <Text accessibilityRole="alert" style={styles.error}>{workflowError}</Text>}
    <Action title="Retry public listing" disabled={publicWorking} run={async () => { await applyPublicListing(publicListing.createdId!); if (!invitationSession.current.pendingIds.length) finishCreatedFlow(publicListing.createdId!); }} />
    <Button secondary title="Open Beacon" disabled={publicWorking} onPress={() => router.push({ pathname: "/activity/[id]", params: { id: publicListing.createdId! } })} />
    <Txt muted>Retry only confirms the public listing. It never creates another Beacon. This draft keeps the pending listing available.</Txt>
  </Screen>;
  if (pendingPublication)
    return (
      <Screen
        title="Confirm publication"
        eyebrow=""
        compactHeader
        create={false}
      >
        <Txt>{String(pendingPublication.payload.title ?? title)}</Txt>
        <Txt muted>
          Publication needs confirmation. Retry uses this request ID and the
          original details. If saving failed, keep this editor open. A request
          is sent only after its recovery state is saved. If the server cannot
          confirm this request, retain this pending draft and try again later.
        </Txt>
        {!!workflowError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {workflowError}
          </Text>
        )}
        <Action
          title="Retry confirmation"
          run={async () => {
            const attempt = pendingPublication;
            const result = await durableAction(
              attempt.action,
              attempt.payload,
              attempt.requestId,
            );
            if (attempt.action === "create_planning_thread" && attempt.payload.kind === "time") {
              completePlanningDraft(userId,draftToken);
              router.replace({pathname:"/responses",params:{threadId:String(result.id)}});
              return;
            }
            if (attempt.action === "create_planning_thread") {
              setDecisionId(String(result.id));
              await checkpoint();
              return;
            }
            if (["create_activity", "create_plan_beacon", "publish_planning_beacon"].includes(attempt.action)) {
              if (typeof result.id !== "string") throw new Error("Could not confirm the created Beacon.");
              await applyPublicListing(result.id);
              finishCreatedFlow(result.id);
              return;
            }
            completePlanningDraft(userId, draftToken);
            if (attempt.action === "add_council_proposal")
              router.replace({
                pathname: "/council/[id]",
                params: { id: String(attempt.payload.thread_id) },
              });
            else
              router.replace({
                pathname: "/activity/[id]",
                params: { id: String(result.id) },
              });
          }}
        />
        <Action secondary title="Save pending state" run={checkpoint} />
      </Screen>
    );
  if (
    createdSession &&
    (createdSession.viewerId !== userId || data.viewer_id !== userId)
  )
    return (
      <Screen
        title={
          createdSession.createdId ? "Beacon created" : "Your Beacon draft"
        }
        eyebrow="MAKE TIME TOGETHER"
        create={false}
      >
        <Txt muted>
          Return to the account that started this Beacon to review or retry
          publication.
        </Txt>
      </Screen>
    );
  if (createdSession?.atomicAttempt && !createdSession.createdId)
    return (
      <Screen title="Confirm publication" eyebrow="" create={false}>
        <Text style={styles.h2}>
          {String(createdSession.atomicAttempt.payload.title ?? title)}
        </Text>
        <Txt muted>
          The publication response was not confirmed. Your saved draft and
          selected invitations will be retried with the same request, preventing
          a second Beacon.
        </Txt>
        {!!workflowError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {workflowError}
          </Text>
        )}
        <Txt muted>
          {
            (createdSession.atomicAttempt.payload.invitee_ids as string[])
              .length
          }{" "}
          selected invitation recipients remain in this saved attempt.
        </Txt>
        <Action
          title="Retry confirmation"
          disabled={retryBusy}
          run={confirmPublication}
        />
      </Screen>
    );
  if (createdSession?.createdId || createdSession?.creationUnverified)
    return (
      <Screen
        title="Beacon created"
        eyebrow="MAKE TIME TOGETHER"
        create={false}
      >
        <Text style={styles.h2}>{title}</Text>
        <Txt muted>
          {createdSession.invitedIds.length} invitation
          {createdSession.invitedIds.length === 1 ? "" : "s"} sent or already
          active.
        </Txt>
        {createdSession.creationUnverified ? (
          <Txt muted>
            The Beacon was created, but its ID could not be verified. Refresh
            before continuing.
          </Txt>
        ) : null}
        {!!createdSession.pendingIds.length && (
          <Text accessibilityRole="alert" style={styles.error}>
            {createdSession.pendingIds.length} invitation
            {createdSession.pendingIds.length === 1 ? "" : "s"} still need to be
            sent.
          </Text>
        )}
        {createdSession.pendingIds.map((id) => (
          <View key={id} style={{ gap: 4 }}>
            <Txt>{inviteeLabel(id)}</Txt>
            <Txt muted>{createdSession.errors[id]}</Txt>
            <Button
              compact
              secondary
              disabled={retryBusy}
              title={`Remove ${inviteeLabel(id)} from pending invitations`}
              onPress={() => {
                if (retryBusyRef.current) return;
                setInviteeIds((ids) => ids.filter((item) => item !== id));
                invitationSession.current.pendingIds =
                  invitationSession.current.pendingIds.filter(
                    (item) => item !== id,
                  );
                delete invitationSession.current.errors[id];
                setCreatedSession({ ...invitationSession.current });
              }}
            />
          </View>
        ))}
        {!!createdSession.pendingIds.length && (
          <Action
            title="Retry invitations"
            disabled={retryBusy}
            run={retryInvitations}
          />
        )}
        {createdSession.createdId ? (
          <Button
            title="Open Beacon"
            disabled={retryBusy}
            onPress={() => {
              if (!retryBusyRef.current)
                router.replace({
                  pathname: "/activity/[id]",
                  params: { id: createdSession.createdId! },
                });
            }}
          />
        ) : null}
      </Screen>
    );
  if (home)
    return (
      <CreateHome
        browserScreen={templateBrowser}
        inviteeControl={
          <CreationInvitees ids={inviteeIds} onChange={setInviteeIds} allowedIds={allowedPlanningInvitees} />
        }
        context={handoff}
        selectedFriends={inviteeIds.map((id) => ({
          id,
          name: inviteeLabel(id),
        }))}
        contextError={inviteeError || sourceError}
        onRemoveInvitee={(id) =>
          setInviteeIds((ids) => ids.filter((item) => item !== id))
        }
        onClearInvitees={() => {
          setInviteeIds([]);
          setInviteeError("");
        }}
        onClearStatusSource={() => setStatusSourceDismissed(true)}
        onBlank={() =>
          router.push({
            pathname: "/create",
            params: { ...handoff, planSession: undefined, editor: "yes" },
          })
        }
        onReuse={(id) =>
          router.push({
            pathname: "/create",
            params: {
              ...handoff,
              planSession: undefined,
              editor: "yes",
              repeat: id,
            },
          })
        }
        onTemplate={(recipe) => {
          applyTemplate(recipe);
          setHome(false);
        }}
      />
    );
  const publishedSource = data.planning_threads.find(t => t.id === params.sourcePlanningId && t.materialized_activity_id && userId && canReadPlanningThread(data,t,userId));
  if (publishedSource) return <Screen title="Plan became a Beacon" eyebrow=""><LinkedPlanningBeacon thread={publishedSource} reviewConflict/><Txt muted>Your local draft edits are preserved.</Txt></Screen>;
  const audienceName =
    audience === "list"
      ? "Private list"
      : audience === "squad"
        ? "Squad"
        : audience === "organization"
          ? "Network"
          : audience === "private"
            ? "Private"
            : "Friends";
  const moduleNames = creationModules
    .filter((row) => beaconControls[row.field])
    .map((row) => row.name);
  const primaryAction = params.planDraftKey ? "Add to Plan" : params.planningOptionId ? "Save Council Option" : templateEditor
    ? "Save Template"
    : addTo === "Plan"
      ? "Add Beacon Step"
      : addTo === "Vote / Draw"
        ? "Submit Council Option"
        : "Create Beacon";
  const errorFor = (field: string) =>
    fieldError?.field === field ? (
      <Text accessibilityRole="alert" style={styles.error}>
        {fieldError.message}
      </Text>
    ) : null;
  return (
    <CreationKeyboardScreen
      title={params.planningOptionId ? "Edit Council Option" : templateEditor ? "Beacon Template" : "Create Beacon"}
      eyebrow=""
      compactHeader
      compactTitleStart
      iconOnlyBack
      scrollRequest={scrollRequest}
      create={false}
      headerAction={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Button
          compact
          secondary
          title={savingDraft ? "Saving…" : "Save Draft"}
          disabled={savingDraft}
          onPress={() => void saveDraft()}
        />
        {!templateEditor && (
          <View ref={headerAnchor} collapsable={false}>
            <IconButton label="More creation actions" onPress={() => setHeaderMenu(true)}>
              <Ellipsis size={20} color={colors.ink} />
            </IconButton>
          </View>
        )}
        </View>
      }
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              title="Preview"
              onPress={() => { if (checkTiming()) setPreviewOpen(true); }}
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <Action
              title={primaryAction}
              run={templateEditor ? saveTemplate : submit}
            />
          </View>
        </View>
      }
    >
      {!!(workflowError || inviteeError || sourceError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {workflowError || inviteeError || sourceError}
        </Text>
      )}
      {!!(saveNotice || templateNotice) && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {saveNotice || templateNotice}
        </Text>
      )}
      {params.template && !saved ? (
        <Txt muted>
          This template is no longer available. Your draft details are retained;
          review them before creating.
        </Txt>
      ) : null}
      {params.planningClaimToken && <Txt muted>You are reviewing this plan as its new host. Review the audience and publish before your claim expires.</Txt>}
      {previous ? (
        <Txt muted>
          Reusing {previous.title} · Review time, location, and access.
        </Txt>
      ) : null}
      {templateEditor && <PremiumPreview kind="Beacon" onOpen={async () => { await checkpoint(); router.push("/settings/premium" as Href); }} />}
      {templateEditor ? (
        <Field
          label="Template name"
          value={templateName}
          onChangeText={setTemplateName}
          maxLength={80}
        />
      ) : null}
      <View
        onLayout={(event) => recordSection("description", event.nativeEvent.layout.y)}
        style={[styles.card, { padding: 14, gap: 6 }]}
      >
      <Text accessibilityRole="header" style={styles.h2}>What are we doing?</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customize appearance"
          onPress={() => setAppearanceOpen(true)}
          style={{
            minWidth: 56,
            minHeight: 56,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {beaconControls.decoration_emoji ? (
            <Text style={{ fontSize: 36 }}>
              {beaconControls.decoration_emoji}
            </Text>
          ) : (
            <ActivityBadge category={category} size={56} />
          )}
          <Text style={[styles.muted, { fontSize: 11 }]}>Appearance</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt muted>{category}</Txt>
          <Field
            label="Activity title"
            style={{ minHeight: 56, borderRadius: 12, paddingVertical: 16 }}
            inputRef={titleInput}
            placeholder="What are we doing?"
            value={title}
            onChangeText={(value) => {
              textEdited.current.title = true;
              setTitle(value);
            }}
            maxLength={120}
          />
        </View>
      </View>
      {errorFor("title")}
      {errorFor("description")}
      {descriptionOpen || description ? (
        <Field
          label="Description & details"
          inputRef={descriptionInput}
          style={{ minHeight: 72 }}
          value={description}
          onChangeText={(value) => {
            textEdited.current.description = true;
            setDescription(value);
          }}
          multiline
          maxLength={templateEditor ? 1000 : 2000}
        />
      ) : (
        <Button compact secondary title="Add a description" onPress={() => {
          setDescriptionOpen(true);
          requestAnimationFrame(() => descriptionInput.current?.focus());
        }} />
      )}
          {selectedRecipe?.prepPrompts?.map((prompt, index) => (
            <Field
              key={prompt}
              label={prompt}
              value={prepAnswers[index] ?? ""}
              onChangeText={(answer) =>
                setPrepAnswers((current) => {
                  const next = [...current];
                  next[index] = answer;
                  return next;
                })
              }
              maxLength={240}
            />
          ))}
      {kind === "Beacon" && !templateEditor && !params.planningOptionId && !pendingPublication && (
        <QuickQuest
          replacesText={!!(title.trim() || description.trim())}
          onApply={(idea) => {
            textEdited.current = { title: true, description: true, category: true };
            setTitle(idea.title);
            setDescription(idea.description);
            setCategory(idea.category);
            setDuration(idea.duration);
            setFieldError((current) => current?.field === "title" ? null : current);
          }}
        />
      )}
      </View>
      <View onLayout={(event) => recordSection("timing", event.nativeEvent.layout.y)} style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={styles.h2}>When and where?</Text>
        <CreationTimingFields
          now={currentTime}
          starts={effectiveStartAt()}
          ends={resolveActivityEndAt(effectiveStartAt(), duration, ends)}
          timezone={creationTimezone}
          when={when === fixedHalfHourStart ? "In 30 min" : when}
          minutes={durationMinutesForLabel(duration, starts, ends)}
          expanded={timing}
          dateError={dateError}
          durationError={durationError}
          onExpand={(value) => {
            setTiming(value);
            if (!value) setTimingErrors((current) => ({ ...current, start: false, end: false, order: false }));
          }}
          onPreset={(choice, value) => chooseStart(value, choice)}
          onStart={(value) => chooseStart(Date.parse(value), "Choose date")}
          onEnd={chooseEnd}
          onDuration={changeDuration}
          onDateValidity={(field, valid) => setTimingErrors((current) => ({ ...current, [field]: !valid }))}
        />
        {errorFor("timing")}
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.label}>LOCATION</Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Location type"
            style={{
              flexDirection: "row",
              marginVertical: 6,
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 5,
                bottom: 5,
                left: 0,
                right: 0,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 10,
              }}
            />
            {(["In person", "Online"] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="radio"
                accessibilityLabel={mode}
                accessibilityState={{ checked: placeType === mode }}
                aria-checked={placeType === mode}
                onPress={() => setPlaceType(mode)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    minHeight: 34,
                    minWidth: 76,
                    marginVertical: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 9,
                    backgroundColor:
                      placeType === mode
                        ? colors.surfaceSelected
                        : "transparent",
                  }}
                >
                  <Text
                    style={[
                      styles.body,
                      {
                        fontSize: 13,
                        fontWeight: placeType === mode ? "600" : "400",
                      },
                    ]}
                  >
                    {mode}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
        {placeType === "Online" ? (
          <Field
            label="HTTPS meeting link"
            style={{ minHeight: 44, paddingVertical: 10, borderRadius: 12 }}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        ) : (
          <CreationLocationInput
            inputRef={locationInput}
            value={label}
            selected={!!pin}
            onChange={(value) => {
              setLabel(value);
              setPin(null);
            }}
            onChoose={(place) => {
              setLabel(place.label);
              setPin(place.coordinate);
            }}
            onPickMap={() => {
              const returnParams = Object.fromEntries(
                Object.entries(params).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === "string",
                ),
              );
              returnParams.planSession = draftToken!;
              if (!beginCreationLocationPick(userId, draftToken, returnParams))
                return;
              router.push({
                pathname: "/",
                params: {
                  ...creationHandoffParams({
                    ...handoff,
                    planSession: draftToken,
                    latitude: pin ? String(pin.latitude) : undefined,
                    longitude: pin ? String(pin.longitude) : undefined,
                    placeLabel: label,
                  }),
                  pickLocation: "yes",
                  locationPicker: "editor",
                },
              });
            }}
          />
        )}
        {errorFor("location")}
      </View>
        {(data.is_demo === true || data.capabilities?.connected_planning === true) && !params.sourcePlanningId && !params.planningOptionId && !templateEditor && kind !== "Status" && (
          <Action compact secondary title="Let friends choose a time" run={async () => {
            await checkpoint();
            router.push({ pathname: "/planning/create", params: { kind: "time", sessionId: randomUUID(), beaconDraftToken: draftToken, timezone: creationTimezone } });
          }} />
        )}
      </View>
      <View
        onLayout={(event) => {
          recordSection("people", event.nativeEvent.layout.y);
        }}
      >
        {errorFor("people")}
        <CreationPeople
          audience={audience}
          audienceId={audienceId}
          audienceLabel={
            audienceId
              ? (eligibleDefaultTargets(data, userId ?? "", audience).find(
                  (row) => row.id === audienceId,
                )?.name ?? `${audienceName} · Unavailable target`)
              : audienceName
          }
          onAudience={(value, id) => {
            setAudience(value);
            setAudienceId(id);
          }}
          notice={defaultNotice}
          invitations={
            <CreationInvitees ids={inviteeIds} onChange={setInviteeIds} allowedIds={allowedPlanningInvitees} />
          }
          community={
            selectedAssociationRow
              ? `${selectedAssociationRow.name} · ${communityTypeLabel(selectedAssociationRow.entity_type)}`
              : selectedAssociation
                ? "Unavailable community"
                : undefined
          }
          communityDetails={kind !== "Status" && selectedAssociationRow && (communityTopics.length > 0 || scopedTopic) ? (
            <View style={{ gap: 5 }}>
              <Text style={styles.label}>Topic (optional)</Text>
              <View style={[styles.row, { flexWrap: "wrap" }]}>
                <Button compact secondary={!!scopedTopic} title="No topic" onPress={() => setDraftTopic(null)} />
                {communityTopics.map((topic) => (
                  <Button compact key={topic.id} secondary={topic.id !== scopedTopic?.id} title={topic.name} onPress={() => setDraftTopic({ id: topic.id, type: selectedAssociationRow.entity_type, community: selectedAssociationRow.entity_id })} />
                ))}
              </View>
            </View>
          ) : undefined}
          communityChoices={associationCandidates}
          selectedCommunity={selectedAssociation}
          onCommunity={(value) => {
            if (value?.entity_id !== selectedAssociation?.entity_id || value?.entity_type !== selectedAssociation?.entity_type)
              setDraftTopic(null);
            setAssociationDraft({ routeKey: associationRouteKey, value });
          }}
          panel={peoplePanel}
          onPanel={setPeoplePanel}
          approval={approval}
          onApproval={setApproval}
          controls={beaconControls}
          onControls={setBeaconControls}
          capacityRef={capacityInput}
          listing={(publicEligible || publicListing.enabled) && (
            <CreationDisclosure
              compact
              title="Public listing"
              summary={publicListing.enabled ? "On · Public preview" : "Off"}
              open={peoplePanel === "listing"}
              onToggle={() => setPeoplePanel(peoplePanel === "listing" ? "none" : "listing")}
            >
              <CreationSwitch
                title="Show a public preview"
                value={publicListing.enabled}
                onChange={(enabled) => setPublicListing({ ...publicListing, enabled })}
                detail="Exact meeting details stay protected."
              />
              {!publicEligible && <Txt muted>Turn off public listing for this audience or destination.</Txt>}
              {publicListing.enabled && (
                <Field
                  label="City or general area"
                  inputRef={listingInput}
                  maxLength={120}
                  value={publicListing.area}
                  onChangeText={(area) => setPublicListing({ ...publicListing, area })}
                  placeholder="Chicago"
                />
              )}
            </CreationDisclosure>
          )}
          review={
            previous && !reuseReviewed ? (
              <Button
                compact
                secondary
                title="Confirm reused location and access"
                onPress={() => setReuseReviewed(true)}
              />

            ) : undefined
          }
        />
      </View>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={styles.h2}>Make it yours</Text>
        <CreationRow title="Beacon tools" detail={moduleNames.join(" · ") || "No tools enabled"} onPress={() => setToolsOpen(true)} />
        <CreationRow
          title="Connect an aspiration"
          detail={aspirationIds.length ? aspirationIds.length + " selected" : "Optional"}
          onPress={() => { setAspirationQuery(""); setAllAspirations(true); }}
        />
        {!!aspirationIds.length && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {aspirations.filter((row) => aspirationIds.includes(row.id)).map((row) => (
              <Button compact secondary key={row.id} title={row.title + " ×"}
                accessibilityLabel={"Remove aspiration " + row.title}
                onPress={() => setAspirationIds((current) => current.filter((id) => id !== row.id))}
              />
            ))}
          </View>
        )}
      </View>
      <CreationPicker
        title="Configure Beacon tools"
        visible={toolsOpen}
        onClose={() => setToolsOpen(false)}
        initialFocusLabel={fieldError?.field === "modules" ? "Music link" : undefined}
        footer={<Button title="Done" onPress={() => setToolsOpen(false)} />}
      >
        {errorFor("modules")}
        <CreationModuleControls
          value={beaconControls}
          onChange={setBeaconControls}
          category={category}
          focusMusic={toolsOpen && fieldError?.field === "modules"}
        />
      </CreationPicker>
      {!templateEditor && kind !== "Status" && (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Connect to planning</Text>
          {addTo === "Plan" && !params.planDraftKey && (
            <CreationRow
              title={routeDestination ? "Plan" : "Change Plan"}
              detail={(ownPlans.find((item) => item.id === selectedPlanId)?.title ?? "Choose a Plan") + " · " + (planPosition === "End" ? "At end" : "Before stop " + planPosition)}
              onPress={openPlan}
            />
          )}
          {addTo === "Vote / Draw" && !routeDestination && (
            <CreationRow title="Vote or Draw proposal" detail={decision?.title || decisionTitle || ("New " + decisionKind)} onPress={openDecision} />
          )}
          {(params.threadId || params.planningOptionId) && <Txt muted>Council option{decision?.title ? " · " + decision.title : ""}</Txt>}
          {params.planDraftKey && <Txt muted>Adding to the current Plan draft</Txt>}
          {!routeDestination && addTo === "Standalone" && (
            <>
              <CreationRow title="Add to a Plan" onPress={openPlan} />
              <CreationRow title="Suggest for a Vote or Draw" onPress={openDecision} />
            </>
          )}
          {!routeDestination && addTo !== "Standalone" && (
            <Button compact secondary title="Remove planning connection" onPress={removeDestination} />
          )}
        </View>
      )}

      <CreationPicker
        title="Customize appearance"
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        footer={<Button title="Done" onPress={() => setAppearanceOpen(false)} />}
      >
        <Text style={styles.h2}>Category</Text>
        <ActivityCategoryChoices value={category} onChange={(value, idea) => {
          textEdited.current.category = true;
          setCategory(value);
          if (idea && !title.trim()) { textEdited.current.title = true; setTitle(idea); }
        }} />
        <CreationAppearance
          category={category}
          value={beaconControls}
          onChange={setBeaconControls}
          background={previewBackground}
          onBackgroundChange={setPreviewBackground}
          onOpenShop={() => {
            setAppearanceOpen(false);
            router.push(rewardsHref("activity"));
          }}
        />
        {mapIconEditor}
          {canUseAppearance&&<View style={{gap:8}}><Txt>Additional Beacon styles</Txt>{audience==="squad"&&tierRank(appearanceContext.tier)>tierRank(personalAppearance.tier)&&<Txt muted>Unlocked by {data.squads.find(s=>s.id===audienceId)?.name??"your Squad"}</Txt>}<Chips options={["Standard","Sunrise","Ocean"]} value={premiumAppearance?.style==="sunrise"?"Sunrise":premiumAppearance?.style==="ocean"?"Ocean":"Standard"} onChange={v=>setPremiumAppearance(v==="Standard"&&!premiumAppearance?.layout?null:{...premiumAppearance,style:v.toLowerCase() as ToolSettings["style"]})}/>{appearanceTier==="pro"&&<Chips options={["Standard layout","Preparation","Session"]} value={premiumAppearance?.layout==="preparation"?"Preparation":premiumAppearance?.layout==="session"?"Session":"Standard layout"} onChange={v=>setPremiumAppearance({...premiumAppearance,layout:v==="Preparation"?"preparation":v==="Session"?"session":"standard"})}/>}</View>}
          {!appearanceAllowed&&<Txt muted>Your saved advanced style is preserved. This publication will use the standard appearance.</Txt>}
      </CreationPicker>
      <CreationPicker
        title="Choose aspirations"
        visible={allAspirations}
        onClose={() => setAllAspirations(false)}
        footer={
          <Button title="Done" onPress={() => setAllAspirations(false)} />
        }
      >
        <Field
          label="Search aspirations"
          value={aspirationQuery}
          onChangeText={setAspirationQuery}
        />
        {aspirations
          .filter((row) =>
            row.title.toLowerCase().includes(aspirationQuery.toLowerCase()),
          )
          .map((row) => (
            <CreationSwitch
              key={row.id}
              title={row.title}
              value={aspirationIds.includes(row.id)}
              onChange={(checked) =>
                setAspirationIds((current) =>
                  checked
                    ? [...new Set([...current, row.id])]
                    : current.filter((id) => id !== row.id),
                )
              }
            />
          ))}
        {!aspirations.length && <Txt muted>Add aspirations in your profile to connect them.</Txt>}
      </CreationPicker>
      <ContextMenu title="Creation actions" mode="dropdown" anchorRef={headerAnchor} visible={headerMenu} onClose={() => setHeaderMenu(false)}>
        <ActionRow label="See templates" onPress={() => {
          setHeaderMenu(false);
          void checkpoint().then(() => router.push({
            pathname: "/beacon-templates",
            params: { ...handoff, templates: "mine", planSession: draftToken },
          }));
        }} />
        <ActionRow label="Save as template" onPress={() => { setHeaderMenu(false); setTemplateSaveOpen(true); }} />
      </ContextMenu>
      <CreationPicker title="Save as template" visible={templateSaveOpen} onClose={() => setTemplateSaveOpen(false)}
        footer={<Action title="Save as template" run={async () => {
          if (!checkTiming()) { setTemplateSaveOpen(false); return; }
          await saveTemplate();
          setTemplateSaveOpen(false);
        }} />}
      >
        <Field label="Template name" value={templateName} onChangeText={setTemplateName} maxLength={80} />
        <PremiumPreview kind="Beacon" onOpen={async () => { await checkpoint(); router.push("/settings/premium" as Href); }} />
      </CreationPicker>
      <CreationPicker
        title={destination?.kind === "Plan" ? "Add to a Plan" : "Suggest for a Vote or Draw"}
        visible={!!destination}
        onClose={closeDestination}
        footer={
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Button compact secondary title="Cancel" onPress={closeDestination} />
            <Button
              compact title="Apply"
              disabled={destination?.kind === "Plan"
                ? !stagedPlan
                : !!(inviteeIds.length || inviteeError || (destination?.id && !stagedDecision))}
              onPress={applyDestination}
            />
          </View>
        }
      >
        {destination?.kind === "Plan" && (
          <>
            {!!inviteeIds.length && (
              <Txt muted>Choose an existing Plan to keep these invitations. Clear your selected friends before starting a new Plan.</Txt>
            )}
            {!params.planId && (
              <Action
                secondary title="New Plan with this Beacon"
                disabled={inviteeIds.length > 0 || !!inviteeError}
                run={async () => {
                  if (!checkTiming()) { closeDestination(); return; }
                  await checkpoint();
                  closeDestination();
                  router.push({
                    pathname: "/plans",
                    params: {
                      create: "yes",
                      beaconDraft: JSON.stringify({
                        title,
                        description: descriptionWithPrep(),
                        category,
                        location_name: label,
                        lat: pin?.latitude ?? null,
                        lng: pin?.longitude ?? null,
                        day_offset: 0,
                        start_time: new Date(effectiveStartAt()).toLocaleTimeString("en-GB", {
                          timeZone: creationTimezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
                        }),
                        duration_minutes: durationMinutesForLabel(duration, starts, ends),
                        aspiration_ids: aspirationIds,
                      }),
                    },
                  });
                }}
              />
            )}
            {ownPlans.filter((item) => !params.planId || item.id === params.planId).map((item) => (
              <Button
                key={item.id} compact
                secondary={destination.id !== item.id}
                title={item.title}
                onPress={() => setDestination({ kind: "Plan", id: item.id, position: "End" })}
              />
            ))}
            {stagedPlan && (
              <>
                <Txt muted>
                  Visibility: {stagedPlan.squad_id ? (data.squads.find((squad) => squad.id === stagedPlan.squad_id)?.name ?? "Plan Squad") : "Private"}.
                  Check the time against the Plan itinerary.
                </Txt>
                {stagedPlanStops.length > 0 && (
                  <>
                  <Text style={styles.label}>Position in Plan</Text>
                  <Chips
                    options={[...stagedPlanStops.map((_, index) => "Before stop " + (index + 1)), "At end"]}
                    value={destination.position === "End" ? "At end" : "Before stop " + destination.position}
                    onChange={(value) => setDestination({ ...destination, position: value === "At end" ? "End" : value.replace("Before stop ", "") })}
                  />
                  </>
                )}
              </>
            )}
          </>
        )}
        {destination?.kind === "Vote / Draw" && (
          <>
            <Txt muted>Submit this activity as an option. A Vote lets people choose. A Draw picks an option at random.</Txt>
            {!!(inviteeIds.length || inviteeError) && (
              <Txt>Clear selected friends in People & Access before submitting a proposal.</Txt>
            )}
            <Button
              compact secondary={!!destination.id}
              title="New Vote / Draw"
              onPress={() => setDestination({ ...destination, id: "" })}
            />
            {!destination.id && (
              <>
                <Chips
                  options={["Vote", "Draw"]}
                  value={destination.voteKind}
                  onChange={(voteKind) => setDestination({ ...destination, voteKind })}
                />
                <Field
                  label="Decision name (optional)"
                  value={destination.title}
                  onChangeText={(title) => setDestination({ ...destination, title })}
                  placeholder="What should we do?"
                  maxLength={100}
                />
              </>
            )}
            {decisions.map((item) => (
              <Button
                key={item.id} compact
                secondary={destination.id !== item.id}
                title={(item.kind === "vote" ? "Vote" : "Draw") + " · " + item.title}
                onPress={() => setDestination({ ...destination, id: item.id })}
              />
            ))}
            {stagedDecision && (
              <Txt muted>
                This option uses the decision’s visibility: {eligibleDefaultTargets(data, userId ?? "", stagedDecision.audience).find((target) => target.id === stagedDecision.audience_id)?.name
                  ?? (stagedDecision.audience === "organization" ? "Network" : stagedDecision.audience)}.
                Decide by {new Date(stagedDecision.deadline_at).toLocaleString()}.
              </Txt>
            )}
          </>
        )}
      </CreationPicker>
      <CreationPicker
        title="Review your Beacon"
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        footer={
          <Button
            title="Back to editor"
            onPress={() => setPreviewOpen(false)}
          />
        }
      >
        <View style={[styles.card, { gap: 10 }]}>
          <BeaconCardArtwork category={category} accent={beaconControls.decoration_accent} variant={previewBackground} radius={12} />
          <BeaconIdentity
            title={title.trim() || "Untitled Beacon"}
            category={category}
            subtitle="Unpublished draft"
            emoji={beaconControls.decoration_emoji}
          />
          <Txt muted>Card background · Preview only</Txt>
          <Txt>
            {creationScheduleSummary(effectiveStartAt(), resolveActivityEndAt(effectiveStartAt(), duration, ends), creationTimezone, currentTime)}
          </Txt>
          <Txt>
            {placeType === "Online"
              ? url || "Meeting link required"
              : label || (pin ? "Pinned location" : "Location required")}
          </Txt>
          <Txt>{descriptionWithPrep()}</Txt>
        </View>
        <Text style={styles.h2}>Who can see it</Text>
        <Txt>
          {audienceName}
          {audienceId
            ? ` · ${data.squads.find((row) => row.id === audienceId)?.name ?? data.organizations.find((row) => row.id === audienceId)?.name ?? data.lists.find((row) => row.id === audienceId)?.name ?? "Selected target"}`
            : ""}
        </Txt>
        <Text style={styles.h2}>Invitations & notifications</Text>
        <Txt>
          {inviteeIds.length
            ? inviteeIds.map(inviteeLabel).join(", ")
            : "No invitations selected"}
        </Txt>
        <Txt muted>
          {inviteeIds.length
            ? "Invitations send when publication succeeds."
            : "Visibility alone does not send invitations."}
        </Txt>
        <Text style={styles.h2}>Joining</Text>
        <Txt>
          {approval}
          {beaconControls.capacity_limit
            ? ` · ${beaconControls.capacity_limit} spots · ${beaconControls.capacity_policy === "strict" ? "Maximum enforced" : "Advisory"}`
            : " · No limit"}
        </Txt>
        <Text style={styles.h2}>What will be created</Text>
        <Txt>
          {primaryAction}
          {templateEditor
            ? " · A reusable template; no Beacon is published"
            : addTo === "Plan"
              ? ` · ${ownPlans.find((row) => row.id === selectedPlanId)?.title ?? "Choose a Plan"}`
              : addTo === "Vote / Draw"
                ? ` · ${decision?.title || decisionTitle || "New Council and proposed option"}`
                : " · A new Beacon"}
        </Txt>
        <Txt muted>{moduleNames.join(" · ")}</Txt>
      </CreationPicker>
      <ConfirmDialog
        title="Invite more than 50 people?"
        visible={!!largeInviteSelection}
        onClose={() => setLargeInviteSelection(null)}
        message={"You selected " + (largeInviteSelection?.length ?? 0) + " people. We recommend 50 or fewer for a focused Beacon. Continue with everyone selected?"}
        confirmLabel={"Publish with " + (largeInviteSelection?.length ?? 0) + " invitations"}
        cancelLabel="Review people"
        onConfirm={async () => {
          if (!largeInviteSelection || largeInviteSelection.length !== inviteeIds.length || largeInviteSelection.some(id => !inviteeIds.includes(id))) {
            throw new Error("Your selection changed. Close this dialog and review the people again.");
          }
          await submit(true);
        }}
      />
    </CreationKeyboardScreen>
  );
}
