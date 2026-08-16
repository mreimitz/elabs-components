import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";

/**
 * Eager, data-only. Split from the adapter module so `createDefaultRegistry`
 * can answer "can this be opened, and what controls apply" without pulling the
 * renderer into the entry chunk.
 */
export const imageManifest: AdapterManifest = {
  id: "image",
  protocol: PROTOCOL_VERSION,
  categories: ["image"],
  mediaTypes: ["image/"],
  capabilities: { zoom: true, rotate: true },
};
