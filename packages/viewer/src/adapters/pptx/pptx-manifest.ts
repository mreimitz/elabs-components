import { type AdapterManifest, PROTOCOL_VERSION } from "../../core/types";

/**
 * PowerPoint decks. `.ppt` (the pre-2007 binary format) is not a zip at all, so
 * it is deliberately absent rather than claimed and then failed on.
 *
 * `requires: ["jszip"]` — the deck is unzipped here and the XML is parsed with
 * the platform's own `DOMParser`, so there is no PowerPoint library to install.
 */
export const pptxManifest: AdapterManifest = {
  id: "pptx",
  protocol: PROTOCOL_VERSION,
  extensions: ["pptx"],
  mediaTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  // No `rect`: the deck is read as an OUTLINE, not reproduced as a canvas, so
  // there is no slide geometry a box could point into (`pptx-model.ts`).
  capabilities: { pages: true, text: true, highlight: ["quote", "range"] },
  requires: ["jszip"],
};
