import React from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";

export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ gap: 8 }}><Text accessibilityRole="header" style={{ color: colors.muted, fontSize: 13, fontWeight: "700", paddingHorizontal: 12, textTransform: "uppercase" }}>{title}</Text><View style={{ backgroundColor: colors.white, borderRadius: 20, borderColor: colors.line, borderWidth: 1, overflow: "hidden" }}>{children}</View></View>;
}

export function SettingsRow({ title, detail, icon: Icon, onPress, trailing, danger = false, disabled = false, last = false }: { title: string; detail?: string; icon: LucideIcon; onPress?: () => void; trailing?: React.ReactNode; danger?: boolean; disabled?: boolean; last?: boolean }) {
  const { colors } = useTheme();
  const content = <><View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: danger ? `${colors.red}18` : colors.lime, alignItems: "center", justifyContent: "center" }}><Icon size={19} color={danger ? colors.red : colors.green} /></View><View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text style={{ color: danger ? colors.red : colors.ink, fontSize: 16, fontWeight: "500" }}>{title}</Text>{detail ? <Text style={{ color: colors.muted, fontSize: 13 }}>{detail}</Text> : null}</View>{trailing ?? (onPress ? <ChevronRight size={18} color={danger ? colors.red : colors.muted} /> : null)}</>;
  const style = { minHeight: 56, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, borderBottomColor: colors.line, borderBottomWidth: last ? 0 : 0.5 };
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [style, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>{content}</Pressable> : <View style={style}>{content}</View>;
}
