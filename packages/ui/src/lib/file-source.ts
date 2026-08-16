/**
 * One input model for "a file", whatever the app happens to be holding.
 *
 * The library previously had three: a `File` (upload), a `string` of content
 * (chat assets), and a bare URL (attachments) — so every surface that wanted to
 * render a file first had to guess which of the three it had. {@link FileSource}
 * is the union all of them collapse into, and {@link normalizeFileSource} turns
 * any member into one uniform reader.
 *
 * Two things this fixes beyond the merge:
 *
 * - **Authenticated remote files work.** The `url` variant carries
 *   `init?: RequestInit`, so headers, credentials and an abort signal reach the
 *   fetch. A viewer that can only take a naked URL cannot open anything behind
 *   auth, which is most enterprise content.
 * - **Alt text has a home.** Every binary variant takes `alt`, so an image or a
 *   rendered page can be described without a parallel prop channel.
 *
 * Pure DOM/platform mechanics: no React, no other deps. SSR-safe to import;
 * only {@link ResolvedFileSource.url} needs a browser, and it says so.
 */

import { type FileCategory, mediaTypeFromName, resolveFileKind } from "./file-kind";

/** Any file the library can be handed. Discriminated on `kind`. */
export type FileSource =
  /** A user-picked file. Name and MIME come from the platform. */
  | { kind: "file"; file: File; alt?: string }
  /** In-memory bytes that already have a `Blob` wrapper (a generated export, a decoded attachment). */
  | { kind: "blob"; blob: Blob; name: string; mediaType?: string; alt?: string }
  /**
   * A remote file. `init` is passed straight to `fetch` — this is how auth
   * headers, `credentials` and an `AbortSignal` reach the request.
   */
  | {
      kind: "url";
      url: string;
      name?: string;
      mediaType?: string;
      alt?: string;
      init?: RequestInit;
    }
  /** Raw bytes with no wrapper (a worker result, a WASM output). */
  | { kind: "buffer"; buffer: ArrayBuffer; name: string; mediaType: string; alt?: string }
  /** Content the app already has as a string (an agent's markdown, a code snippet). */
  | { kind: "text"; text: string; name: string; mediaType?: string };

/**
 * A {@link FileSource} with its identity resolved and its bytes reachable the
 * same way regardless of where they came from.
 *
 * Reads are memoized on success, so `text()` after `bytes()` costs nothing and a
 * remote file is fetched once. A failed read is NOT cached — a retry re-runs it.
 */
export interface ResolvedFileSource {
  /** Display name, always non-empty. Derived from the URL path when the caller gave none. */
  readonly name: string;
  /** Best-known MIME, resolved from the declared type then the extension. */
  readonly mediaType: string;
  /** Coarse shape, for icons/labels/fallbacks. Not a renderer routing key. */
  readonly category: FileCategory;
  /** Lowercased extension without the dot, or `""`. */
  readonly extension: string;
  /** Author-supplied description, for images and rendered pages. */
  readonly alt?: string;
  /** Byte length when known up front. `undefined` for `text` and un-fetched `url` sources. */
  readonly size?: number;

  /** The full contents as bytes. */
  bytes(signal?: AbortSignal): Promise<ArrayBuffer>;
  /** The full contents decoded as UTF-8. */
  text(signal?: AbortSignal): Promise<string>;
  /**
   * A URL usable as an `<img>`/`<video>`/`<iframe>` src.
   *
   * A public `url` source returns its own URL unchanged, so the browser streams
   * it and no full read happens. Every other source (and any `url` source with
   * an `init`, which the element could not replay) mints an object URL — release
   * it with {@link revoke}. Browser only: rejects where `URL.createObjectURL`
   * does not exist.
   */
  url(signal?: AbortSignal): Promise<string>;
  /** Release any object URL this reader minted. Idempotent; safe to call unconditionally. */
  revoke(): void;
}

/** Best-effort filename from a URL path. Never empty. */
function nameFromUrl(url: string): string {
  try {
    // A relative URL still needs a base to parse; the base is never used.
    const parsed = new URL(url, "http://localhost");
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "file";
  } catch {
    // Unparseable: strip the query/hash by hand rather than give up. Note this
    // runs ONLY on a parse failure — running it as a fallback for an empty
    // pathname would return the host ("x.test" for "https://x.test/").
    const stripped = url.split(/[?#]/)[0] ?? "";
    const last = stripped.split("/").filter(Boolean).pop();
    return last && last.length > 0 ? last : "file";
  }
}

/**
 * `Blob`/`File` → bytes, feature-detecting `Blob.prototype.arrayBuffer`.
 *
 * jsdom does not implement it (nor `Blob.prototype.text`), and this module is
 * reached from every downstream package's jsdom tests — so per the note in
 * `packages/ui/vitest.setup.ts`, the detection lives HERE rather than in a stub
 * that would only fix this package's own suite. `FileReader` is the fallback:
 * jsdom implements it, and it is the pre-2020 browser path anyway.
 */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();

  if (typeof FileReader !== "function") {
    return Promise.reject(
      new Error("Cannot read file bytes: no Blob.arrayBuffer and no FileReader."),
    );
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsArrayBuffer(blob);
  });
}

/** The declared name/MIME for a source, before extension inference. */
function identify(source: FileSource): { name: string; declaredMediaType?: string } {
  switch (source.kind) {
    case "file":
      return { name: source.file.name || "file", declaredMediaType: source.file.type };
    case "blob":
      return { name: source.name, declaredMediaType: source.mediaType ?? source.blob.type };
    case "buffer":
      return { name: source.name, declaredMediaType: source.mediaType };
    case "text":
      return {
        name: source.name,
        declaredMediaType: source.mediaType ?? mediaTypeFromName(source.name) ?? "text/plain",
      };
    case "url":
      return { name: source.name ?? nameFromUrl(source.url), declaredMediaType: source.mediaType };
  }
}

/** Byte length where the platform already knows it, without reading anything. */
function knownSize(source: FileSource): number | undefined {
  switch (source.kind) {
    case "file":
      return source.file.size;
    case "blob":
      return source.blob.size;
    case "buffer":
      return source.buffer.byteLength;
    // `text` would need an encode pass, `url` a fetch — neither is free, so we
    // report "unknown" rather than doing work a caller may not want.
    default:
      return undefined;
  }
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Aborted");
}

/**
 * Turn any {@link FileSource} into a uniform reader.
 *
 * Cheap and synchronous — it resolves identity only. Nothing is read, fetched or
 * decoded until a `bytes()` / `text()` / `url()` call.
 */
export function normalizeFileSource(source: FileSource): ResolvedFileSource {
  const { name, declaredMediaType } = identify(source);
  const kind = resolveFileKind(name, declaredMediaType);
  const alt = "alt" in source ? source.alt : undefined;

  let bytesPromise: Promise<ArrayBuffer> | undefined;
  let textPromise: Promise<string> | undefined;
  let objectUrl: string | undefined;

  async function readBytes(signal?: AbortSignal): Promise<ArrayBuffer> {
    assertNotAborted(signal);
    switch (source.kind) {
      case "file":
        return blobToArrayBuffer(source.file);
      case "blob":
        return blobToArrayBuffer(source.blob);
      case "buffer":
        return source.buffer;
      case "text":
        return new TextEncoder().encode(source.text).buffer as ArrayBuffer;
      case "url": {
        // The caller's own signal (via `init`) still applies; this one is layered
        // on top so a per-read abort works even when `init` carries none.
        const res = await fetch(source.url, {
          ...source.init,
          signal: signal ?? source.init?.signal,
        });
        if (!res.ok) {
          throw new Error(`Could not read "${name}": the server responded ${res.status}.`);
        }
        return res.arrayBuffer();
      }
    }
  }

  async function blobOf(signal?: AbortSignal): Promise<Blob> {
    if (source.kind === "file") return source.file;
    if (source.kind === "blob") return source.blob;
    const buffer = await bytes(signal);
    return new Blob([buffer], { type: kind.mediaType });
  }

  function bytes(signal?: AbortSignal): Promise<ArrayBuffer> {
    // Memoize the success only: a rejected read must be retryable.
    bytesPromise ??= readBytes(signal).catch((error: unknown) => {
      bytesPromise = undefined;
      throw error;
    });
    return bytesPromise;
  }

  function text(signal?: AbortSignal): Promise<string> {
    if (source.kind === "text") return Promise.resolve(source.text);
    textPromise ??= bytes(signal)
      .then((buffer) => new TextDecoder().decode(buffer))
      .catch((error: unknown) => {
        textPromise = undefined;
        throw error;
      });
    return textPromise;
  }

  async function url(signal?: AbortSignal): Promise<string> {
    // A public remote file is already a URL an element can stream. One carrying
    // `init` is not: the element cannot replay those headers, so we fetch here.
    if (source.kind === "url" && !source.init) return source.url;

    if (objectUrl) return objectUrl;
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      throw new Error(
        `Could not create a URL for "${name}": no object-URL support in this environment.`,
      );
    }
    objectUrl = URL.createObjectURL(await blobOf(signal));
    return objectUrl;
  }

  function revoke(): void {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }

  return {
    name,
    mediaType: kind.mediaType,
    category: kind.category,
    extension: kind.extension,
    alt,
    size: knownSize(source),
    bytes,
    text,
    url,
    revoke,
  };
}
