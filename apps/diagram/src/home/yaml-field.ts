/**
 * DG-23 — one plain-YAML string field, shared by the components panel's `component.description`
 * and the template picker's top-level `description`. Read as plain YAML (`yaml`'s
 * `parseDocument`), not through the app's dialect-versioned compiler — a description renders
 * whether or not the rest of the file compiles. React-free (`conventions/logic-modules`).
 */
import { parseDocument } from "yaml";

/** The string at `path` (e.g. `["component", "description"]`), trimmed; "" if absent/invalid. */
export function topLevelDescription(text: string, path: readonly string[]): string {
  try {
    let node: unknown = parseDocument(text).toJS();
    for (const key of path) {
      if (typeof node !== "object" || node === null) return "";
      node = (node as Record<string, unknown>)[key];
    }
    return typeof node === "string" ? node.trim() : "";
  } catch {
    return "";
  }
}
