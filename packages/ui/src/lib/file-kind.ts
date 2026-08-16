/**
 * The one file-type resolver for the whole library — extension + MIME → a
 * COARSE, CLOSED category.
 *
 * Before this existed the repo had three competing, package-private ideas of
 * "what kind of file is this": `ContextAssetType`
 * (`markdown|code|sql|csv|image`, `@qlik-coe-emea/qlabs-components-ai`),
 * `AttachmentMediaCategory` (six MIME buckets, same package) and
 * `UploadFile` (no kind at all, `@qlik-coe-emea/qlabs-components-ui`). None could
 * see the others, so each grew its own icon map and its own gaps.
 *
 * ## Why the category is closed and coarse (ADR 0024 §4)
 *
 * {@link FileCategory} answers "what SHAPE of thing is this" — enough to pick an
 * icon, a label, or a fallback surface. It is deliberately NOT the routing key
 * for a renderer. Fine-grained format matching (`.docx` vs `.odt`,
 * `.tsx` vs `.rs`) belongs to the adapter manifests in the package that owns the
 * parsers, so adding a format never means editing this file — and never means a
 * `@qlik-coe-emea/qlabs-components-ui` release.
 *
 * Pure data + string handling: no React, no DOM, no other deps.
 */

/**
 * Coarse file shape. CLOSED — adding a member is a breaking change for any
 * consumer with an exhaustive `switch`, so extend the adapter manifests instead.
 */
export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "code"
  | "text"
  | "data"
  | "archive"
  | "unknown";

/** What {@link resolveFileKind} knows about a file before anything reads it. */
export interface FileKind {
  /** Coarse shape, for icons, labels and fallback surfaces. */
  category: FileCategory;
  /**
   * Best-known MIME type. The caller's value wins when it is meaningful;
   * otherwise inferred from the extension, else `"application/octet-stream"`.
   */
  mediaType: string;
  /** Lowercased extension WITHOUT the dot (`"pdf"`), or `""` when there is none. */
  extension: string;
}

/**
 * Extension → MIME. Only entries whose MIME we would otherwise have to guess;
 * the browser fills `File.type` correctly for common web formats, but leaves it
 * empty for most source-code and data files.
 */
const EXTENSION_MEDIA_TYPES: Readonly<Record<string, string>> = {
  // Media. The browser fills `File.type` for these, but a NAME on its own (a
  // URL, an agent-produced filename, a drag-and-drop path) carries no MIME —
  // and resolving `photo.png` to "unknown" is the whole failure this map exists
  // to prevent.
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  epub: "application/epub+zip",
  // Spreadsheets
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  // Presentations
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  // Data
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  ndjson: "application/x-ndjson",
  jsonl: "application/x-ndjson",
  parquet: "application/vnd.apache.parquet",
  // Text
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  rst: "text/x-rst",
  // Code & markup
  html: "text/html",
  htm: "text/html",
  xml: "application/xml",
  svg: "image/svg+xml",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  jsx: "text/javascript",
  ts: "text/x-typescript",
  tsx: "text/x-typescript",
  py: "text/x-python",
  rb: "text/x-ruby",
  go: "text/x-go",
  rs: "text/x-rust",
  java: "text/x-java",
  kt: "text/x-kotlin",
  swift: "text/x-swift",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c++src",
  cs: "text/x-csharp",
  php: "text/x-php",
  sh: "application/x-sh",
  bash: "application/x-sh",
  zsh: "application/x-sh",
  sql: "application/sql",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  ini: "text/plain",
  // Archives
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  tgz: "application/gzip",
  bz2: "application/x-bzip2",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
};

/** Extensions whose category cannot be read off the MIME type. */
const EXTENSION_CATEGORIES: Readonly<Record<string, FileCategory>> = {
  // Code & markup — most carry a `text/*` MIME, which alone would say "text".
  html: "code",
  htm: "code",
  xml: "code",
  css: "code",
  js: "code",
  mjs: "code",
  cjs: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  kt: "code",
  swift: "code",
  c: "code",
  h: "code",
  cpp: "code",
  cs: "code",
  php: "code",
  sh: "code",
  bash: "code",
  zsh: "code",
  sql: "code",
  yaml: "code",
  yml: "code",
  toml: "code",
  ini: "code",
  // Data — `text/csv` would otherwise land in "text".
  csv: "data",
  tsv: "data",
  json: "data",
  ndjson: "data",
  jsonl: "data",
  parquet: "data",
  // Prose
  txt: "text",
  log: "text",
  md: "text",
  markdown: "text",
  rst: "text",
};

/** MIME (exact match) → category, for types no prefix rule covers. */
const MEDIA_TYPE_CATEGORIES: Readonly<Record<string, FileCategory>> = {
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.oasis.opendocument.text": "document",
  "application/rtf": "document",
  "application/epub+zip": "document",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.oasis.opendocument.spreadsheet": "spreadsheet",
  "application/vnd.ms-powerpoint": "presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "presentation",
  "application/vnd.oasis.opendocument.presentation": "presentation",
  "application/json": "data",
  "application/x-ndjson": "data",
  "application/vnd.apache.parquet": "data",
  "application/xml": "code",
  "application/sql": "code",
  "application/yaml": "code",
  "application/toml": "code",
  "application/x-sh": "code",
  "application/zip": "archive",
  "application/x-tar": "archive",
  "application/gzip": "archive",
  "application/x-bzip2": "archive",
  "application/x-7z-compressed": "archive",
  "application/vnd.rar": "archive",
};

/** The MIME we treat as "the caller told us nothing". */
const UNKNOWN_MEDIA_TYPE = "application/octet-stream";

/**
 * Lowercased extension without the dot. `""` when the name has none, is a
 * dotfile (`.gitignore` — the whole name is the "extension" to a human, but it
 * is not a format), or ends in a dot.
 */
export function extensionOf(name: string): string {
  // Strip any path and any query/hash a URL-derived name may carry.
  const base = (name.split(/[\\/]/).pop() ?? "").split(/[?#]/)[0] ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Best-known MIME for a filename, from its extension alone.
 * `undefined` when the extension is unknown — callers decide the fallback.
 */
export function mediaTypeFromName(name: string): string | undefined {
  return EXTENSION_MEDIA_TYPES[extensionOf(name)];
}

/** Strip parameters and casing: `"TEXT/CSV; charset=utf-8"` → `"text/csv"`. */
function normalizeMediaType(mediaType: string | undefined): string {
  const bare = (mediaType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  // Browsers and servers both use these to mean "I don't know".
  if (bare === "" || bare === UNKNOWN_MEDIA_TYPE || bare === "binary/octet-stream") return "";
  return bare;
}

function categoryFor(mediaType: string, extension: string): FileCategory {
  // The extension is more specific than a `text/*` MIME, so it wins for the
  // formats that would otherwise collapse into "text" (see EXTENSION_CATEGORIES).
  const byExtension = EXTENSION_CATEGORIES[extension];
  if (byExtension) return byExtension;

  const exact = MEDIA_TYPE_CATEGORIES[mediaType];
  if (exact) return exact;

  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType.startsWith("audio/")) return "audio";
  if (mediaType.startsWith("text/")) return "text";

  return "unknown";
}

/**
 * Resolve what a file is from its name and (optionally) the MIME the source
 * reported. Never throws; unknown input resolves to
 * `{ category: "unknown", mediaType: "application/octet-stream", extension: "" }`.
 *
 * A caller-supplied `mediaType` wins over the extension EXCEPT where the
 * extension is strictly more specific — `report.csv` served as `text/plain`
 * still resolves to `"data"`, because servers routinely under-specify.
 */
export function resolveFileKind(name: string, mediaType?: string): FileKind {
  const extension = extensionOf(name);
  const declared = normalizeMediaType(mediaType);
  const resolved = declared || mediaTypeFromName(name) || UNKNOWN_MEDIA_TYPE;
  return {
    category: categoryFor(resolved, extension),
    mediaType: resolved,
    extension,
  };
}
