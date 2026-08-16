import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";

/**
 * Eager, data-only (see `image-manifest.ts`).
 *
 * `requires` names the OPTIONAL peer this adapter dynamically imports. It is
 * what the "install this to open that" message names when the import cannot
 * resolve — the registry never installs anything itself.
 */
export const csvManifest: AdapterManifest = {
  id: "csv",
  protocol: PROTOCOL_VERSION,
  extensions: ["csv", "tsv"],
  mediaTypes: ["text/csv", "text/tab-separated-values"],
  // Addressed against the PARSED grid (`gridToText`), not the raw bytes — see
  // the adapter. No `rect`: a table cell has no page geometry to point at.
  capabilities: { text: true, search: true, highlight: ["quote", "range"] },
  requires: ["papaparse"],
};
