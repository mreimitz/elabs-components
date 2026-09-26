/**
 * DG-18 — presentation mode lives in the URL: `#present`, or `#doc=…&present` beside a DG-16
 * share link, so a link opens straight into it and Back leaves it. The hash is read as
 * `&`-separated parts; `key=value` parts (DG-16 `doc`) are kept, a dev route (`#icons`) is not.
 */

export const PRESENT_PARAM = "present";

function parts(hash: string): string[] {
  const body = hash.replace(/^#/, "");
  return body ? body.split("&") : [];
}

const isPresentPart = (part: string) =>
  part === PRESENT_PARAM || part.startsWith(`${PRESENT_PARAM}=`);

export function isPresenting(hash: string): boolean {
  return parts(hash).some(isPresentPart);
}

/** The hash that presents the current document. */
export function presentingHash(hash: string): string {
  const kept = parts(hash).filter((part) => part.includes("=") && !isPresentPart(part));
  return [...kept, PRESENT_PARAM].join("&");
}

/** The hash back in the editor. */
export function editingHash(hash: string): string {
  return parts(hash)
    .filter((part) => !isPresentPart(part))
    .join("&");
}

let returnToPresent = false;

export function enterPresentation(): void {
  window.location.hash = presentingHash(window.location.hash);
}

export function exitPresentation(): void {
  window.location.hash = editingHash(window.location.hash);
}

/** Presentation mode is showing: however it ends, focus returns to the Present button. */
export function markPresented(): void {
  returnToPresent = true;
}

/** `true` once after presentation mode ended. */
export function takePresentReturn(): boolean {
  const pending = returnToPresent;
  returnToPresent = false;
  return pending;
}
