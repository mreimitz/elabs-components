import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";

/** Eager, data-only (see `image-manifest.ts`). */
export const jsonManifest: AdapterManifest = {
  id: "json",
  protocol: PROTOCOL_VERSION,
  extensions: ["json"],
  mediaTypes: ["application/json"],
  capabilities: { text: true, search: true },
};
