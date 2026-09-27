/**
 * DG-16 — a share link carries the YAML itself (plan §10: no backend): the text is
 * compressed with the platform's `CompressionStream("deflate-raw")` and base64url-encoded
 * into the hash, `#doc=<…>`. The hash is written only by "Copy share link", never on every
 * edit. The hash is read as `key=value` pairs (`URLSearchParams`), so a later parameter
 * (DG-18 `present`) can sit next to `doc`.
 */
import { diagramActions } from "../state/diagram-store";

/** The hash parameter that holds the document. */
export const DOC_PARAM = "doc";

/** Refuse to inflate more than this: a crafted link must not blow up the tab. */
export const MAX_DOC_BYTES = 1_000_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** The text, compressed and base64url-encoded. */
export async function encodeDoc(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** The inverse of `encodeDoc`; throws on a malformed value or past `MAX_DOC_BYTES`. */
export async function decodeDoc(value: string): Promise<string> {
  const stream = new Blob([fromBase64Url(value)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    size += chunk.byteLength;
    if (size > MAX_DOC_BYTES) {
      await reader.cancel();
      throw new Error(`The shared document is larger than ${MAX_DOC_BYTES} bytes.`);
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** The `doc` value in a hash (`#doc=…&…`), or `null`. */
export function docParam(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get(DOC_PARAM);
}

/**
 * Drop `doc=<value>` from the address bar, keeping every other part (DG-18 `present`): a link
 * the person turned down must not stay there to be read again, and once another document is
 * loaded (an example, a file) a reload must not bring the link back. `replaceState` fires no
 * `hashchange` and adds no Back step. With `value`, nothing happens when the hash carries
 * another link; without it, any link is dropped.
 */
export function forgetDocParam(value?: string): void {
  const { hash, pathname, search } = window.location;
  const current = docParam(hash);
  if (current === null || (value !== undefined && current !== value)) return;
  const kept = hash
    .replace(/^#/, "")
    .split("&")
    .filter((part) => part !== "" && !part.startsWith(`${DOC_PARAM}=`));
  window.history.replaceState(
    window.history.state,
    "",
    kept.length > 0 ? `#${kept.join("&")}` : `${pathname}${search}`,
  );
}

/** This page's URL with the hash `#doc=<text>` (a dev route such as `#icons` is dropped). */
export async function shareUrl(text: string): Promise<string> {
  const params = new URLSearchParams({ [DOC_PARAM]: await encodeDoc(text) });
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#${params.toString()}`;
}

let bootFailed = false;

/**
 * Startup: a `#doc=` link replaces the example seed before the first render (main.tsx).
 * A link that cannot be read leaves the seed; `takeBootFailure` tells the UI once.
 */
export async function loadSharedDoc(): Promise<void> {
  const value = docParam(window.location.hash);
  if (value === null) return;
  try {
    diagramActions.loadText(await decodeDoc(value));
  } catch {
    bootFailed = true;
  }
}

/** `true` once when the startup link could not be read. */
export function takeBootFailure(): boolean {
  const failed = bootFailed;
  bootFailed = false;
  return failed;
}
