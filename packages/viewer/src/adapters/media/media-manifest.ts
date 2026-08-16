import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";

/**
 * Eager, data-only.
 *
 * No `requires`: the browser is the decoder, so this adapter has no optional
 * peer and can never report `parser-missing`. A codec the browser cannot play is
 * a different failure — the `<video>` element's own `error` event — and it is
 * reported where it happens, in the renderer.
 */
export const mediaManifest: AdapterManifest = {
  id: "media",
  protocol: PROTOCOL_VERSION,
  categories: ["video", "audio"],
  mediaTypes: ["video/", "audio/"],
};
