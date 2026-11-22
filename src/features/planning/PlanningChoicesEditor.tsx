import React, { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { Ellipsis, Plus } from "lucide-react-native";
import { ActionRow, ContextMenu } from "@/src/shared/ContextMenu";
import { Button, IconButton, Txt, useTheme } from "@/src/shared/ui";
import type { ComposerOption } from "./composerSession";

export function PlanningChoicesEditor({
  options,
  disabled,
  onTitle,
  onDetails,
  onChange,
  onAdd,
}: {
  options: ComposerOption[];
  disabled: boolean;
  onTitle: (option: ComposerOption, value: string) => void;
  onDetails: (id: string) => void;
  onChange: (options: ComposerOption[]) => void;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  function move(index: number, offset: number) {
    const next = [...options];
    const [option] = next.splice(index, 1);
    next.splice(index + offset, 0, option);
    onChange(next);
  }
  return (
    <View style={{ gap: 6 }}>
      <Txt>Choices</Txt>
      {options.map((option, index) => (
        <ChoiceRow
          key={option.id}
          option={option}
          index={index}
          disabled={disabled}
          onTitle={(value) => onTitle(option, value)}
          onDetails={() => onDetails(option.id)}
          onRemove={() =>
            onChange(options.filter((row) => row.id !== option.id))
          }
          onMoveUp={index > 0 ? () => move(index, -1) : undefined}
          onMoveDown={
            index < options.length - 1 ? () => move(index, 1) : undefined
          }
        />
      ))}
      <Button
        compact
        secondary
        title="Add a choice"
        icon={<Plus size={17} color={colors.green} />}
        disabled={disabled}
        onPress={onAdd}
      />
    </View>
  );
}

function ChoiceRow({
  option,
  index,
  disabled,
  onTitle,
  onDetails,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  option: ComposerOption;
  index: number;
  disabled: boolean;
  onTitle: (value: string) => void;
  onDetails: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { colors, styles } = useTheme();
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const name = option.payload.title.trim() || `Choice ${index + 1}`;
  function select(action: () => void) {
    setOpen(false);
    action();
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <TextInput
        accessibilityLabel="Activity option"
        placeholder={
          index === 0 ? "Pizza" : index === 1 ? "Burgers" : "Another choice"
        }
        placeholderTextColor={colors.muted}
        value={option.payload.title}
        maxLength={120}
        editable={!disabled}
        onChangeText={onTitle}
        style={[styles.input, { flex: 1, minWidth: 0 }]}
      />
      <View ref={anchor} collapsable={false}>
        <IconButton
          label={`More for ${name}`}
          disabled={disabled}
          onPress={() => setOpen(true)}
        >
          <Ellipsis size={21} color={colors.muted} aria-hidden />
        </IconButton>
      </View>
      {open && (
        <ContextMenu
          title={name}
          visible={open}
          anchorRef={anchor}
          onClose={() => setOpen(false)}
        >
          <ActionRow label="Edit details" onPress={() => select(onDetails)} />
          {onMoveUp && (
            <ActionRow label="Move up" onPress={() => select(onMoveUp)} />
          )}
          {onMoveDown && (
            <ActionRow label="Move down" onPress={() => select(onMoveDown)} />
          )}
          <ActionRow
            label="Remove choice"
            danger
            onPress={() => select(onRemove)}
          />
        </ContextMenu>
      )}
    </View>
  );
}
