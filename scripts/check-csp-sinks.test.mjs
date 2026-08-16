/**
 * Self-test for the Trusted-Types sink gate.
 *
 * The failure this guards against is a gate that silently stops firing: it would
 * report green while a strict-CSP consumer renders a blank window.
 */

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { PATCHED_PACKAGES, findSinks, scanOurSource } from "./check-csp-sinks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

test("findSinks: catches every fatal assignment form, including the empty string", () => {
  assert.deepEqual(findSinks("const x = 1"), []);
  assert.ok(findSinks("<style dangerouslySetInnerHTML={{__html: css}} />").length);
  assert.ok(findSinks("el.innerHTML = html").length);
  assert.ok(findSinks("el.outerHTML = html").length);
  assert.ok(findSinks("el.insertAdjacentHTML('beforeend', s)").length);
  assert.ok(findSinks("document.write('<b>')").length);
  // Chromium throws on the empty string too — @number-flow/react reaches the
  // sink exactly this way, so an "it's only empty" carve-out would be wrong.
  assert.ok(findSinks("el.innerHTML = ''").length, "empty string is still a sink");
});

test("findSinks: a MENTION in a comment is not a sink, but one in code still is", () => {
  // The false positive this fixes: viewer's docx-model.ts documents that it
  // parses mammoth's HTML and throws it away precisely SO nothing reaches the
  // sink — and the raw scan read that prose as the sink itself.
  assert.deepEqual(
    findSinks("/**\n * Rendering it would mean `dangerouslySetInnerHTML`, so we don't.\n */"),
    [],
    "doc-comment mention is not a sink",
  );
  assert.deepEqual(findSinks("// el.innerHTML = html — never do this"), []);
  // …and the gate must not have gone blind in the process.
  assert.ok(
    findSinks("/** never use innerHTML */\nel.innerHTML = html").length,
    "a real sink below a comment still fires",
  );
  assert.ok(
    findSinks("const src = 'el.innerHTML = x';").length,
    "a sink inside a string literal still fires",
  );
  assert.ok(
    findSinks("const re = /\\/\\//;\nel.innerHTML = html").length,
    "a regex literal cannot swallow the rest of the line",
  );
});

test("scanOurSource: flags a planted sink in package source", () => {
  const dir = mkdtempSync(join(tmpdir(), "sinks-"));
  mkdirSync(join(dir, "ui", "src"), { recursive: true });
  writeFileSync(join(dir, "ui", "src", "clean.tsx"), "export const A = () => <div />;");
  const hits = scanOurSource(dir);
  assert.equal(hits.length, 0, "clean source passes");

  writeFileSync(
    join(dir, "ui", "src", "bad.tsx"),
    "export const B = () => <style dangerouslySetInnerHTML={{ __html: css }} />;",
  );
  const after = scanOurSource(dir);
  assert.equal(after.length, 1);
  assert.match(after[0].file, /bad\.tsx$/);
});

test("scanOurSource: ignores tests and stories", () => {
  const dir = mkdtempSync(join(tmpdir(), "sinks-"));
  mkdirSync(join(dir, "ui", "src"), { recursive: true });
  writeFileSync(join(dir, "ui", "src", "x.test.tsx"), "el.innerHTML = 'x'");
  writeFileSync(join(dir, "ui", "src", "x.stories.tsx"), "el.innerHTML = 'x'");
  assert.deepEqual(scanOurSource(dir), []);
});

test("the patched Radix packages carry no sink in the installed tree", () => {
  // The rung that matters most: a version bump that drops a patch silently
  // re-breaks every strict-CSP consumer, with a green unit suite.
  for (const pkg of PATCHED_PACKAGES) {
    const dist = join(root, "packages/ui/node_modules", ...pkg.split("/"), "dist/index.mjs");
    const code = readFileSync(dist, "utf8");
    assert.deepEqual(
      findSinks(code),
      [],
      `${pkg} carries a Trusted-Types sink again — the patch in patches/ was dropped`,
    );
  }
});

test("the patches are registered so a fresh install reapplies them", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const patched = Object.keys(pkg.pnpm?.patchedDependencies ?? {});
  for (const name of PATCHED_PACKAGES) {
    assert.ok(
      patched.some((p) => p.startsWith(`${name}@`)),
      `${name} must stay in pnpm.patchedDependencies — otherwise the patch never applies`,
    );
  }
});

test("gate: passes on the committed tree", () => {
  const out = execFileSync("node", [join(here, "check-csp-sinks.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  assert.match(out, /patched package\(s\) still clean/);
});
