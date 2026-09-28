import { BUILTIN_PROFILES } from "../style/builtins";
import { resolveStyle, selectionIssues, themeBindingFor } from "../style/resolve-style";
import { parseStyleConfig } from "../style/workspace-config";
import type { ResolvedStyle, StyleSelection, WorkspaceStyleConfig } from "../style/types";
export interface PublishedStyle {
  workspace: WorkspaceStyleConfig;
  resolved: ResolvedStyle;
}
/** Capture public profile preferences and complete resolved atoms, never config source text. */
export function publishedStyle(
  theme: string,
  workspace: WorkspaceStyleConfig = {},
  diagram?: StyleSelection,
): PublishedStyle {
  const parsed = parseStyleConfig(JSON.stringify(workspace));
  if (!parsed.config || parsed.issues.length)
    throw new Error("Workspace styles cannot be published until their configuration is valid.");
  const resolved = resolveStyle({
    theme: themeBindingFor(theme),
    workspace: parsed.config,
    diagram,
    profiles: BUILTIN_PROFILES,
  });
  if (resolved.issues.length) throw new Error("The diagram has an unresolved style profile.");
  return structuredClone({ workspace: parsed.config, resolved });
}
/** Only the shipped profile contract is supported; arbitrary CSS atoms cannot enter a file. */
export function validatePublishedStyle(
  value: unknown,
  theme: string,
  diagram: unknown,
): asserts value is PublishedStyle {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !["workspace", "resolved"].includes(key))
  )
    throw new Error("Invalid published style snapshot.");
  const record = value as Record<string, unknown>;
  if (
    !record.workspace ||
    typeof record.workspace !== "object" ||
    Array.isArray(record.workspace) ||
    (diagram !== undefined && selectionIssues(diagram).length)
  )
    throw new Error("Invalid published style preferences.");
  const expected = publishedStyle(
    theme,
    record.workspace as WorkspaceStyleConfig,
    diagram as StyleSelection | undefined,
  );
  if (JSON.stringify(expected) !== JSON.stringify(value))
    throw new Error("The published profile does not match its fixed theme and preferences.");
}
