/**
 * Browser file-download helpers — the single home for the
 * `Blob`/URL → hidden `<a download>` → click → revoke dance that was previously
 * copy-pasted across `@elabs-ai/components-ai` (ConversationDownload), `@elabs-ai/components-data`
 * (downloadCsv) and now `@elabs-ai/components-ai` Gallery.
 *
 * Pure DOM mechanics, no React, no other deps — and SSR-guarded
 * (`typeof document === "undefined"` → no-op) so it's safe to import from
 * dependency-light modules. The CONTENT (CSV serialization, markdown export,
 * image source) stays with each caller; this only triggers the save.
 */

/** Internal: click a hidden anchor for `url`, optionally suggesting `filename`. */
function clickAnchor(url: string, filename?: string): void {
  const a = document.createElement("a");
  a.href = url;
  // `download` is only honored for same-origin / blob: / data: URLs; harmless otherwise.
  if (filename) a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Best-effort filename from a URL path; falls back to "download". */
function filenameFromUrl(url: string): string {
  try {
    const base = "http://localhost";
    const ref = typeof window === "undefined" ? base : window.location.href;
    const { pathname } = new URL(url, ref);
    const last = pathname.split("/").filter(Boolean).pop();
    return last && last.length > 0 ? decodeURIComponent(last) : "download";
  } catch {
    return "download";
  }
}

/** True for sources `<a download>` can save directly (same-origin, blob:, data:). */
function isDirectlyDownloadable(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  if (typeof window === "undefined") return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    // Relative or unparseable → treat as same-origin (the anchor resolves it).
    return true;
  }
}

/**
 * Trigger a download for an in-memory `Blob`. No-op in non-DOM environments.
 * Revokes the object URL immediately after the click (the browser captures the
 * download synchronously, mirroring the prior call sites).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  try {
    clickAnchor(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Trigger a download for an existing `url` (an http(s)/relative URL, or a
 * `data:`/`blob:` URI). No-op in non-DOM environments.
 *
 * Same-origin / `blob:` / `data:` → a direct `<a download>` (honors `filename`).
 * Cross-origin → the browser ignores the `download` filename, so we `fetch` the
 * bytes and save via {@link downloadBlob}. This requires the server to allow CORS;
 * on failure (CORS/opaque/offline) we fall back to opening the source in a new
 * tab so the user still gets the asset. Fire-and-forget: `void downloadUrl(...)`.
 */
export async function downloadUrl(url: string, filename?: string): Promise<void> {
  if (typeof document === "undefined") return;

  if (isDirectlyDownloadable(url)) {
    clickAnchor(url, filename);
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    downloadBlob(blob, filename ?? filenameFromUrl(url));
  } catch {
    // CORS / opaque / offline: best effort so the user still reaches the asset.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
