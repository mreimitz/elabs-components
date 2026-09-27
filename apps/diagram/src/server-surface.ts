/**
 * DG-35 — the React-free surface the dev server loads with Vite's `ssrLoadModule`
 * (`server/spec-bridge.mjs`). Everything here must stay free of React, the DOM and
 * `lucide-react`: the MCP tools run it in Node. Add an export here, never a React module.
 */
import { checkText } from "./spec/check-text";
import { catalogLookupOf, type CatalogRefEntry } from "./spec/dialect/catalog-refs"; // DG-26
import { ICON_NAMES } from "./icons/icon-names";

export { checkText, type CheckedText, type DiagramIssue } from "./spec/check-text";
export { buildArchSchema } from "./spec/dialect/schema";
export { parseArchYaml } from "./spec/dialect";
export {
  appendEntries,
  applyEdits,
  moveEntry,
  removeEntries,
  renameEntryKey, // DG-26
  setEntriesKeys,
  setEntryKeys,
  setFlowKeys,
} from "./spec/dialect/write-back";
export { flowItem, nodeItem } from "./spec/dialect/entry-text";
export { entrySnippet } from "./catalog/entry-snippet"; // DG-24
export { upgradeText } from "./spec/dialect/upgrade"; // DG-26
export {
  refFirstText,
  type RefChoices,
  type RefFirstChange,
  type RefFirstResult,
} from "./spec/dialect/upgrade"; // DG-26 (1b)
export { catalogRefsOf, diagramRefsOf, refFileOf, refForm } from "./spec/dialect/ids"; // DG-26
export { catalogLookupOf, suppliedBy, type CatalogRefEntry } from "./spec/dialect/catalog-refs"; // DG-26 (1b)
export { ICON_NAMES };

/**
 * `checkText` against the app's own icon names — what the browser's compile checks. `catalog`
 * (readAll's entries, DG-26 1b) resolves `ref: catalog/…`; without it, references stay as
 * written.
 */
export function checkDiagram(text: string, catalog?: readonly CatalogRefEntry[]) {
  return checkText(text, ICON_NAMES, catalog ? { catalog: catalogLookupOf(catalog) } : {});
}
