import React from "react";
import { Platform } from "react-native";
import { Dialog } from "@/src/shared/Dialogs";
import { Button, Sheet } from "@/src/shared/ui";

export function CreationPicker({
  title,
  visible,
  onClose,
  header,
  footer,
  initialFocusLabel,
  children,
}: {
  title: string;
  visible: boolean;
  onClose(): void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  initialFocusLabel?: string;
  children: React.ReactNode;
}) {
  return Platform.OS === "web" ? (
    <Dialog
      title={title}
      visible={visible}
      onClose={onClose}
      header={header}
      footer={footer ?? <Button title="Close" onPress={onClose} />}
      initialFocusLabel={initialFocusLabel}
    >
      {children}
    </Dialog>
  ) : (
    <Sheet
      title={title}
      visible={visible}
      onClose={onClose}
      header={header}
      footer={footer}
      snapHeight={560}
    >
      {children}
    </Sheet>
  );
}
