import React, { useRef, useState } from "react";
import { Pressable, Text, type View } from "react-native";
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConfirmDialog, QuickChoiceDialog } from "../../../src/shared/Dialogs";
import { SheetIsolation } from "../../../src/shared/overlays";
import { ActionRow, ContextMenu } from "../../../src/shared/ContextMenu";

declare global {
  interface Window {
    releaseConfirmation?: () => void;
  }
}

function Harness() {
  const [chooser, setChooser] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [saved, setSaved] = useState(0);
  const [fail, setFail] = useState(true);
  const [anchored, setAnchored] = useState(false);
  const anchor = useRef<View>(null);
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <SheetIsolation>
        <button onClick={() => setChooser(true)}>Choose action</button>
        <button onClick={() => setConfirmation(true)}>Delete content</button>
        <Pressable
          ref={anchor}
          accessibilityRole="button"
          onPress={() => setAnchored(true)}
        >
          <Text>Anchored actions</Text>
        </Pressable>
        <label>
          <input
            type="checkbox"
            checked={fail}
            onChange={(event) => setFail(event.target.checked)}
          />
          Fail next action
        </label>
        <output>
          Attempts: {attempts}; saved: {saved}
        </output>
      </SheetIsolation>
      <ContextMenu
        title="Anchored choices"
        visible={anchored}
        anchorRef={anchor}
        mode="dropdown"
        onClose={() => setAnchored(false)}
      >
        <ActionRow
          label="Review deletion"
          onPress={() => setConfirmation(true)}
        />
      </ContextMenu>
      <QuickChoiceDialog
        title="Small choices"
        visible={chooser}
        onClose={() => setChooser(false)}
        items={[
          { label: "Delete content", onPress: () => setConfirmation(true) },
          {
            label: "Unavailable",
            disabled: true,
            onPress: () => {
              throw new Error("Disabled action executed");
            },
          },
        ]}
      />
      <ConfirmDialog
        title="Delete this content?"
        visible={confirmation}
        onClose={() => setConfirmation(false)}
        destructive
        confirmLabel="Delete content"
        message={"This action permanently deletes your personal content. ".repeat(
          30,
        )}
        onConfirm={async () => {
          setAttempts((value) => value + 1);
          await new Promise<void>((resolve) => {
            window.releaseConfirmation = resolve;
          });
          if (fail)
            throw new Error("The server rejected this action. Try again.");
          setSaved((value) => value + 1);
        }}
      />
    </SafeAreaProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
