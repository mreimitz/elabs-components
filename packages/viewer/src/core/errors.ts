/**
 * Typed failures, so the UI can decide what to SHOW without string-matching a
 * message.
 *
 * The `message` on these errors is developer-facing — it goes to the console and
 * to bug reports. Everything the user reads is looked up from {@link ViewerErrorCode}
 * through `t()` (ADR 0017), which is why the code, not the prose, is the contract.
 */

/** Why a file could not be shown. */
export type ViewerErrorCode =
  /** No registered adapter claims this file. */
  | "unsupported-format"
  /** An adapter was built against a different registry protocol. */
  | "protocol-mismatch"
  /** The adapter exists but its optional peer dependency is not installed. */
  | "parser-missing"
  /** The bytes could not be obtained (network, permissions, a revoked blob). */
  | "read-failed"
  /** The bytes arrived but the parser rejected them. */
  | "parse-failed"
  /** The load was cancelled — a new source, or an unmounted view. */
  | "aborted";

export interface ViewerErrorOptions extends ErrorOptions {
  /** The file this is about, for the developer-facing message. */
  fileName?: string;
  /** For `parser-missing`: the packages a consumer has to install. */
  packages?: string[];
}

/** A failure a `FileViewer` can render, carrying a machine-readable {@link ViewerErrorCode}. */
export class ViewerError extends Error {
  readonly code: ViewerErrorCode;
  readonly fileName?: string;
  readonly packages?: string[];

  constructor(code: ViewerErrorCode, message: string, options: ViewerErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "ViewerError";
    this.code = code;
    this.fileName = options.fileName;
    this.packages = options.packages;
  }
}

/** True for a {@link ViewerError}, without relying on `instanceof` across bundles. */
export function isViewerError(value: unknown): value is ViewerError {
  return value instanceof ViewerError || (value instanceof Error && value.name === "ViewerError");
}

/** True when the failure is a cancellation rather than something to report. */
export function isAbort(value: unknown): boolean {
  if (isViewerError(value)) return value.code === "aborted";
  return value instanceof Error && (value.name === "AbortError" || value.name === "TimeoutError");
}

/**
 * Wrap an unknown throw as a {@link ViewerError}, preserving an existing one and
 * mapping an abort to the `aborted` code so callers do not report cancellations
 * as failures.
 */
export function toViewerError(
  value: unknown,
  fallbackCode: ViewerErrorCode,
  options: ViewerErrorOptions = {},
): ViewerError {
  if (isViewerError(value)) return value;
  if (isAbort(value)) {
    return new ViewerError("aborted", "The file load was cancelled.", { ...options, cause: value });
  }
  const message = value instanceof Error ? value.message : String(value);
  return new ViewerError(fallbackCode, message, { ...options, cause: value });
}

/**
 * A dynamic `import()` of an OPTIONAL peer that is not installed.
 *
 * Bundlers and Node report this differently (`ERR_MODULE_NOT_FOUND`,
 * `Cannot find module`, `Failed to resolve module specifier`, Vite's
 * `Failed to fetch dynamically imported module`), so match on the shapes rather
 * than one runtime's wording. A false positive here is cheap — the user is told
 * to install a package instead of seeing a raw parse error — and a false
 * negative is the anyview failure mode this exists to avoid: an unhelpful
 * module-resolution stack trace where a "install papaparse to open CSV files"
 * message belongs.
 */
export function isModuleNotFound(value: unknown): boolean {
  if (!(value instanceof Error)) return false;
  if ("code" in value && value.code === "ERR_MODULE_NOT_FOUND") return true;
  return /cannot find module|failed to resolve|dynamically imported module|module not found/i.test(
    value.message,
  );
}

/**
 * The `parser-missing` error, worded the same wherever the peer turns out to be
 * absent.
 *
 * There are TWO such places, which is why this is a function and not a literal
 * at one call site. The registry catches it when the adapter MODULE cannot be
 * fetched; `FileViewerProvider` catches it when the module loaded fine and the
 * adapter's own `await import("mammoth")` — inside `load()`, where every parser
 * engine is actually reached — rejects. Without the second, a consumer who
 * skipped an optional peer was told their file was damaged and offered a retry
 * that could never work.
 */
export function parserMissingError(
  adapterId: string,
  packages: string[],
  options: ViewerErrorOptions = {},
): ViewerError {
  return new ViewerError(
    "parser-missing",
    packages.length > 0
      ? `The "${adapterId}" adapter needs ${packages.join(", ")}, which is not installed.`
      : `The "${adapterId}" adapter could not be loaded.`,
    { ...options, packages },
  );
}
