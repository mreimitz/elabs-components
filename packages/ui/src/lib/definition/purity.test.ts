/**
 * The definition base is React-free: validators, schema generators and the
 * CLI import it without pulling in React, Radix or any component. Every
 * non-test module may import only its siblings in this folder and the pure
 * `status-tone` tuple.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const statusTone = resolve(here, "../status-tone");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/\b(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']/g)) {
    if (m[1]) found.push(m[1]);
  }
  for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    if (m[1]) found.push(m[1]);
  }
  return found;
}

describe("definition base purity", () => {
  it("imports nothing outside the folder except the status tone tuple", () => {
    const offenders: string[] = [];
    const files = sourceFiles(here);
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      for (const spec of specifiers(readFileSync(file, "utf8"))) {
        const target = spec.startsWith(".") ? resolve(dirname(file), spec) : undefined;
        const inside = target !== undefined && !relative(here, target).startsWith("..");
        if (!inside && target !== statusTone) offenders.push(`${relative(here, file)} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no dependency in the status tone module", () => {
    expect(specifiers(readFileSync(`${statusTone}.ts`, "utf8"))).toEqual([]);
  });
});
