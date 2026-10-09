import { useMemo } from "react";
import { usePreferences } from "@/src/shared/preferences";
import { getDesignTheme, type DesignTheme } from "@/src/theme/tokens";

export * from "@/src/theme/tokens";

export function useDesignTheme(): DesignTheme {
  const { theme, resolvedAppearance } = usePreferences();
  return useMemo(
    () => getDesignTheme(theme, resolvedAppearance),
    [theme, resolvedAppearance],
  );
}
