import { CreationDisclosure } from "../components/CreationDisclosure";
import { CreationPeople } from "../components/CreationPeople";
import { CreationAppearance } from "../components/CreationAppearance";
import { validCreationMeetingLink } from "../creationValidation";
import { BeaconIdentity } from "../components/BeaconIdentity";
import { CreationDateField } from "../components/CreationDateField";
import { localDate, validateActivity } from "@/src/shared/domain";
import { addLocalDays } from "@/src/features/plans/routines";
import { planLocalDateTimeToISO } from "@/src/features/plans/domain";
import {
  CreationRow,
  CreationSwitch,
  CreationModuleControls,
} from "../components/CreationControls";
import { creationModules } from "../creationModules";
import { runFrozenPublication, type FrozenPublication } from "../draftSnapshot";

import { activityNoteSeed } from "../livingActivity";
import { CreationLocationInput } from "../components/CreationLocationInput";
import { SocialSelector } from "@/src/features/people/components/SocialSelector";
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
  Audience,
  BeaconModuleDefaults,
  Category,
} from "@/src/shared/types";

import {
  durationMinutesForLabel,
  formatDurationLabel,
  resolveActivityEndAt,
} from "@/src/features/beacons/createTiming";
import { type BeaconTemplate } from "@/src/shared/templates";
import {
  Action,
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
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
export default function CreateActivity() {
  const params = useLocalSearchParams();
  const { userId } = useBeacon();
  if (typeof params.resumeDraft === "string")
    return (
      <RestoreDraft
        key={userId + params.resumeDraft}
        token={params.resumeDraft}
      />
    );
  if (usesSharedStatusEditor(params))
    return <LegacyStatusScreen params={params} />;
  return <CreateEditor key={userId + JSON.stringify(params)} />;
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

function CreateEditor() {
  const { styles } = useTheme();

  const { data, userId, act, getViewerEpoch } = useBeacon();
  const currentTime = useNow();
  const params = useLocalSearchParams<{
    kind?: string;
    editor?: string;
    planId?: string;
    threadId?: string;
    squadId?: string;
    spaceId?: string;
    organizationId?: string;
    latitude?: string;
    longitude?: string;
    placeLabel?: string;
    repeat?: string;
    template?: string;
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [associationOpen, setAssociationOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] =
    usePlanningDraftState<BeaconTemplate | null>(
      userId,
      draftToken,
      "selectedRecipe",
      null,
    );
  const [prepAnswers, setPrepAnswers] = usePlanningDraftState<string[]>(
    userId,
    draftToken,
    "prepAnswers",
    [],
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
    statusSeed?.title ?? saved?.title ?? previous?.title ?? "",
  );
  const [description, setDescription] = usePlanningDraftState(
    userId,
    draftToken,
    "description",
    statusSeed?.description ??
      saved?.description ??
      previous?.description ??
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
    statusSeed?.category ?? saved?.category ?? previous?.category ?? "Social",
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
      templateEditor
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
      formatDurationLabel(saved?.minutes ?? 60),
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
    () => new Date(routeStart + (saved?.minutes ?? 60) * 60000).toISOString(),
  );
  const [label, setLabel] = usePlanningDraftState(
    userId,
    draftToken,
    "label",
    params.placeLabel ??
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
  const [optionalSection, setOptionalSection] = usePlanningDraftState<
    "none" | "modules" | "advanced"
  >(userId, draftToken, "creationOptionalSection", "none");
  const [allAspirations, setAllAspirations] = useState(false);
  const [descriptionHeight, setDescriptionHeight] = useState(96);
  const [savingDraft, setSavingDraft] = useState(false);
  const savingDraftRef = useRef(false);
  const capacityInput = useRef<TextInput>(null),
    musicInput = useRef<TextInput>(null),
    descriptionInput = useRef<TextInput>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [scrollRequest, setScrollRequest] = useState<{
    y: number;
    sequence: number;
  }>();
  const scrollSequence = useRef(0);
  const scrollPosition = useRef(0);
  const anchorVersion = useRef(0);
  const advancedSection = useRef<View>(null);
  const pendingAnchor = useRef<{ screenY: number; version: number } | null>(
    null,
  );
  function toggleOptional(section: "modules" | "advanced") {
    const version = ++anchorVersion.current;
    pendingAnchor.current = null;
    if (
      optionalSection === "modules" &&
      section === "advanced" &&
      advancedSection.current
    ) {
      // Measure the actual viewport position: web onLayout does not report sibling-only movement.
      advancedSection.current.measureInWindow((_x, y) => {
        if (anchorVersion.current !== version) return;
        pendingAnchor.current = { screenY: y, version };
        setOptionalSection(section);
      });
    } else setOptionalSection(optionalSection === section ? "none" : section);
  }
  function recordSection(key: string, y: number) {
    sectionY.current[key] = y;
    const anchor = pendingAnchor.current;
    if (anchor && key === "advanced") {
      pendingAnchor.current = null;
      requestAnimationFrame(() => {
        advancedSection.current?.measureInWindow((_x, screenY) => {
          if (anchorVersion.current !== anchor.version) return;
          const delta = screenY - anchor.screenY;
          if (Math.abs(delta) > 2)
            setScrollRequest({
              y: Math.max(0, scrollPosition.current + delta) + 12,
              sequence: ++scrollSequence.current,
            });
        });
      });
    }
  }
  function reveal(
    section: "people" | "modules" | "advanced",
    input?: React.RefObject<TextInput | null>,
  ) {
    pendingAnchor.current = null;
    anchorVersion.current++;
    if (section !== "people") setOptionalSection(section);
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
  const [destinationOpen, setDestinationOpen] = useState(false);
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
  const publicationBusy = useRef(false);
  const [beaconControlDraft, setBeaconControlDraft] = usePlanningDraftState<{
    routeKey: string;
    value: BeaconControlValues;
  }>(userId, draftToken, "beaconControlDraft", () => ({
    routeKey: controlsRouteKey,
    value: saved?.module_defaults
      ? { ...defaultBeaconControlValues(), ...saved.module_defaults }
      : previous
        ? {
            ...beaconControlValuesFromActivity(previous),
            capacity_limit: null,
            capacity_policy: "soft" as const,
            manual_closed: false,
            checklist_edit_policy: "participants" as const,
          }
        : defaultBeaconControlValues(),
  }));
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
    const modules = new Set(t.suggestedTools ?? []);
    const moduleDefaults = {
      enable_chat: modules.size === 0 || modules.has("chat"),
      enable_checklist: modules.has("checklist"),
      enable_journal: modules.has("notes"),
      enable_focus: modules.has("focus"),
      enable_experiences: modules.has("memories"),
      enable_scoreboard: modules.has("scoreboard"),
      enable_music: modules.has("music"),
    };
    setBeaconControls({
      ...beaconControls,
      ...moduleDefaults,
    } as BeaconControlValues);
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
  function effectiveStartAt() {
    return when === "Now"
      ? currentTime
      : when === "In 30 min"
        ? currentTime + 1800000
        : Date.parse(starts);
  }
  function chooseCustomEnd() {
    if (duration !== "Custom")
      setEnds(resolveActivityEndAt(effectiveStartAt(), duration, ends));
    setDuration("Custom");
  }
  async function saveTemplate() {
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
  async function submit() {
    if (publicationBusy.current) return;
    publicationBusy.current = true;
    setFieldError(null);
    try {
      await publish();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not publish this Beacon.";
      setWorkflowError(message);
      setFieldError({
        field:
          /capacity|spots|limit|approval|audience|share with|friend|eligible/i.test(
            message,
          )
            ? "people"
            : /music/i.test(message)
              ? "modules"
              : /description|details|characters/i.test(message)
                ? "advanced"
                : "publication",
        message,
      });
      if (
        /capacity|spots|limit|approval|audience|share with|friend|eligible/i.test(
          message,
        )
      )
        reveal(
          "people",
          /capacity|spots|limit/i.test(message) ? capacityInput : undefined,
        );
      else if (
        /end time|start time|duration|future time|deadline/i.test(message)
      )
        setTiming(true);
      else if (/music/i.test(message)) reveal("modules", musicInput);
      else if (/description|details|characters/i.test(message))
        reveal("advanced", descriptionInput);
      throw error;
    } finally {
      publicationBusy.current = false;
    }
  }
  async function publish() {
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
    if (previous && !reuseReviewed) {
      reveal("people");
      throw new Error(
        "Review the reused location and People & Community, then confirm your review before creating.",
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
      placeType === "Online" &&
      !validCreationMeetingLink(url)
    ) {
      setFieldError({
        field: "location",
        message: "Enter a secure meeting link beginning with https://.",
      });
      throw new Error("Enter a secure meeting link beginning with https://.");
    }
    const start = effectiveStartAt();
    const finalDescription = descriptionWithPrep();
    const controls =
      kind === "Status"
        ? null
        : validateBeaconControlValues({ ...beaconControls });
    if (finalDescription.length > 2000)
      throw new Error(
        `Combined details are ${finalDescription.length}/2000 characters. Shorten the description or template answers before publishing.`,
      );
    const payload = {
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
      if (invitationSession.current.pendingIds.length) return;
      if (!result.id)
        throw new Error("The Beacon could not be added to this Plan.");
      completePlanningDraft(userId, draftToken);
      router.replace({ pathname: "/plan/[id]", params: { id: plan.id } });
      return;
    }
    const create = () => durableAction("create_activity", payload);
    const result = inviteeIds.length
      ? await publishAtomic("create_activity_with_invitees", payload)
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
    if (invitationSession.current.pendingIds.length) return;
    completePlanningDraft(userId, draftToken);
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
      if (result.id)
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
            if (attempt.action === "create_planning_thread") {
              setDecisionId(String(result.id));
              await checkpoint();
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
  const standardDurations = ["30 min", "1 hour", "2 hours"];
  const durationOptions = [
    ...(standardDurations.includes(duration) || duration === "Custom"
      ? standardDurations
      : [duration, ...standardDurations]),
    "Custom",
  ];
  if (home)
    return (
      <CreateHome
        inviteeControl={
          <CreationInvitees ids={inviteeIds} onChange={setInviteeIds} />
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
  const primaryAction = templateEditor
    ? "Save Template"
    : addTo === "Plan"
      ? "Add Beacon Step"
      : addTo === "Vote / Draw"
        ? "Submit Council Option"
        : "Create Beacon";
  const stamp = (date: number) =>
    Number.isFinite(date)
      ? new Date(date).toLocaleString([], {
          timeZone: creationTimezone,
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Choose time";
  const errorFor = (field: string) =>
    fieldError?.field === field ? (
      <Text accessibilityRole="alert" style={styles.error}>
        {fieldError.message}
      </Text>
    ) : null;
  return (
    <Screen
      title={templateEditor ? "Beacon Template" : "Create Beacon"}
      eyebrow=""
      compactHeader
      iconOnlyBack
      scrollRequest={scrollRequest}
      scrollPositionRef={scrollPosition}
      create={false}
      headerAction={
        <Button
          compact
          secondary
          title={savingDraft ? "Saving…" : "Save Draft"}
          disabled={savingDraft}
          onPress={() => void saveDraft()}
        />
      }
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              title="Preview"
              onPress={() => setPreviewOpen(true)}
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
      {previous ? (
        <Txt muted>
          Reusing {previous.title} · Review time, location, and access.
        </Txt>
      ) : null}
      {addTo !== "Standalone" ? (
        <Txt muted>
          {addTo === "Plan"
            ? `Adding to: ${ownPlans.find((row) => row.id === selectedPlanId)?.title ?? "Choose a Plan"}`
            : `Council proposal: ${decision?.title ?? "New Council"}`}
        </Txt>
      ) : null}
      {templateEditor ? (
        <Field
          label="Template name"
          value={templateName}
          onChangeText={setTemplateName}
          maxLength={80}
        />
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose artwork"
          onPress={() => setAppearanceOpen(true)}
          style={{
            minWidth: 52,
            minHeight: 52,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {beaconControls.decoration_emoji ? (
            <Text style={{ fontSize: 32 }}>
              {beaconControls.decoration_emoji}
            </Text>
          ) : (
            <ActivityBadge category={category} size={48} />
          )}
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Field
            label="Activity title"
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose category"
        style={{ minHeight: 44, justifyContent: "center" }}
        onPress={() => setAppearanceOpen(true)}
      >
        <Txt muted>{category} · Change category</Txt>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <CreationRow
            title="Starts"
            detail={stamp(effectiveStartAt())}
            onPress={() => setTiming(true)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <CreationRow
            title="Ends"
            detail={stamp(
              Date.parse(
                resolveActivityEndAt(effectiveStartAt(), duration, ends),
              ),
            )}
            onPress={() => setTiming(true)}
          />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.label}>LOCATION</Text>
          <Button
            compact
            secondary
            title={placeType === "Online" ? "Use in person" : "Use online"}
            onPress={() =>
              setPlaceType(placeType === "Online" ? "In person" : "Online")
            }
          />
        </View>
        {placeType === "Online" ? (
          <Field
            label="HTTPS meeting link"
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
            <CreationInvitees ids={inviteeIds} onChange={setInviteeIds} />
          }
          community={
            selectedAssociationRow
              ? `${selectedAssociationRow.name} · ${selectedAssociationRow.entity_type === "space" ? "Organization" : selectedAssociationRow.entity_type === "organization" ? "Network" : "Squad"}`
              : selectedAssociation
                ? "Unavailable community"
                : undefined
          }
          onCommunity={() => setAssociationOpen(true)}
          onClearCommunity={() =>
            setAssociationDraft({ routeKey: associationRouteKey, value: null })
          }
          approval={approval}
          onApproval={setApproval}
          controls={beaconControls}
          onControls={setBeaconControls}
          capacityRef={capacityInput}
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
      <View
        onLayout={(event) => {
          recordSection("modules", event.nativeEvent.layout.y);
        }}
      >
        <CreationDisclosure
          title="Modules"
          summary={moduleNames.join(" · ") || "No optional modules"}
          open={optionalSection === "modules"}
          onToggle={() => toggleOptional("modules")}
        >
          {errorFor("modules")}
          <CreationModuleControls
            value={beaconControls}
            onChange={setBeaconControls}
            category={category}
            musicInputRef={musicInput}
          />
        </CreationDisclosure>
      </View>
      <View
        ref={advancedSection}
        onLayout={(event) => {
          recordSection("advanced", event.nativeEvent.layout.y);
        }}
      >
        <CreationDisclosure
          title="Advanced Options"
          summary="Details · Appearance · Aspirations · Template"
          open={optionalSection === "advanced"}
          onToggle={() => toggleOptional("advanced")}
        >
          {errorFor("advanced")}
          <Field
            label="Description & details"
            inputRef={descriptionInput}
            scrollEnabled={false}
            style={{ minHeight: 96, height: descriptionHeight }}
            onContentSizeChange={(event) =>
              setDescriptionHeight(
                Math.max(96, event.nativeEvent.contentSize.height),
              )
            }
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={templateEditor ? 1000 : 2000}
          />
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
          <Text style={styles.h2}>Appearance</Text>
          <CreationAppearance
            value={beaconControls}
            onChange={setBeaconControls}
          />
          <Text style={styles.h2}>
            Aspirations
            {aspirationIds.length ? ` · ${aspirationIds.length} selected` : ""}
          </Text>
          <Txt muted>
            {aspirations
              .filter((row) => aspirationIds.includes(row.id))
              .slice(0, 3)
              .map((row) => row.title)
              .join(" · ") || "No aspiration selected"}
          </Txt>
          <Field
            label="Search aspirations"
            value={aspirationQuery}
            onChangeText={setAspirationQuery}
          />
          {aspirations
            .filter((row) =>
              row.title.toLowerCase().includes(aspirationQuery.toLowerCase()),
            )
            .slice(0, 8)
            .map((row) => (
              <CreationSwitch
                key={row.id}
                title={row.title}
                value={aspirationIds.includes(row.id)}
                onChange={(value) =>
                  setAspirationIds((current) =>
                    value
                      ? [...current, row.id]
                      : current.filter((id) => id !== row.id),
                  )
                }
              />
            ))}
          {aspirations.filter((row) =>
            row.title.toLowerCase().includes(aspirationQuery.toLowerCase()),
          ).length > 8 ? (
            <Button
              compact
              secondary
              title="See more aspirations"
              onPress={() => setAllAspirations(true)}
            />
          ) : null}
          {!aspirations.length ? (
            <Txt muted>Add aspirations in your profile to connect them.</Txt>
          ) : null}
          {!templateEditor ? (
            <>
              <Field
                label="Template name"
                value={templateName}
                onChangeText={setTemplateName}
                maxLength={80}
              />
              <Action secondary title="Save as template" run={saveTemplate} />
            </>
          ) : null}
          <Text style={styles.h2}>Public discovery</Text>
          <Txt muted>
            Manage public discovery after creating. Exact meeting details and
            participant tools keep their existing access protections. Sonar
            sharing is separate.
          </Txt>
        </CreationDisclosure>
      </View>
      {!templateEditor ? (
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: "center" }}
          onPress={() => setDestinationOpen(true)}
        >
          <Txt muted>
            {addTo === "Standalone"
              ? "Add to Plan or Council"
              : "Change destination"}
          </Txt>
        </Pressable>
      ) : null}
      <Sheet
        title="When shall we?"
        visible={timing}
        onClose={() => setTiming(false)}
      >
        {workflowError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {workflowError}
          </Text>
        ) : null}
        <Chips
          options={["Now", "In 30 min", "Later today", "Tomorrow", "Pick time"]}
          value={when}
          onChange={(value) => {
            if (value === "Tomorrow") {
              setStarts(
                planLocalDateTimeToISO(
                  addLocalDays(
                    localDate(new Date(currentTime), creationTimezone),
                    1,
                  ),
                  "17:00",
                  creationTimezone,
                ),
              );
              setWhen("Pick time");
            } else if (value === "Later today") {
              setStarts(new Date(currentTime + 3600000).toISOString());
              setWhen("Pick time");
            } else setWhen(value);
          }}
        />
        {when === "Pick time" && (
          <CreationDateField
            label="Starts"
            value={starts}
            onChange={setStarts}
            timezone={creationTimezone}
          />
        )}
        <Txt muted>How long?</Txt>
        <Chips
          options={durationOptions}
          value={duration}
          onChange={(nextDuration) => {
            if (nextDuration === "Custom") chooseCustomEnd();
            else setDuration(nextDuration);
          }}
        />
        {duration === "Custom" && (
          <CreationDateField
            label="Ends"
            value={ends}
            onChange={setEnds}
            timezone={creationTimezone}
          />
        )}
        <Button title="Done" onPress={() => setTiming(false)} />
      </Sheet>

      <Sheet
        title="Associate with a community"
        visible={associationOpen}
        onClose={() => setAssociationOpen(false)}
      >
        <Txt muted>
          Association organizes community activity; the Beacon’s audience
          remains unchanged.
        </Txt>
        <Button
          compact
          secondary
          title="No community association"
          onPress={() => {
            setAssociationDraft({ routeKey: associationRouteKey, value: null });
            setAssociationOpen(false);
          }}
        />
        <SocialSelector
          supportedKinds={["squad", "space", "organization"]}
          multiple={false}
          selected={
            selectedAssociation
              ? [
                  {
                    kind: selectedAssociation.entity_type,
                    id: selectedAssociation.entity_id,
                  },
                ]
              : []
          }
          eligibleGroupKeys={associationCandidates.map(
            (row) => `${row.entity_type}:${row.entity_id}`,
          )}
          onChange={(rows) => {
            const row = rows[0];
            if (!row || row.kind === "friend") return;
            setAssociationDraft({
              routeKey: associationRouteKey,
              value: { entity_type: row.kind, entity_id: row.id },
            });
            setAssociationOpen(false);
          }}
        />
        {!associationCandidates.length ? (
          <Empty
            title="No communities available"
            body="You can associate Beacons with communities you currently belong to."
          />
        ) : null}
      </Sheet>

      <Sheet
        title="Appearance"
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        footer={
          <Button title="Done" onPress={() => setAppearanceOpen(false)} />
        }
      >
        <Text style={styles.h2}>Category</Text>
        <Chips
          options={
            [
              "Fitness",
              "Study",
              "Gaming",
              "Creative",
              "Social",
              "Other",
            ] as const
          }
          value={category}
          onChange={(value) => {
            textEdited.current.category = true;
            setCategory(value);
          }}
        />
        <CreationAppearance
          value={beaconControls}
          onChange={setBeaconControls}
        />
      </Sheet>
      <Sheet
        title="Choose aspirations"
        visible={allAspirations}
        onClose={() => setAllAspirations(false)}
        footer={
          <Button title="Done" onPress={() => setAllAspirations(false)} />
        }
      >
        <Field
          label="Search all aspirations"
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
                    ? [...current, row.id]
                    : current.filter((id) => id !== row.id),
                )
              }
            />
          ))}
      </Sheet>
      <Sheet
        title="Add to Plan or Council"
        snapHeight={560}
        visible={destinationOpen}
        onClose={() => setDestinationOpen(false)}
        footer={
          <Button title="Done" onPress={() => setDestinationOpen(false)} />
        }
      >
        {" "}
        {!templateEditor && kind !== "Status" && (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>ADD TO</Text>
            <Chips
              options={["Standalone", "Vote / Draw", "Plan"]}
              value={addTo}
              onChange={(next) => {
                if (
                  next === "Vote / Draw" &&
                  (inviteeIds.length || inviteeError)
                ) {
                  setWorkflowError(
                    "Clear selected friends before adding a Vote / Draw proposal. Invitations apply to the created Beacon.",
                  );
                  return;
                }
                setWorkflowError("");
                setAddTo(next);
              }}
              showSelectedCheckmark={false}
            />
            {addTo === "Vote / Draw" && (
              <>
                <Txt muted>
                  A Suggested Beacon is an option. Vote lets participants
                  choose; Draw picks one at random. The winner becomes a Beacon.
                </Txt>
                <Button
                  compact
                  secondary={!decisionId}
                  title="New Vote / Draw"
                  onPress={() => setDecisionId("")}
                />
                {!decisionId && (
                  <>
                    <Chips
                      options={["Vote", "Draw"]}
                      value={decisionKind}
                      onChange={setDecisionKind}
                    />
                    <Field
                      label="Decision name (optional)"
                      value={decisionTitle}
                      onChangeText={setDecisionTitle}
                      placeholder="What should we do?"
                      maxLength={100}
                    />
                  </>
                )}
                {decisions.map((item) => (
                  <Button
                    key={item.id}
                    compact
                    secondary={decisionId !== item.id}
                    title={`${item.kind === "vote" ? "Vote" : "Draw"} · ${item.title}`}
                    onPress={() => {
                      setDecisionId(item.id);
                      setAudience(item.audience);
                      setAudienceId(item.audience_id);
                    }}
                  />
                ))}
                {decision && (
                  <Txt muted>
                    Decide by {new Date(decision.deadline_at).toLocaleString()}.
                    Add more suggestions in this decision.
                  </Txt>
                )}
              </>
            )}
            {addTo === "Plan" && (
              <>
                {!!inviteeIds.length && (
                  <Txt muted>
                    Choose an existing Plan to invite these friends to the new
                    Beacon. Clear selected friends before creating a new Plan
                    from this draft.
                  </Txt>
                )}
                <Button
                  compact
                  secondary
                  title="+ New Plan with this Beacon"
                  disabled={inviteeIds.length > 0 || !!inviteeError}
                  onPress={() =>
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
                          start_time: new Date(
                            effectiveStartAt(),
                          ).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                          }),
                          duration_minutes: durationMinutesForLabel(
                            duration,
                            starts,
                            ends,
                          ),
                          aspiration_ids: aspirationIds,
                        }),
                      },
                    })
                  }
                />
                {ownPlans.map((item) => (
                  <Button
                    key={item.id}
                    compact
                    secondary={selectedPlanId !== item.id}
                    title={item.title}
                    onPress={() => {
                      setSelectedPlanId(item.id);
                      setPlanPosition("End");
                      setAudience(item.squad_id ? "squad" : "private");
                      setAudienceId(item.squad_id);
                    }}
                  />
                ))}
                {!!selectedPlanId && (
                  <>
                    <Txt muted>Where in the Plan?</Txt>
                    <Chips
                      options={[
                        ...data.activities
                          .filter((item) => item.plan_id === selectedPlanId)
                          .map((_, index) => String(index + 1)),
                        "End",
                      ]}
                      value={planPosition}
                      onChange={setPlanPosition}
                    />
                    <Txt muted>
                      Plan Beacons use the Plan audience. Check this Beacon?s
                      time against the itinerary.
                    </Txt>
                  </>
                )}
              </>
            )}
          </View>
        )}
      </Sheet>
      <Sheet
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
          <BeaconIdentity
            title={title.trim() || "Untitled Beacon"}
            category={category}
            subtitle="Unpublished draft"
          />
          <Txt>
            {stamp(effectiveStartAt())} -{" "}
            {stamp(
              Date.parse(
                resolveActivityEndAt(effectiveStartAt(), duration, ends),
              ),
            )}
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
      </Sheet>
    </Screen>
  );
}
