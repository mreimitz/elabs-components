/**
 * DG-35 — the React-free surface the dev server loads with Vite's `ssrLoadModule`
 * (`server/spec-bridge.mjs`). Everything here must stay free of React, the DOM and
 * `lucide-react`: the MCP tools run it in Node. Add an export here, never a React module.
 */
import { checkText } from "./spec/check-text";
import { ICON_NAMES } from "./icons/icon-names";

export { checkText, type CheckedText, type DiagramIssue } from "./spec/check-text";
export { buildArchSchema } from "./spec/dialect/schema";
export { parseArchYaml } from "./spec/dialect";
export {
  appendEntries,
  applyEdits,
  moveEntry,
  removeEntries,
  setEntriesKeys,
  setEntryKeys,
  setFlowKeys,
} from "./spec/dialect/write-back";
export { flowItem, nodeItem } from "./spec/dialect/entry-text";
export { ICON_NAMES };

/** `checkText` against the app's own icon names — what the browser's compile checks. */
export function checkDiagram(text: string) {
  return checkText(text, ICON_NAMES);
}
