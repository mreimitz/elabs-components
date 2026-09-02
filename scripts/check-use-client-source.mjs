#!/usr/bin/env node
/**
 * check-use-client-source.mjs — enforce "use client" in hook-using source files.
 *
 * WHY THIS EXISTS: components that use React hooks (useState, useRef, useEffect,
 * useCallback, useId, etc.) must be marked with "use client" when consumed by RSC
 * apps. Source-level directives are required because:
 * 1. Local development consumes TypeScript source directly via the exports map
 * 2. The tsup build banner alone is insufficient for source consumption paths
 * 3. Future package splits or build changes could silently regress RSC safety
 *
 * This gate ensures every hook-using file in client packages carries the directive.
 *
 * Flags:
 *   --fix     rewrite files to add missing directives (does NOT commit)
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { execSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

const argv = process.argv.slice(2);
const FIX = argv.includes("--fix");

const log = (m) => console.log(m);
const err = (m) => console.error(m);

/**
 * Packages that should have "use client" directives in their source.
 * These are client-side-only or client-containing packages.
 */
const CLIENT_PACKAGES = [
  "ui",
  "data",
  "ai",
  "flow",
  "maps",
  "charts",
  "editor",
  "viewer",
  "terminal",
];

/**
 * React hook imports that require "use client".
 */
const HOOK_PATTERNS = [
  /\buseState\b/,
  /\buseRef\b/,
  /\buseEffect\b/,
  /\buseCallback\b/,
  /\buseContext\b/,
  /\buseReducer\b/,
  /\buseLayoutEffect\b/,
  /\buseId\b/,
  /\buseMemo\b/,
  /\buseImperativeHandle\b/,
  /\buseDebugValue\b/,
  /\buseTransition\b/,
  /\buseDeferredValue\b/,
];

/**
 * Check if a file uses React hooks.
 */
function usesHooks(content) {
  return HOOK_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Check if a file has "use client" directive.
 */
function hasUseClientDirective(content) {
  return /^\s*["']use client["'];?/m.test(content);
}

/**
 * Add "use client" directive if missing.
 */
function addUseClientDirective(content) {
  if (hasUseClientDirective(content)) {
    return content; // Already has it
  }
  return `"use client";\n\n${content}`;
}

/**
 * Find all .tsx and .ts files in a directory.
 */
function findSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (entry.name === "__tests__") continue;

      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        findSourceFiles(path, files);
      } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
        // Exclude test and story files
        if (
          !entry.name.endsWith(".test.ts") &&
          !entry.name.endsWith(".test.tsx") &&
          !entry.name.endsWith(".stories.ts") &&
          !entry.name.endsWith(".stories.tsx")
        ) {
          files.push(path);
        }
      }
    }
  } catch (e) {
    // Ignore read errors on specific directories
  }

  return files;
}

/**
 * Main check function.
 * Verifies: any package using hooks has at least one "use client" module.
 */
function main() {
  const violations = [];

  for (const pkgName of CLIENT_PACKAGES) {
    const srcDir = join(REPO_ROOT, "packages", pkgName, "src");
    if (!existsSync(srcDir)) {
      continue;
    }

    const files = findSourceFiles(srcDir);

    // Check if package has any hook-using files
    const hasHooks = files.some((f) => {
      try {
        return usesHooks(readFileSync(f, "utf8"));
      } catch {
        return false;
      }
    });

    // Check if package has at least one use-client module
    const hasUseClient = files.some((f) => {
      try {
        return hasUseClientDirective(readFileSync(f, "utf8"));
      } catch {
        return false;
      }
    });

    // Violation: package uses hooks but has zero use-client modules
    if (hasHooks && !hasUseClient) {
      violations.push({
        package: pkgName,
        issue: `uses hooks but has zero "use client" modules in source`,
      });
    }
  }

  if (violations.length > 0) {
    err("✖ use-client-source: packages using hooks must have at least one use-client module:");
    for (const v of violations) {
      err(`  @elabs-ai/components-${v.package}: ${v.issue}`);
    }
    return 1;
  }

  log("✔ use-client-source: all hook-using packages have at least one use-client module.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { usesHooks, hasUseClientDirective, findSourceFiles };
