import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";

/**
 * Eager, data-only. Split from the adapter module so `createDefaultRegistry`
 * can answer "can this be opened, and what controls apply" without pulling
 * pdf.js — a ~1 MB engine — into the entry chunk.
 *
 * `requires` is what the "install this" message names when `pdfjs-dist` is not
 * present: the adapter is registered either way, so the reader is told what is
 * missing instead of being told the file type is unsupported.
 *
 * The only adapter that declares `rect`: a PDF page has a fixed coordinate
 * space, so a producer that knows where a passage sits on the page — an OCR
 * pipeline, a layout-aware chunker — can address it geometrically and skip the
 * text projection entirely.
 */
export const pdfManifest: AdapterManifest = {
  id: "pdf",
  protocol: PROTOCOL_VERSION,
  extensions: ["pdf"],
  mediaTypes: ["application/pdf"],
  capabilities: {
    pages: true,
    zoom: true,
    text: true,
    highlight: ["quote", "range", "rect"],
  },
  requires: ["pdfjs-dist"],
};
