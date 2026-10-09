import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button, Field } from "@/src/shared/ui";
import { Chip, useDesignTheme } from "@/src/shared/design-system";
import { IDENTITY_CATALOG, INTEREST_CATALOG } from "@/src/shared/interestCatalog";
import type { AspirationGoal } from "@/src/shared/types";

export function EditorInterests({ values, onChange, disabled }: {
  values: string[]; onChange: (values: string[]) => void; disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(INTEREST_CATALOG[0].name);
  const [custom, setCustom] = useState("");
  const { colors } = useDesignTheme();
  const choices = useMemo(() => [...new Set(INTEREST_CATALOG
    .filter((group) => query.trim() || group.name === category)
    .flatMap((group) => group.subcategories.flatMap((sub) => sub.interests)))]
    .filter((interest) => !query.trim() || interest.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [category, query]);
  const toggle = (value: string) => onChange(values.includes(value)
    ? values.filter((item) => item !== value) : [...values, value]);
  return <View style={{ gap: 12 }}>
    <Field label="Search interests" value={query} onChangeText={setQuery} editable={!disabled} />
    {values.length > 0 && <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Your interests</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {values.map((value) => <Chip key={value} label={value} selected disabled={disabled}
          accessibilityLabel={`Remove ${value} interest`} onPress={() => toggle(value)} />)}
      </View>
    </View>}
    {!query.trim() && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {INTEREST_CATALOG.map((group) => <Chip key={group.name} label={group.name}
        selected={category === group.name} disabled={disabled} onPress={() => setCategory(group.name)} />)}
    </View>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {choices.map((value) => <Chip key={value} label={value} selected={values.includes(value)}
        accessibilityLabel={`${values.includes(value) ? "Remove" : "Choose"} ${value} interest`}
        disabled={disabled} onPress={() => toggle(value)} />)}
    </View>
    {choices.length === 0 && <Text style={{ color: colors.textSecondary, fontSize: 16 }}>No catalog matches. Add your own below.</Text>}
    <Field label="Custom interest" value={custom} onChangeText={setCustom} maxLength={80} editable={!disabled} />
    <Button title="Add interest" secondary disabled={disabled || !custom.trim()}
      onPress={() => { const value = custom.trim(); if (value && !values.includes(value)) onChange([...values, value]); setCustom(""); }} />
  </View>;
}

export function EditorIdentity({ values, onChange, disabled }: {
  values: string[]; onChange: (values: string[]) => void; disabled: boolean;
}) {
  const [group, setGroup] = useState(IDENTITY_CATALOG[0].name);
  const [custom, setCustom] = useState("");
  const toggle = (value: string) => onChange(values.includes(value)
    ? values.filter((item) => item !== value) : [...values, value]);
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((value) => <Chip key={value} label={value} selected disabled={disabled}
        accessibilityLabel={`Remove ${value} identity badge`} onPress={() => toggle(value)} />)}
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {IDENTITY_CATALOG.map((item) => <Chip key={item.name} label={item.name} selected={group === item.name}
        disabled={disabled} onPress={() => setGroup(item.name)} />)}
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {IDENTITY_CATALOG.find((item) => item.name === group)?.tags.map((tag) => {
        const value = `${group}: ${tag}`;
        return <Chip key={value} label={tag} selected={values.includes(value)}
          disabled={disabled || (!values.includes(value) && values.length >= 50)}
          onPress={() => toggle(value)} />;
      })}
    </View>
    <Field label="Custom identity badge" value={custom} onChangeText={setCustom} maxLength={60} editable={!disabled} />
    <Button title="Add identity badge" secondary disabled={disabled || !custom.trim() || values.length >= 50}
      onPress={() => { const value = custom.trim(); if (value && !values.includes(value)) onChange([...values, value]); setCustom(""); }} />
  </View>;
}

export function EditorAspirations({ values, onChange, disabled }: {
  values: AspirationGoal[]; onChange: (values: AspirationGoal[]) => void; disabled: boolean;
}) {
  const { colors } = useDesignTheme();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Fitness");
  const [target, setTarget] = useState(3);
  const update = (id: string, changes: Partial<AspirationGoal>) => onChange(values.map((goal) => goal.id === id ? { ...goal, ...changes } : goal));
  const targetPicker = (value: number, onPick: (value: number) => void, label: string) =>
    <View accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {[1, 2, 3, 4, 5, 6, 7].map((number) => <Chip key={number} label={String(number)} selected={value === number}
        accessibilityLabel={`${label}: ${number} per week`} disabled={disabled} onPress={() => onPick(number)} />)}
    </View>;
  return <View style={{ gap: 16 }}>
    {values.map((goal) => <View key={goal.id} style={{ gap: 10, padding: 12, borderRadius: 20, backgroundColor: colors.surfaceRaised }}>
      <Field label="Aspiration title" value={goal.title} onChangeText={(value) => update(goal.id, { title: value })} maxLength={100} editable={!disabled} />
      <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Weekly target</Text>
      {targetPicker(goal.target_per_week, (value) => update(goal.id, { target_per_week: value }), `Weekly target for ${goal.title}`)}
      <Button title={`Remove ${goal.title || "aspiration"}`} secondary compact disabled={disabled}
        onPress={() => onChange(values.filter((item) => item.id !== goal.id))} />
    </View>)}
    <Field label="New aspiration" value={title} onChangeText={setTitle} maxLength={100} editable={!disabled} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {["Fitness", "Study", "Gaming", "Creative", "Social", "Other"].map((value) => <Chip key={value}
        label={value} selected={category === value} disabled={disabled} onPress={() => setCategory(value)} />)}
    </View>
    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Times per week</Text>
    {targetPicker(target, setTarget, "New aspiration target")}
    <Button title="Add aspiration" secondary disabled={disabled || !title.trim() || values.length >= 20}
      onPress={() => {
        onChange([...values, { id: `aspiration-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, title: title.trim(), category, target_per_week: target }]);
        setTitle("");
      }} />
  </View>;
}
