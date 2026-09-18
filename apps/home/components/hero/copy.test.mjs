// Deny-list test for the page copy (RM-094). Run: node --test apps/home/components/hero/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
