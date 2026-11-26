import React, { useState } from "react";
import { View } from "react-native";
import { X } from "lucide-react-native";
import { Button, IconButton, Txt, useTheme } from "@/src/shared/ui";
import { openGuestEntry } from "./guestEntry";

export function LoginToUse({
  destination,
  params,
  detail,
  dismissible = true,
  resumeCurrentPage = false,
}: {
  destination: string;
  params?: Record<string, string>;
  detail: string;
  dismissible?: boolean;
  resumeCurrentPage?: boolean;
}) {
  const { styles, colors } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const login = () => openGuestEntry(destination, undefined, undefined, params, resumeCurrentPage);
  if (dismissed) {
    return <Button title="Login to use" onPress={login} secondary compact />;
  }
  return (
    <View testID="login-to-use-card" style={[styles.card, { gap: 6 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Txt muted>{detail}</Txt>
        </View>
        {dismissible && (
          <IconButton
            label="Dismiss login card"
            onPress={() => setDismissed(true)}
          >
            <X size={16} color={colors.muted} />
          </IconButton>
        )}
      </View>
      <Button title="Login to use" onPress={login} secondary compact />
    </View>
  );
}
