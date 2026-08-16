import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";

/**
 * Eager, data-only (see `image-manifest.ts`).
 *
 * Claims only broad CATEGORIES, so any adapter naming an extension or an exact
 * MIME outranks it automatically — this is the "readable as text" backstop.
 */
export const textManifest: AdapterManifest = {
  id: "text",
  protocol: PROTOCOL_VERSION,
  categories: ["text", "code", "data", "unknown"],
  mediaTypes: ["text/"],
  // `rect` is absent on purpose: a plain-text file has no geometry to point at,
  // and a manifest that claimed it would let an app offer an affordance the
  // renderer can never honour.
  capabilities: { text: true, search: true, highlight: ["quote", "range"] },
};
