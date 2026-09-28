import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTheme } from "@elabs-ai/components-tokens";
import { toast } from "@elabs-ai/components-ui";
import type { ArchDiagram } from "../spec/dialect";
import { BUILTIN_PROFILES } from "./builtins";
import { resolveStyle, themeBindingFor } from "./resolve-style";
import {
  currentStyleConfig,
  onStyleConfigChange,
  styleConfigVersion,
  styleConfigIssues,
  watchStyleConfig,
} from "./config-service";
import type { ResolvedStyle } from "./types";
const fallback = resolveStyle({ theme: themeBindingFor("light"), profiles: BUILTIN_PROFILES });
const StyleContext = createContext<ResolvedStyle>(fallback);
export function useResolvedStyle(ast?: ArchDiagram | null) {
  const { theme } = useTheme();
  const workspace = useSyncExternalStore(onStyleConfigChange, currentStyleConfig);
  return useMemo(
    () =>
      resolveStyle({
        theme: themeBindingFor(theme),
        workspace,
        diagram: ast?.style,
        profiles: BUILTIN_PROFILES,
      }),
    [theme, workspace, ast?.style],
  );
}
export function DiagramStyleProvider({
  value,
  children,
}: {
  value: ResolvedStyle;
  children: ReactNode;
}) {
  return <StyleContext.Provider value={value}>{children}</StyleContext.Provider>;
}
export const useDiagramStyle = () => useContext(StyleContext);
const CONFIG_LABEL = "Workspace style configuration could not be applied";
/** Mounted only in the local shell; pure shared pictures and offline viewers own their state. */
export function StyleConfigBridge() {
  const revision = useSyncExternalStore(onStyleConfigChange, styleConfigVersion);
  useEffect(() => watchStyleConfig(), []);
  useEffect(() => {
    const issue = styleConfigIssues()[0];
    if (issue)
      toast.error(CONFIG_LABEL, { id: "workspace-style-config", description: issue.message });
    else toast.dismiss("workspace-style-config");
  }, [revision]);
  return null;
}
