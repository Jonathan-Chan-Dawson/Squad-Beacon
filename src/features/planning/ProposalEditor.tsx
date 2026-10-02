import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import DateField from "@/components/DateField";
import {
  Action,
  Button,
  Chips,
  Field,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import {
  beaconTemplateCatalog,
  searchBeaconTemplates,
  templates,
  type BeaconTemplate,
} from "@/src/shared/templates";
import type { Category } from "@/src/shared/types";
import { makeCouncilProposalDraft, validateCouncilProposal } from "./domain";
import type { BeaconDraft, PlanningThread } from "./types";

const categories: Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];
const quickRecipes = templates
  .filter((recipe): recipe is BeaconTemplate & { id: string } => !!recipe.id)
  .slice(0, 3);

function coordinate(value: string) {
  return value.trim() ? Number(value) : null;
}

export function ProposalEditor({
  thread,
  visible,
  onClose,
  onSave,
}: {
  thread: PlanningThread;
  visible: boolean;
  onClose: () => void;
  onSave: (draft: BeaconDraft) => Promise<unknown>;
}) {
  const { styles } = useTheme();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<BeaconDraft | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const results = useMemo(
    () => (query.trim() ? searchBeaconTemplates(query).slice(0, 8) : []),
    [query],
  );

  function close() {
    setAdvancedVisible(false);
    setDraft(null);
    setQuery("");
    setLatitude("");
    setLongitude("");
    onClose();
  }

  function selectRecipe(recipe: BeaconTemplate) {
    const selected = makeCouncilProposalDraft(thread, recipe, now);
    setDraft(selected);
    setLatitude("");
    setLongitude("");
  }

  function editedDraft(): BeaconDraft {
    if (!draft) throw new Error("Choose an activity idea first.");
    return {
      ...draft,
      latitude: coordinate(latitude),
      longitude: coordinate(longitude),
      audience: thread.audience,
      audience_id: thread.audience_id,
    };
  }

  async function saveSelected() {
    const payload = editedDraft();
    validateCouncilProposal(thread, payload, now);
    await onSave(payload);
    close();
  }

  return (
    <>
      <Sheet
        title="Add a beacon option"
        visible={visible && !advancedVisible}
        onClose={close}
      >
        <Txt muted>
          Quick-add a starter or search the full recipe catalog. Every option
          stays within this decision&apos;s audience.
        </Txt>
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>QUICK ADD</Text>
          {quickRecipes.map((recipe) => (
            <Action
              key={recipe.id}
              title={`Quick add ${recipe.label} - ${recipe.minutes} min`}
              secondary
              run={() =>
                onSave(makeCouncilProposalDraft(thread, recipe, now)).then(() => {
                  close();
                })
              }
            />
          ))}
        </View>
        <Field
          label="Search activity ideas"
          value={query}
          onChangeText={setQuery}
          placeholder="Try birdwatching, dinner, or study"
        />
        <Text style={styles.muted}>
          {query.trim()
            ? `${results.length} matching ideas shown`
            : `${beaconTemplateCatalog.length} searchable ideas`}
        </Text>
        <View style={{ gap: 7 }}>
          {results.map((recipe) => (
            <Button
              key={recipe.id}
              secondary={!draft || draft.title !== recipe.title}
              title={`Select ${recipe.title}, ${recipe.minutes} minutes, ${recipe.category}`}
              onPress={() => selectRecipe(recipe)}
            />
          ))}
          {query.trim() && results.length === 0 ? (
            <Txt muted>No matching ideas. Try a shorter search.</Txt>
          ) : !query.trim() ? (
            <Txt muted>Type a few words to browse activity ideas.</Txt>
          ) : null}
        </View>
        {draft ? (
          <View style={[styles.card, { gap: 10 }]}>
            <Text style={styles.label}>SELECTED OPTION</Text>
            <Field
              label="Option title"
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
              maxLength={120}
            />
            <Text style={styles.muted}>
              {draft.category} - {Math.round(
                (Date.parse(draft.ends_at) - Date.parse(draft.starts_at)) / 60000,
              )} min
            </Text>
            <Button
              title="Advanced details"
              secondary
              onPress={() => setAdvancedVisible(true)}
            />
            <Action title="Add selected option" run={saveSelected} />
          </View>
        ) : null}
      </Sheet>

      <Sheet
        title="Advanced option details"
        visible={visible && advancedVisible}
        onClose={() => setAdvancedVisible(false)}
      >
        {draft ? (
          <>
            <Txt muted>
              Shared with {thread.audience === "private" ? "you only" : thread.audience}
              {thread.audience_id ? " group" : ""}; this audience cannot be changed here.
            </Txt>
            <Field
              label="Description (optional)"
              value={draft.description}
              onChangeText={(description) => setDraft({ ...draft, description })}
              maxLength={2000}
              multiline
            />
            <View style={{ gap: 7 }}>
              <Text style={styles.muted}>Beacon category</Text>
              <Chips
                options={categories}
                value={draft.category}
                onChange={(category) => setDraft({ ...draft, category })}
              />
            </View>
            <DateField
              label="Option starts"
              value={draft.starts_at}
              onChange={(starts_at) => setDraft({ ...draft, starts_at })}
            />
            <DateField
              label="Option ends"
              value={draft.ends_at}
              onChange={(ends_at) => setDraft({ ...draft, ends_at })}
            />
            <Field
              label="Place name (optional)"
              value={draft.label}
              onChangeText={(label) => setDraft({ ...draft, label })}
              maxLength={160}
              placeholder="A public meeting spot or venue"
            />
            <Field
              label="Latitude (optional)"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numbers-and-punctuation"
              placeholder="41.88"
            />
            <Field
              label="Longitude (optional)"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numbers-and-punctuation"
              placeholder="-87.63"
            />
            <Button
              title="Back to idea"
              secondary
              onPress={() => setAdvancedVisible(false)}
            />
          </>
        ) : (
          <Txt muted>Choose an activity idea before editing its details.</Txt>
        )}
      </Sheet>
    </>
  );
}
