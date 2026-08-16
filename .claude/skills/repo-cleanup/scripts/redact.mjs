/**
 * redact.mjs — the single sanitisation seam for /repo-cleanup.
 *
 * EVERY writer passes user-derived text through `redact()` before it reaches a
 * report, an evidence file, or stdout. Nothing else in this skill is allowed to
 * emit a secret-shaped string.
 *
 * Design notes worth not rediscovering:
 * - Detection is by SHAPE, never by reading a value we were told is a secret.
 *   `.env` contents are never opened by this skill (see safety-model.md).
 * - A redaction is lossy on purpose: the placeholder keeps the KIND and the
 *   length class, never a prefix of the value. A "first 4 chars" hint is enough
 *   to shortlist a GitHub PAT, so we don't emit one.
 * - Order matters: the longest/most specific patterns run first, otherwise a
 *   generic high-entropy match eats half a connection string and the rest leaks.
 *
 * Zero dependencies. Node >= 22.
 */

/** @typedef {{ name: string, re: RegExp, kind: string }} Pattern */

/** @type {Pattern[]} */
const PATTERNS = [
  // --- structured credentials (most specific first) -------------------------
  {
    name: "url-userinfo",
    kind: "URL_CREDENTIAL",
    re: /\b([a-z][a-z0-9+.-]*):\/\/[^/\s:@]+:[^/\s@]+@/gi,
  },
  {
    name: "connection-string",
    kind: "CONNECTION_STRING",
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/\S+/gi,
  },
  {
    name: "private-key-block",
    kind: "PRIVATE_KEY",
    re: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
  },
  {
    name: "jwt",
    kind: "JWT",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },

  // --- vendor-prefixed tokens ----------------------------------------------
  { name: "github-token", kind: "GITHUB_TOKEN", re: /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g },
  { name: "github-fine-grained", kind: "GITHUB_TOKEN", re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: "anthropic-key", kind: "API_KEY", re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { name: "openai-key", kind: "API_KEY", re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { name: "slack-token", kind: "API_KEY", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g },
  { name: "aws-access-key", kind: "AWS_KEY", re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "google-api-key", kind: "API_KEY", re: /\bAIza[A-Za-z0-9_-]{35}\b/g },
  { name: "npm-token", kind: "NPM_TOKEN", re: /\bnpm_[A-Za-z0-9]{36}\b/g },

  // --- assignment forms: key = <anything non-trivial> -----------------------
  // Catches `_authToken=...`, `API_KEY: "..."`, `"password": "..."`, `--token X`.
  //
  // The separator MUST be a real assignment (`:` or `=`), or the key must be a
  // CLI flag (`--token X`). An earlier version also accepted plain whitespace,
  // which turned every English sentence containing "token", "secret", "auth" or
  // "password" into a redaction: this file's own report header, "Token figures
  // marked (estimate)…", was rewritten to "Token [REDACTED] marked…". For an
  // auditor whose reports are full of the word "token", that is not a cosmetic
  // bug — it destroys the output. Over-redaction is a real failure mode, not the
  // safe side of the trade.
  {
    name: "assigned-secret",
    kind: "SECRET_ASSIGNMENT",
    re: /(\b[A-Za-z0-9_.-]*(?:secret|passwd|password|token|api[_-]?key|apikey|auth|credential|private[_-]?key|client[_-]?secret|access[_-]?key)[A-Za-z0-9_.-]*["']?\s*[:=]\s*)(["'`]?)([^\s"'`,;)\]}]{6,})\2/gi,
  },
  {
    name: "flag-secret",
    kind: "SECRET_ASSIGNMENT",
    re: /(--[A-Za-z0-9_.-]*(?:secret|passwd|password|token|api[_-]?key|apikey|auth|credential|access[_-]?key)[A-Za-z0-9_.-]*\s+)(["'`]?)([^\s"'`,;)\]}]{6,})\2/gi,
  },

  // --- last resort: long opaque blobs --------------------------------------
  // Deliberately conservative: >=40 chars of base64/hex alphabet with at least
  // one digit AND one letter, and no whitespace. Plain prose and sha1 file
  // paths do not match; a leaked key does.
  {
    name: "high-entropy-blob",
    kind: "OPAQUE_BLOB",
    re: /\b(?=[A-Za-z0-9+/_-]{40,}={0,2}\b)(?=[^\s]*[0-9])(?=[^\s]*[A-Za-z])[A-Za-z0-9+/_-]{40,}={0,2}\b/g,
  },
];

/** Length classes keep some signal without keeping any of the value. */
function lengthClass(n) {
  if (n < 16) return "short";
  if (n < 48) return "medium";
  if (n < 256) return "long";
  return "huge";
}

function placeholder(kind, value) {
  return `[REDACTED:${kind}:${lengthClass(value.length)}]`;
}

/**
 * Redact secret-shaped substrings.
 *
 * @param {string} input
 * @returns {{ text: string, hits: Record<string, number> }}
 */
export function redactWithStats(input) {
  if (typeof input !== "string" || input.length === 0) {
    return { text: input ?? "", hits: {} };
  }
  /** @type {Record<string, number>} */
  const hits = {};
  let text = input;
  for (const { name, kind, re } of PATTERNS) {
    // Fresh lastIndex per call — these regexes are module-level and /g.
    re.lastIndex = 0;
    text = text.replace(re, (match, ...rest) => {
      hits[name] = (hits[name] ?? 0) + 1;
      if (name === "assigned-secret" || name === "flag-secret") {
        // groups: (1) key + separator, (2) optional quote, (3) value.
        // The key is KEPT — a field named `password` is information the report
        // wants; only its value is destroyed.
        const [prefix, quote, value] = rest;
        return `${prefix}${quote}${placeholder(kind, value)}${quote}`;
      }
      if (name === "url-userinfo") {
        const scheme = rest[0];
        return `${scheme}://${placeholder(kind, match)}@`;
      }
      return placeholder(kind, match);
    });
  }
  return { text, hits };
}

/** @param {string} input */
export function redact(input) {
  return redactWithStats(input).text;
}

/**
 * Deep-redact a JSON-serialisable value. Object KEYS are never redacted (they
 * are structure, and a key named `password` is information we want to report);
 * string VALUES always are.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function redactDeep(value) {
  if (typeof value === "string") return /** @type {any} */ (redact(value));
  if (Array.isArray(value)) return /** @type {any} */ (value.map(redactDeep));
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return /** @type {any} */ (out);
  }
  return value;
}

/**
 * Filenames that indicate a secret WITHOUT opening the file. The skill reports
 * these by path only — it never reads them (safety-model.md, "never open a
 * credential to prove it is one").
 *
 * @param {string} relPath
 */
export function isSecretBearingPath(relPath) {
  const base = relPath.split("/").pop() ?? relPath;
  // `.env` and its per-environment variants hold secrets; the committed
  // TEMPLATES (`.env.example`, `.env.sample`, and docs about them) do not, and
  // flagging those trains the reader to ignore the flag.
  if (/^\.env(\.[A-Za-z0-9_-]+)*$/.test(base)) {
    return !/\.(example|sample|template|dist|defaults?|md|txt)(\.|$)/i.test(base);
  }
  return (
    /\.(pem|key|p12|pfx|jks|keystore)$/i.test(base) ||
    /^id_(rsa|dsa|ecdsa|ed25519)$/.test(base) ||
    /^\.npmrc$/.test(base) ||
    /^\.netrc$/.test(base) ||
    /credentials(\.json)?$/i.test(base)
  );
}

export const REDACTION_PATTERN_NAMES = PATTERNS.map((p) => p.name);
