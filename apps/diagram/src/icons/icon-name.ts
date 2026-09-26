/**
 * The `vendor/name` icon-name scheme (plan D4) — every `icon:` value in the
 * YAML dialect and every `ServiceLogo`/`LucideByName` lookup in the app is
 * one of these. `lucide/<name>` is a reserved vendor for the generic glyph
 * set (`lucide-map.ts`); every other vendor is a key in
 * `public/icons/index.json` (`register-packs.ts`).
 */
export interface IconRef {
  vendor: string;
  name: string;
}

/**
 * Parses `"vendor/name"` into an {@link IconRef}. The first `/` is the
 * separator (a service name may itself contain `/`, e.g. a future
 * `"aws/rds/mysql"`). No slash, an empty vendor, or an empty name all
 * return `null` — the caller (the YAML validator, DG-09) turns that into an
 * "unknown icon name" issue rather than throwing.
 */
export function parseIconName(s: string): IconRef | null {
  const slashIndex = s.indexOf("/");
  if (slashIndex <= 0 || slashIndex === s.length - 1) return null;
  return { vendor: s.slice(0, slashIndex), name: s.slice(slashIndex + 1) };
}

/** The inverse of {@link parseIconName} — `{vendor:"aws",name:"lambda"}` → `"aws/lambda"`. */
export function iconKey(ref: IconRef): string {
  return `${ref.vendor}/${ref.name}`;
}
