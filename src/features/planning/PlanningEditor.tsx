import React from "react";
import { View } from "react-native";
import { Button, Sheet, Txt, useTheme } from "@/src/shared/ui";
export function PlanningEditor({
  inline,
  title,
  visible,
  onClose,
  children,
}: React.ComponentProps<typeof Sheet> & { inline: boolean }) {
  const { styles } = useTheme();
  if (!inline)
    return (
      <Sheet title={title} visible={visible} onClose={onClose}>
        {children}
      </Sheet>
    );
  if (!visible) return null;
  return (
    <View style={[styles.card, { gap: 12 }]}>
      <Button title="Back to decision" compact secondary onPress={onClose} />
      <Txt>{title}</Txt>
      {children}
    </View>
  );
}
