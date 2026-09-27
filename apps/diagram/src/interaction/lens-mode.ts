/**
 * The lens lives in the URL exactly as presentation mode does (`presentation-mode.ts`):
 * `&lens=visual` — absent means technical, the default, so a technical link stays a plain
 * link (maintainer 2026-09-27, "the switch from technical to visual"). Read independently of
 * `routes/use-hash.ts`'s `Route`: `Route`'s own `toHash` rebuilds the hash from its known
 * fields only, so a `navigate()` call elsewhere already drops `present`/`step` when it does
 * not carry them forward — `lens` behaves the same way on purpose (a tab switch is not a
 * promise to keep any view-only overlay open), and `lensActions.setLens` (`shell/lens-store.ts`)
 * always writes through these two functions, never through `toHash`, so a lens change itself
 * never disturbs the rest of the hash.
 */

export const LENS_PARAM = "lens";
const VISUAL_VALUE = "visual";

function parts(hash: string): string[] {
  const body = hash.replace(/^#/, "");
  return body ? body.split("&") : [];
}

const isLensPart = (part: string) => part === LENS_PARAM || part.startsWith(`${LENS_PARAM}=`);

export function isVisualLensHash(hash: string): boolean {
  return parts(hash).some((part) => part === `${LENS_PARAM}=${VISUAL_VALUE}`);
}

/** The hash with `&lens=visual` set (or removed, for technical — the default needs no param). */
export function hashWithLens(hash: string, visual: boolean): string {
  const kept = parts(hash).filter((part) => !isLensPart(part));
  const withLens = visual ? [...kept, `${LENS_PARAM}=${VISUAL_VALUE}`] : kept;
  return `#${withLens.join("&")}`;
}
