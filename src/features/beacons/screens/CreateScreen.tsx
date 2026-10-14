import { randomUUID } from "expo-crypto";
import { usesSharedStatusEditor } from "../statusRouteSeed";
import { LegacyStatusScreen } from "./LegacyStatusScreen";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CreateHome } from "@/src/features/beacons/CreateHome";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import type { BeaconDraft } from "@/src/features/planning/types";
import BeaconMap from "@/src/features/maps/components/BeaconMap";
import DateField from "@/components/DateField";
import { BeaconSettings } from "@/src/features/beacons/BeaconSettings";
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
import { resolveDefaultAudience } from "@/src/features/profile/settings/beaconDefaults";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { canViewProfile } from "@/src/features/profile/privacy";
import { atomicCreateAndInvite, createAndInvite, creationHandoffParams, creationStatusSeed, mergeCreationStatusSeed, newCreationInviteSession, parseCreationInvitees, validateCreationInvitees, type CreationInviteSession } from "@/src/features/beacons/createHandoff";
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
import { validateActivity } from "@/src/shared/domain";
import {
  durationMinutesForLabel,
  formatDurationLabel,
  resolveActivityEndAt,
} from "@/src/features/beacons/createTiming";
import {
  type SuggestedTool,
  type BeaconTemplate,
} from "@/src/shared/templates";
import {
  Action,
  AudiencePicker,
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

const suggestedToolNames: Record<SuggestedTool, string> = {
  chat: "Chat",
  checklist: "Checklist",
  notes: "Beacon Sketchboard",
  focus: "Timer",
  memories: "Beacon Memories",
  music: "Music",
  scoreboard: "Teams / Scoreboard",
};
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
  if (usesSharedStatusEditor(params)) return <LegacyStatusScreen params={params} />;
  return <CreateEditor key={JSON.stringify(params)} />;
}

function CreateEditor() {
  const { colors, styles } = useTheme();

  const { data, userId, act } = useBeacon();
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
    statusSourceId?: string;
    startsAt?: string;
    fromMap?: string;
    timezone?: string;
  }>();
  let creationTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if (typeof params.timezone === "string" && params.timezone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: params.timezone }); creationTimezone = params.timezone; }
    catch { /* Invalid route zones retain the normal creation default. */ }
  }
  const parsedInvitees = parseCreationInvitees(params.inviteeIds);
  const [inviteeIds, setInviteeIds] = useState(parsedInvitees.ids);
  const [inviteeError, setInviteeError] = useState(parsedInvitees.error);
  const [statusSourceDismissed, setStatusSourceDismissed] = useState(false);
  const statusSourceId = statusSourceDismissed ? undefined : params.statusSourceId;
  const statusSeed = creationStatusSeed(data, userId, statusSourceId, currentTime);
  const dataRef = useRef(data);
  useLayoutEffect(() => { dataRef.current = data; }, [data]);
  const invitationSession = useRef(newCreationInviteSession());
  const [createdSession, setCreatedSession] = useState<CreationInviteSession | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const retryBusyRef = useRef(false);
  const [templateNotice, setTemplateNotice] = useState("");
  const [workflowError, setWorkflowError] = useState("");
  const sourceError = statusSourceId && !statusSeed ? "This status is no longer available. Clear the status source to continue with a new Beacon." : "";
  const handoff = creationHandoffParams({ ...params, inviteeIds: inviteeError ? params.inviteeIds : JSON.stringify(inviteeIds), statusSourceId });
  const inviteeLabel = (id: string) => {
    const profile = data.profiles.find((person) => person.id === id);
    return userId && data.viewer_id === userId && (!createdSession || createdSession.viewerId === userId) && profile && canViewProfile(data, profile, userId) ? profile.name : "Unavailable friend";
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
  const previous = statusSourceId ? undefined : data.activities.find((a) => a.id === params.repeat);
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
  const [associationDraft, setAssociationDraft] = useState<{
    routeKey: string;
    value: { entity_type: SocialEntityType; entity_id: string } | null;
  }>(() => ({ routeKey: associationRouteKey, value: associationRouteSeed }));
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
      : params.startsAt && Number.isFinite(Date.parse(params.startsAt)) ? Date.parse(params.startsAt) : currentTime;
  const aspirations =
    data.profiles.find((p) => p.id === userId)?.aspiration_goals ?? [];
  const currentAspirationIds = new Set(
    aspirations.map((aspiration) => aspiration.id),
  );
  const [home, setHome] = useState(
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
  const [addTo, setAddTo] = useState(
    params.threadId ? "Vote / Draw" : params.planId ? "Plan" : "Standalone",
  );
  const [decisionKind, setDecisionKind] = useState("Vote");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionId, setDecisionId] = useState(params.threadId ?? "");
  const [selectedPlanId, setSelectedPlanId] = useState(params.planId ?? "");
  const [planPosition, setPlanPosition] = useState("End");
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
  const [associationSearch, setAssociationSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<BeaconTemplate | null>(
    null,
  );
  const [prepAnswers, setPrepAnswers] = useState<string[]>([]);
  const [view, setView] = useState("Normal");
  const [kind, setKind] = useState(
    params.kind === "status"
      ? "Status"
      : params.kind === "squad"
        ? "Squad"
        : "Beacon",
  );
  const [title, setTitle] = useState(statusSeed?.title ?? saved?.title ?? previous?.title ?? "");
  const [description, setDescription] = useState(
    statusSeed?.description ?? saved?.description ?? previous?.description ?? "",
  );
  const [templateName, setTemplateName] = useState(
    saved?.name ?? previous?.title ?? "",
  );
  const [available, setAvailable] = useState(false);
  const [category, setCategory] = useState<Category>(
    statusSeed?.category ?? saved?.category ?? previous?.category ?? "Social",
  );
  const sourceHydrated = useRef(!!statusSeed);
  const textEdited = useRef({ title: false, description: false, category: false });
  useEffect(() => {
    if (!statusSeed || sourceHydrated.current) return;
    const seeded = mergeCreationStatusSeed({ title, description, category }, statusSeed, textEdited.current);
    setTitle(seeded.title); setDescription(seeded.description); setCategory(seeded.category as Category);
    sourceHydrated.current = true;
  }, [statusSeed, title, description, category]);
  const audienceEdited = useRef(false);
  const appliedDeviceDefault = useRef<string | null>(null);
  const [defaultNotice, setDefaultNotice] = useState("");
  const [audience, setAudienceValue] = useState<Audience>(
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
  const [audienceId, setAudienceId] = useState<string | null>(
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
  ]);
  const [target, setTarget] = useState(
    saved?.target_count ? String(saved.target_count) : "",
  );
  const [approval, setApproval] = useState(
    saved?.approval_required ? "Host approval" : "Open joining",
  );
  const [when, setWhen] = useState(
      params.threadId || params.planId || params.startsAt && Number.isFinite(Date.parse(params.startsAt)) ? "Pick time" : "Now",
    ),
    [duration, setDuration] = useState(
      formatDurationLabel(saved?.minutes ?? 60),
    );
  const [starts, setStarts] = useState(() =>
    new Date(routeStart).toISOString(),
  );
  const [ends, setEnds] = useState(() =>
    new Date(routeStart + (saved?.minutes ?? 60) * 60000).toISOString(),
  );
  const [label, setLabel] = useState(params.placeLabel ?? saved?.label ?? "");
  const [placeType, setPlaceType] = useState("In person"),
    [url, setUrl] = useState("");
  const [pin, setPin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(() => {
    if (params.latitude == null || params.longitude == null) return null;
    const latitude = Number(params.latitude),
      longitude = Number(params.longitude);
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
      ? { latitude, longitude }
      : null;
  });
  const [showPin, setShowPin] = useState(false);
  const [beaconControlDraft, setBeaconControlDraft] = useState<{
    routeKey: string;
    value: BeaconControlValues;
  }>(() => ({
    routeKey: controlsRouteKey,
    value: saved?.module_defaults
      ? { ...defaultBeaconControlValues(), ...saved.module_defaults }
      : previous
        ? beaconControlValuesFromActivity(previous)
        : defaultBeaconControlValues(),
  }));
  const beaconControls =
    beaconControlDraft.routeKey === controlsRouteKey
      ? beaconControlDraft.value
      : defaultBeaconControlValues();
  const setBeaconControls = (value: BeaconControlValues) =>
    setBeaconControlDraft({ routeKey: controlsRouteKey, value });
  const [aspirationIds, setAspirationIds] = useState<string[]>(() =>
    (previous?.aspiration_ids ?? []).filter((id) =>
      currentAspirationIds.has(id),
    ),
  );
  function applyTemplate(t: BeaconTemplate) {
    if (!statusSourceId) {
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
      id: saved?.id,
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
    if (inviteeIds.length || inviteeError || statusSourceId) {
      setTemplateNotice("Template saved. Your Beacon draft and selected friends are still here.");
      return;
    }
    router.replace({
      pathname: "/(tabs)/activities",
      params: { filter: "Past" },
    });
  }
  async function publish() {
    if (invitationSession.current.createdId || invitationSession.current.creationUnverified) throw new Error("This Beacon has already been created. Use Retry invitations or Open Beacon.");
    if (inviteeError) throw new Error(inviteeError);
    if (sourceError) throw new Error(sourceError);
    if (inviteeIds.length && (kind === "Status" || addTo === "Vote / Draw")) throw new Error("Selected friends can be invited to a Beacon. Clear the selected friends before sharing a status or submitting a Vote / Draw proposal.");
    if (inviteeIds.length) validateCreationInvitees(dataRef.current, userId, inviteeIds);
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
      online_url: placeType === "Online" ? url : null,
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
        const created = await act("create_planning_thread", {
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
      await act("add_council_proposal", {
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
      const create = () => act("create_plan_beacon", { ...payload, plan_id: plan.id, position: planPosition === "End" ? count : Number(planPosition) - 1 });
      const result = inviteeIds.length ? await publishAtomic("create_plan_beacon_with_invitees", { ...payload, plan_id: plan.id, position: planPosition === "End" ? count : Number(planPosition) - 1 }) : await create();
      if (invitationSession.current.pendingIds.length) return;
      if (!result.id)
        throw new Error("The Beacon could not be added to this Plan.");
      router.replace({ pathname: "/plan/[id]", params: { id: plan.id } });
      return;
    }
    const create = () => act("create_activity", payload);
    const result = inviteeIds.length ? await publishAtomic("create_activity_with_invitees", payload) : await create();
    if (invitationSession.current.pendingIds.length) return;
    router.replace({
      pathname: "/(tabs)",
      params: {
        ...(typeof result.id === "string" ? { beacon: result.id } : {}),
        created: "yes",
      },
    });
  }
  async function publishAtomic(action: "create_activity_with_invitees" | "create_plan_beacon_with_invitees", payload: Record<string, unknown>) {
    try {
      const session=await atomicCreateAndInvite(invitationSession.current,inviteeIds,()=>dataRef.current,userId,action,payload,act,randomUUID);
      setCreatedSession(session);
      return {id:session.createdId};
    } finally {
      setCreatedSession(invitationSession.current.atomicAttempt || invitationSession.current.createdId || invitationSession.current.creationUnverified ? {...invitationSession.current} : null);
    }
  }
  async function confirmPublication() {
    const attempt=invitationSession.current.atomicAttempt;
    if (!attempt || retryBusyRef.current) return;
    retryBusyRef.current=true; setRetryBusy(true); setWorkflowError("");
    try {
      const result=await publishAtomic(attempt.action,attempt.payload);
      if (result.id) router.replace({pathname:"/activity/[id]",params:{id:result.id}});
    } catch (failure) { setWorkflowError(failure instanceof Error ? failure.message : "Could not confirm publication. Try again."); }
    finally { retryBusyRef.current=false; setRetryBusy(false); }
  }
  async function publishWithInvitees(create: () => Promise<Record<string, unknown>>) {
    try {
      const session = await createAndInvite(invitationSession.current, inviteeIds, () => dataRef.current, userId, create, act);
      setCreatedSession(session);
      return { id: session.createdId };
    } finally {
      if (invitationSession.current.createdId || invitationSession.current.creationUnverified) setCreatedSession({ ...invitationSession.current });
    }
  }
  async function retryInvitations() {
    if (retryBusyRef.current) return;
    retryBusyRef.current = true;
    setRetryBusy(true);
    try { await publishWithInvitees(async () => { throw new Error("This Beacon has already been created."); }); }
    finally { retryBusyRef.current = false; setRetryBusy(false); }
  }
  if (createdSession && (createdSession.viewerId !== userId || data.viewer_id !== userId)) return <Screen title={createdSession.createdId ? "Beacon created" : "Your Beacon draft"} eyebrow="MAKE TIME TOGETHER" create={false}><Txt muted>Return to the account that started this Beacon to review or retry publication.</Txt></Screen>;
  if (createdSession?.atomicAttempt && !createdSession.createdId) return <Screen title="Confirm publication" eyebrow="" create={false}>
    <Text style={styles.h2}>{String(createdSession.atomicAttempt.payload.title ?? title)}</Text>
    <Txt muted>The publication response was not confirmed. Your saved draft and selected invitations will be retried with the same request, preventing a second Beacon.</Txt>
    {!!workflowError && <Text accessibilityRole="alert" style={styles.error}>{workflowError}</Text>}
    <Txt muted>{(createdSession.atomicAttempt.payload.invitee_ids as string[]).length} selected invitation recipients remain in this saved attempt.</Txt>
    <Action title="Retry confirmation" disabled={retryBusy} run={confirmPublication} />
  </Screen>;
  if (createdSession?.createdId || createdSession?.creationUnverified) return <Screen title="Beacon created" eyebrow="MAKE TIME TOGETHER" create={false}>
    <Text style={styles.h2}>{title}</Text>
    <Txt muted>{createdSession.invitedIds.length} invitation{createdSession.invitedIds.length === 1 ? "" : "s"} sent or already active.</Txt>
    {createdSession.creationUnverified ? <Txt muted>The Beacon was created, but its ID could not be verified. Refresh before continuing.</Txt> : null}
    {!!createdSession.pendingIds.length && <Text accessibilityRole="alert" style={styles.error}>{createdSession.pendingIds.length} invitation{createdSession.pendingIds.length === 1 ? "" : "s"} still need to be sent.</Text>}
    {createdSession.pendingIds.map((id) => <View key={id} style={{ gap: 4 }}><Txt>{inviteeLabel(id)}</Txt><Txt muted>{createdSession.errors[id]}</Txt>
      <Button compact secondary disabled={retryBusy} title={`Remove ${inviteeLabel(id)} from pending invitations`} onPress={() => {
        if (retryBusyRef.current) return;
        setInviteeIds((ids) => ids.filter((item) => item !== id));
        invitationSession.current.pendingIds = invitationSession.current.pendingIds.filter((item) => item !== id);
        delete invitationSession.current.errors[id];
        setCreatedSession({ ...invitationSession.current });
      }} /></View>)}
    {!!createdSession.pendingIds.length && <Action title="Retry invitations" disabled={retryBusy} run={retryInvitations} />}
    {createdSession.createdId ? <Button title="Open Beacon" disabled={retryBusy} onPress={() => { if (!retryBusyRef.current) router.replace({ pathname: "/activity/[id]", params: { id: createdSession.createdId! } }); }} /> : null}
  </Screen>;
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
        context={handoff} selectedFriends={inviteeIds.map((id) => ({ id, name: inviteeLabel(id) }))}
        contextError={inviteeError || sourceError}
        onRemoveInvitee={(id) => setInviteeIds((ids) => ids.filter((item) => item !== id))}
        onClearInvitees={() => { setInviteeIds([]); setInviteeError(""); }}
        onClearStatusSource={() => setStatusSourceDismissed(true)}
        onBlank={() =>
          router.push({
            pathname: "/create",
            params: {
              editor: "yes",
              ...handoff,
            },
          })
        }
        onTemplate={(recipe) => {
          applyTemplate(recipe);
          setHome(false);
        }}
      />
    );
  return (
    <Screen
      title={
        templateEditor
          ? "Beacon Template"
          : kind === "Status"
            ? "Share a little update"
            : "Beacon Quick Editor"
      }
      eyebrow="SMALL PLANS. GOOD COMPANY."
      create={false}
      footer={
        <Action
          title={
            templateEditor
              ? "Save template"
              : kind === "Status"
                ? "Share my status"
                : addTo === "Vote / Draw"
                  ? "Add Suggested Beacon"
                  : addTo === "Plan"
                    ? "Add Beacon to Plan"
                    : "Create Beacon"
          }
          run={templateEditor ? saveTemplate : publish}
        />
      }
    >
      {inviteeError || sourceError ? <Text accessibilityRole="alert" style={styles.error}>{inviteeError || sourceError}</Text> : null}
      {workflowError ? <Text accessibilityRole="alert" style={styles.error}>{workflowError}</Text> : null}
      {templateNotice ? <Txt muted>{templateNotice}</Txt> : null}
      {(inviteeIds.length > 0 || !!inviteeError) && <View style={{ gap: 8 }}><Text style={styles.label}>SELECTED FRIENDS · {inviteeIds.length}</Text>
        <View style={[styles.row, { flexWrap: "wrap" }]}>{inviteeIds.map((id) => <Button key={id} compact secondary title={`Remove ${inviteeLabel(id)}`} onPress={() => setInviteeIds((ids) => ids.filter((item) => item !== id))} />)}</View>
        <Button compact secondary title="Clear selected friends" onPress={() => { setInviteeIds([]); setInviteeError(""); }} />
      </View>}
      {statusSourceId ? <Button compact secondary title="Clear status source" onPress={() => setStatusSourceDismissed(true)} /> : null}
      {!templateEditor && kind === "Beacon" && (
        <Button
          compact
          secondary
          title="← Blank or template"
          onPress={() => setHome(true)}
        />
      )}
      {templateEditor && (
        <Field
          label="Template name"
          value={templateName}
          onChangeText={setTemplateName}
          maxLength={80}
        />
      )}
      {kind === "Status" && (
        <Chips
          options={["Busy", "Free to hang"]}
          value={available ? "Free to hang" : "Busy"}
          onChange={(v) => setAvailable(v === "Free to hang")}
        />
      )}
      <Field
        label="Title / Activity"
        placeholder="A tiny adventure with your people"
        value={title}
        onChangeText={(value) => { textEdited.current.title = true; setTitle(value); }}
        maxLength={120}
      />
      {view === "Advanced" && !!selectedRecipe?.prepPrompts?.length && (
        <View style={[styles.card, { padding: 13, gap: 10 }]}>
          <Text style={styles.h2}>A few helpful details</Text>
          <Txt muted>
            Optional prompts from this template. Your answers are added to the
            beacon description so the group can see them.
          </Txt>
          {selectedRecipe.prepPrompts.map((prompt, index) => (
            <Field
              key={`${selectedRecipe.id}-${prompt}`}
              label={prompt}
              value={prepAnswers[index] ?? ""}
              onChangeText={(answer) =>
                setPrepAnswers((current) =>
                  current.map((value, answerIndex) =>
                    answerIndex === index ? answer : value,
                  ),
                )
              }
              maxLength={240}
            />
          ))}
          <Txt muted>
            Combined details: {descriptionWithPrep().length}/
            {templateEditor ? 1000 : 2000} characters
          </Txt>
        </View>
      )}
      {view === "Advanced" &&
        kind !== "Status" &&
        !!selectedRecipe?.suggestedTools?.length && (
          <View style={[styles.card, { padding: 13, gap: 5 }]}>
            <Text style={styles.label}>READY WITH</Text>
            <Text style={[styles.body, { fontWeight: "700" }]}>
              {selectedRecipe.suggestedTools
                .map((tool) => suggestedToolNames[tool])
                .join(" · ")}
            </Text>
            <Txt muted>
              These module defaults are ready for this recipe. Adjust them in
              Advanced options before publishing.
            </Txt>
          </View>
        )}
      <Field
        label="Where? (optional)"
        placeholder="Your usual spot, or decide together"
        value={label}
        onChangeText={setLabel}
        maxLength={160}
      />
      <Text style={styles.label}>TIME</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            title={
              when === "Pick time"
                ? new Date(starts).toLocaleString([], {
                    timeZone: creationTimezone,
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : when
            }
            onPress={() => setTiming(true)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button secondary title={duration} onPress={() => setTiming(true)} />
        </View>
      </View>
      {params.timezone ? <Txt muted>Time zone: {creationTimezone}</Txt> : null}
      <Sheet
        title="When shall we?"
        visible={timing}
        onClose={() => setTiming(false)}
      >
        <Chips
          options={["Now", "In 30 min", "Pick time"]}
          value={when}
          onChange={setWhen}
        />
        {when === "Pick time" && (
          <DateField label="Starts" value={starts} onChange={setStarts} />
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
          <DateField label="Ends" value={ends} onChange={setEnds} />
        )}
        <Button title="Done" onPress={() => setTiming(false)} />
      </Sheet>
      <Text style={styles.label}>PEOPLE / AUDIENCE</Text>
      <AudiencePicker
        value={audience}
        id={audienceId}
        onChange={(a, id) => {
          setAudience(a);
          setAudienceId(id);
        }}
      />
      {defaultNotice ? <Txt muted>{defaultNotice}</Txt> : null}
      {view === "Advanced" && kind !== "Status" ? (
        <View style={[styles.card, { gap: 7 }]}>
          <Text style={styles.label}>COMMUNITY CONTEXT</Text>
          <Txt muted>
            This optional association is separate from the audience and does not
            change who can see or join the Beacon.
          </Txt>
          <Button
            compact
            secondary
            title={
              selectedAssociationRow
                ? `Associated with ${selectedAssociationRow.name}`
                : "Choose a community"
            }
            onPress={() => setAssociationOpen(true)}
          />
        </View>
      ) : null}
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
        <Field
          label="Search communities you belong to"
          placeholder="Squad, Space, or Organization"
          value={associationSearch}
          onChangeText={setAssociationSearch}
        />
        {associationCandidates
          .filter((row) =>
            `${row.name} ${row.entity_type}`
              .toLowerCase()
              .includes(associationSearch.trim().toLowerCase()),
          )
          .map((row) => (
            <Button
              key={`${row.entity_type}:${row.entity_id}`}
              compact
              secondary
              title={`${row.entity_type === "organization" ? "Super-Organization" : row.entity_type === "space" ? "Organization" : "Squad"} · ${row.name}`}
              onPress={() => {
                setAssociationDraft({
                  routeKey: associationRouteKey,
                  value: {
                    entity_type: row.entity_type,
                    entity_id: row.entity_id,
                  },
                });
                setAssociationOpen(false);
                setAssociationSearch("");
              }}
            />
          ))}
        {!associationCandidates.length ? (
          <Empty
            title="No communities available"
            body="You can associate Beacons with communities you currently belong to."
          />
        ) : null}
      </Sheet>
      <Chips
        options={["In person", "Online"]}
        value={placeType}
        onChange={setPlaceType}
        showSelectedCheckmark={false}
      />
      {placeType === "Online" ? (
        <Field
          label="HTTPS link"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
      ) : null}
      {view === "Advanced" && kind !== "Status" ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>JOINING</Text>
          <Chips
            options={["Open joining", "Host approval"]}
            value={approval}
            onChange={setApproval}
            showSelectedCheckmark={false}
          />
        </View>
      ) : null}
      {!templateEditor && kind !== "Status" && (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>ADD TO</Text>
          <Chips
            options={["Standalone", "Vote / Draw", "Plan"]}
            value={addTo}
            onChange={(next) => {
              if (next === "Vote / Draw" && (inviteeIds.length || inviteeError)) { setWorkflowError("Clear selected friends before adding a Vote / Draw proposal. Invitations apply to the created Beacon."); return; }
              setWorkflowError(""); setAddTo(next);
            }}
            showSelectedCheckmark={false}
          />
          {addTo === "Vote / Draw" && (
            <>
              <Txt muted>
                A Suggested Beacon is an option. Vote lets participants choose;
                Draw picks one at random. The winner becomes a Beacon.
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
              {!!inviteeIds.length && <Txt muted>Choose an existing Plan to invite these friends to the new Beacon. Clear selected friends before creating a new Plan from this draft.</Txt>}
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
                    Plan Beacons use the Plan audience. Check this Beacon?s time
                    against the itinerary.
                  </Txt>
                </>
              )}
            </>
          )}
        </View>
      )}
      <Button
        compact
        secondary
        title={
          view === "Advanced" ? "Advanced Options ↑" : "Advanced Options ↓"
        }
        onPress={() => setView(view === "Advanced" ? "Normal" : "Advanced")}
      />
      {view === "Advanced" && kind !== "Status" && aspirations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.h2}>Connect to an aspiration</Text>
          {aspirations.length ? (
            aspirations.map((aspiration) => {
              const selected = aspirationIds.includes(aspiration.id);
              return (
                <Button
                  key={aspiration.id}
                  title={`${selected ? "✓ " : ""}${aspiration.title} · ${aspiration.target_per_week}/week`}
                  secondary={!selected}
                  onPress={() =>
                    setAspirationIds((current) =>
                      selected
                        ? current.filter((id) => id !== aspiration.id)
                        : [...current, aspiration.id],
                    )
                  }
                />
              );
            })
          ) : (
            <Txt muted>
              Add aspirations in your profile to connect them to beacons.
            </Txt>
          )}
        </View>
      )}
      <Txt muted>
        {kind === "Status"
          ? "Just your update. Switch to Beacon whenever you want company."
          : approval === "Host approval"
            ? "People request to join. You give the okay."
            : "One tap to join. Maybe is welcome. Plans can change."}
      </Txt>
      {view === "Advanced" && (
        <>
          <Text style={styles.h2}>Make it yours</Text>
          <Chips
            options={["Beacon", "Status", "Squad"]}
            value={kind}
            onChange={(k) => {
              if (k === "Status" && (inviteeIds.length || inviteeError || statusSourceId)) { setWorkflowError("Clear selected friends and the status source before sharing a separate status."); return; }
              setWorkflowError("");
              setKind(k);
              setAudience(k === "Squad" ? "squad" : "friends");
              setAudienceId(null);
            }}
          />

          {kind !== "Status" && (
            <Field
              label="How many make it happen? (optional)"
              placeholder="4 people for doubles, including you"
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
            />
          )}
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
            onChange={(value) => { textEdited.current.category = true; setCategory(value); }}
          />
          {kind !== "Status" && (
            <BeaconSettings
              key={`${controlsRouteKey}-${templateEditor ? "template" : "beacon"}`}
              value={beaconControls}
              onChange={setBeaconControls}
              templateMode={templateEditor}
              description={
                templateEditor
                  ? "These module defaults are saved with your template. You can still change them for each new Beacon."
                  : "Recipe recommendations can be changed here before you publish. Each new Beacon uses the choices shown."
              }
            />
          )}
          {placeType === "In person" && (
            <>
              <Button
                secondary
                title={
                  showPin
                    ? "Hide map"
                    : pin
                      ? "Edit meeting pin"
                      : "Add a meeting pin"
                }
                onPress={() => setShowPin(!showPin)}
              />
              {showPin && (
                <BeaconMap
                  activities={[]}
                  places={[]}
                  locations={[]}
                  profiles={[]}
                  onActivity={() => {}}
                  onPerson={() => {}}
                  onPick={(latitude, longitude) =>
                    setPin({ latitude, longitude })
                  }
                  selected={pin}
                />
              )}
              {pin && (
                <Button
                  secondary
                  title="Remove pin"
                  onPress={() => setPin(null)}
                />
              )}
            </>
          )}
          <Button
            secondary
            title="Set a custom end time"
            onPress={chooseCustomEnd}
          />
          {duration === "Custom" && (
            <DateField label="Ends" value={ends} onChange={setEnds} />
          )}
          <Field
            label="A little more detail (optional)"
            value={description}
            onChangeText={(value) => { textEdited.current.description = true; setDescription(value); }}
            multiline
            maxLength={2000}
          />
          {!templateEditor && (
            <>
              <Field
                label="Save this as a template (optional name)"
                value={templateName}
                onChangeText={setTemplateName}
                maxLength={80}
              />
              <Action title="Save as template" secondary run={saveTemplate} />
            </>
          )}
        </>
      )}
      {duration === "Custom" && view === "Normal" && (
        <Txt muted>
          Custom end: {new Date(ends).toLocaleString()}. Edit in More options.
        </Txt>
      )}
      {!templateEditor && (
        <View style={{ gap: 8 }}>
          <Button
            compact
            secondary
            title={previewOpen ? "Hide preview" : "Preview my Beacon"}
            onPress={() => setPreviewOpen(!previewOpen)}
          />
          {previewOpen && (
            <View
              style={[
                styles.card,
                { gap: 8, borderLeftWidth: 3, borderLeftColor: colors.green },
              ]}
            >
              <View style={styles.row}>
                <ActivityBadge category={category} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={styles.h2}>
                    {title.trim() || "Your next little plan"}
                  </Text>
                  <Text style={styles.label}>
                    {kind === "Status" ? "STATUS" : category.toUpperCase()} ·{" "}
                    {audience}
                  </Text>
                </View>
              </View>
              <Txt muted>
                {placeType === "Online"
                  ? "Virtual"
                  : label.trim() || "Place to be decided"}
              </Txt>
              {selectedAssociationRow ? (
                <Txt muted>
                  Community context · {selectedAssociationRow.name}
                </Txt>
              ) : null}
              <Txt muted>
                {when === "Pick time" && Number.isFinite(Date.parse(starts))
                  ? new Date(starts).toLocaleString()
                  : when}{" "}
                · {duration}
              </Txt>
              {kind !== "Status" && (
                <Txt muted>
                  {approval === "Host approval"
                    ? "Request to join"
                    : "Open joining"}
                  {beaconControls.capacity_limit != null
                    ? ` · ${beaconControls.capacity_limit} seats (${beaconControls.capacity_policy})`
                    : ""}
                </Txt>
              )}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
