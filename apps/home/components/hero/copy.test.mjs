// Deny-list test for the page copy (RM-094). Run: node --test apps/home/components/hero/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { URL } from "node:url";

const COPY = readFileSync(new URL("../../content/copy.ts", import.meta.url), "utf8");
const DENY = [
  /\bbest\b/i,
  /#1\b/,
  /\brevolutionary\b/i,
  /\bworld-class\b/i,
  /\bblazing\b/i,
  /\bultimate\b/i,
];

test("copy.ts carries no superlatives", () => {
  for (const re of DENY) assert.doesNotMatch(COPY, re, `copy.ts matches ${re}`);
});

test("the hero headline is the approved one", () => {
  assert.match(COPY, /headline: "The hard screens, one system\."/);
});

// The scene narrates the fixture company (RM-095), never a placeholder one. Scans copy.ts and
// every hero source file except this test (which has to spell the patterns out).
const PLACEHOLDERS = [/\bAcme\b/i, /\blorem\b/i, /\bItem 1\b/, /\bfoo\b/i];
const HERO_DIR = new URL("./", import.meta.url);

test("copy.ts and the hero sources carry no placeholder names", () => {
  const files = readdirSync(HERO_DIR)
    .filter((f) => /\.(ts|tsx|mjs)$/.test(f) && f !== "copy.test.mjs")
    .map((f) => [f, readFileSync(new URL(f, HERO_DIR), "utf8")]);
  files.push(["copy.ts", COPY]);
  for (const [name, text] of files) {
    for (const re of PLACEHOLDERS) assert.doesNotMatch(text, re, `${name} matches ${re}`);
  }
});
