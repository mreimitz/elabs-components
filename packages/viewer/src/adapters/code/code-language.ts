/**
 * Extension → Shiki language id.
 *
 * A pure data module on purpose: `code-manifest.ts` derives the extensions it
 * claims from this map, so the list the registry matches on and the list the
 * highlighter can actually tokenize can never drift apart. Adding a language is
 * one line here.
 *
 * What is deliberately ABSENT is as load-bearing as what is present. `json`,
 * `csv`, `md` and `svg` are claimed by their own adapters — a JSON file gets a
 * collapsible tree, not a coloured wall of text — and an extension listed in two
 * manifests would be decided by registration order rather than by design.
 */

import type { BundledLanguage } from "shiki";

/**
 * Shiki's own language ids.
 *
 * `satisfies Record<string, BundledLanguage>` is the point of the annotation: a
 * typo'd grammar name fails typecheck HERE, rather than at runtime as a file
 * that silently refuses to highlight. Type-only import, so this stays a pure
 * data module with no edge to the engine.
 */
const LANGUAGE_BY_EXTENSION = {
  bash: "shellscript",
  c: "c",
  cc: "cpp",
  cjs: "javascript",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  cts: "typescript",
  dart: "dart",
  diff: "diff",
  dockerfile: "docker",
  go: "go",
  gql: "graphql",
  graphql: "graphql",
  groovy: "groovy",
  h: "c",
  hcl: "hcl",
  hpp: "cpp",
  htm: "html",
  html: "html",
  ini: "ini",
  java: "java",
  js: "javascript",
  jsx: "jsx",
  kt: "kotlin",
  kts: "kotlin",
  less: "less",
  lua: "lua",
  makefile: "make",
  mjs: "javascript",
  mts: "typescript",
  patch: "diff",
  php: "php",
  pl: "perl",
  proto: "proto",
  ps1: "powershell",
  py: "python",
  r: "r",
  rb: "ruby",
  rs: "rust",
  sass: "sass",
  scala: "scala",
  scss: "scss",
  sh: "shellscript",
  sql: "sql",
  svelte: "svelte",
  swift: "swift",
  tf: "terraform",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zsh: "shellscript",
} as const satisfies Record<string, BundledLanguage>;

/** Every extension the code adapter claims, lowercase and without the dot. */
export const CODE_EXTENSIONS = Object.keys(LANGUAGE_BY_EXTENSION);

/**
 * The Shiki language for a file name, or `undefined` when nothing matches.
 *
 * Matches the extension first, then the whole (lowercased) file name — that is
 * what catches `Dockerfile` and `Makefile`, which carry their language in the
 * name and have no extension at all.
 */
export function languageFor(fileName: string): BundledLanguage | undefined {
  const name = fileName.toLowerCase();
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1) : name;
  const map: Record<string, BundledLanguage> = LANGUAGE_BY_EXTENSION;
  return map[extension] ?? map[name];
}
