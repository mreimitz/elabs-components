import { LUCIDE_ICONS } from "./lucide-map";
import { ICON_INDEX } from "./register-packs";

/**
 * Every icon name the YAML may use: DG-04's vendored index plus the reserved `lucide/*`
 * names — the set `checkArchYaml` checks `icon:` against (built the way DG-09's
 * `#spec-check` view builds it, orchestrator addition 16).
 */
export const ICON_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(ICON_INDEX),
  ...Object.keys(LUCIDE_ICONS).map((name) => `lucide/${name}`),
]);
