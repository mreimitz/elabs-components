import { parseDocument } from "yaml";
import { selectionIssues } from "./resolve-style";
import type { StyleIssue, WorkspaceStyleConfig } from "./types";
export const STYLE_CONFIG_PATH = "atlas.config.yaml";
export function parseStyleConfig(text: string): {
  config?: WorkspaceStyleConfig;
  issues: StyleIssue[];
} {
  const fail = (message: string, path: (string | number)[] = []): { issues: StyleIssue[] } => ({
    issues: [{ code: "style-config", source: STYLE_CONFIG_PATH, path, message }],
  });
  if (text.length > 16_000) return fail("Workspace style configuration exceeds 16,000 characters.");
  try {
    const doc = parseDocument(text, { uniqueKeys: true });
    if (doc.errors.length) return fail(doc.errors[0]!.message);
    const data: unknown = doc.toJS({ maxAliasCount: 20 });
    if (data === null) return { config: {}, issues: [] };
    if (typeof data !== "object" || Array.isArray(data))
      return fail("Workspace configuration must be an object.");
    for (const key of Object.keys(data))
      if (key !== "styles")
        return fail("Only styles is supported in workspace configuration.", [key]);
    const value = data as Record<string, unknown>;
    const issues =
      "styles" in value
        ? selectionIssues(value.styles, ["styles"]).map((issue) => ({
            ...issue,
            source: STYLE_CONFIG_PATH,
          }))
        : [];
    return issues.length
      ? { issues }
      : { config: structuredClone(data) as WorkspaceStyleConfig, issues };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid workspace style configuration.");
  }
}
/** Request admission and last-good state are transport-independent for offline and test use. */
export function createStyleConfigStore(read: () => Promise<string | null>) {
  let config: WorkspaceStyleConfig = {};
  let issues: readonly StyleIssue[] = [];
  let version = 0;
  let generation = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    version++;
    listeners.forEach((listener) => listener());
  };
  return {
    current: () => config,
    issues: () => issues,
    version: () => version,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cancel: () => {
      generation++;
    },
    async refresh() {
      const request = ++generation;
      try {
        const text = await read();
        if (request !== generation) return;
        const result = text === null ? { config: {}, issues: [] } : parseStyleConfig(text);
        if (result.config) config = result.config;
        issues = result.issues;
        emit();
      } catch (error) {
        if (request !== generation) return;
        issues = [
          {
            code: "style-config-read",
            source: STYLE_CONFIG_PATH,
            path: [],
            message:
              error instanceof Error
                ? error.message
                : "Could not read workspace style configuration.",
          },
        ];
        emit();
      }
    },
  };
}
