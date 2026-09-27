// Vite JSON import (`resolveJsonModule`), the same file `register-packs.ts` reads.
import index from "../../public/icons/index.json";
import { LUCIDE_NAMES } from "./lucide-names";

/**
 * Every icon name the YAML may use: DG-04's vendored index plus the reserved `lucide/*`
 * names — the set `checkArchYaml` checks `icon:` against (built the way DG-09's
 * `#spec-check` view builds it, orchestrator addition 16).
 *
 * DG-35: React-free (the index JSON and a name list, not `register-packs.ts` or
 * `lucide-map.ts`), so the dev server can load it through `server/spec-bridge.mjs`.
 */
export const ICON_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(index),
  ...LUCIDE_NAMES.map((name) => `lucide/${name}`),
]);
