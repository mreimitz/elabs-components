/**
 * check-ai-sdk-types-only.test.mjs — locks the WP-12 #97 D6 boundary so it can't
 * silently erode. Run in CI: `node --test scripts/check-ai-sdk-types-only.test.mjs`.
 *
 * Fixtures are INLINE strings (never real files under packages/ai/** — a violating
 * fixture there would trip the live gate itself).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findRuntimeImports } from "./check-ai-sdk-types-only.mjs";

const isClean = (src) => findRuntimeImports(src).length === 0;

test("ALLOWS types-only imports of `ai`", () => {
  assert.ok(isClean(`import type { UIMessage } from "ai";`));
  assert.ok(isClean(`import type { ToolUIPart, FileUIPart } from "ai";`));
  assert.ok(isClean(`import type Default from "ai";`));
  assert.ok(isClean(`export type { UIMessage } from "ai";`));
  // inline `type` specifiers pull no runtime value:
  assert.ok(isClean(`import { type UIMessage } from "ai";`));
  assert.ok(isClean(`import { type A, type B } from "ai";`));
  assert.ok(isClean(`import {} from "ai";`));
});

test("BLOCKS a named value import (the canonical case from the issue)", () => {
  const v = findRuntimeImports(`import { useChat } from "ai";`);
  assert.equal(v.length, 1);
  assert.equal(v[0].module, "ai");
  assert.match(v[0].reason, /named value import/);
});

test("BLOCKS default, namespace, side-effect, dynamic, and require imports", () => {
  assert.equal(findRuntimeImports(`import sdk from "ai";`).length, 1);
  assert.equal(findRuntimeImports(`import * as ai from "ai";`).length, 1);
  assert.equal(findRuntimeImports(`import "ai";`).length, 1);
  assert.equal(findRuntimeImports(`const m = await import("ai");`).length, 1);
  assert.equal(findRuntimeImports(`const m = require("ai");`).length, 1);
  // template-literal (backtick) static specifiers are runtime too:
  assert.equal(findRuntimeImports("const m = await import(`ai`);").length, 1);
  assert.equal(findRuntimeImports("const m = require(`ai`);").length, 1);
});

test("BLOCKS the `type as <alias>` value-import family (binding literally named `type`)", () => {
  // `type` immediately followed by `as` is a VALUE binding named `type`, not the modifier.
  assert.equal(findRuntimeImports(`import { type as foo } from "ai";`).length, 1);
  assert.equal(findRuntimeImports(`export { type as foo } from "ai";`).length, 1);
  assert.equal(findRuntimeImports(`import { type as type } from "ai";`).length, 1);
  // a real value hiding beside a legit type-only specifier — must still flag the statement:
  assert.equal(findRuntimeImports(`import { type as a, type B } from "ai";`).length, 1);
  // genuinely type-only stays clean, even when aliased to the identifier `type`:
  assert.ok(isClean(`import { type X as type } from "ai";`));
  assert.ok(isClean(`import { type X as Y } from "ai";`));
});

test("BLOCKS a mixed import where one specifier is a runtime value", () => {
  assert.equal(findRuntimeImports(`import { type UIMessage, useChat } from "ai";`).length, 1);
  assert.equal(findRuntimeImports(`import Default, { type A } from "ai";`).length, 1);
});

test("BLOCKS runtime imports from any `@ai-sdk/*` provider, ALLOWS its types", () => {
  assert.equal(findRuntimeImports(`import { openai } from "@ai-sdk/openai";`).length, 1);
  assert.equal(findRuntimeImports(`import { streamText } from "@ai-sdk/provider";`).length, 1);
  assert.ok(isClean(`import type { LanguageModelV1 } from "@ai-sdk/provider";`));
});

test("BLOCKS a value re-export of `ai`", () => {
  assert.equal(findRuntimeImports(`export { useChat } from "ai";`).length, 1);
  assert.equal(findRuntimeImports(`export * from "ai";`).length, 1);
});

test("IGNORES unrelated modules and lookalikes", () => {
  assert.ok(isClean(`import { useChat } from "ai-sdk-lookalike";`));
  assert.ok(isClean(`import { something } from "openai";`));
  assert.ok(isClean(`import { Button } from "@elabs-ai/components-ui";`));
  assert.ok(isClean(`import { useEffect } from "react";`));
});

test("IGNORES commented-out runtime imports", () => {
  assert.ok(isClean(`// import { useChat } from "ai";`));
  assert.ok(isClean(`/* import { streamText } from "ai"; */`));
  // a prose comment mentioning the runtime names must not trip the gate:
  assert.ok(isClean(`// the app owns model calls (e.g. useChat) — see "ai" docs`));
});

test("handles a multi-line named import block", () => {
  const ok = `import type {\n  UIMessage,\n  ToolUIPart,\n} from "ai";`;
  assert.ok(isClean(ok));
  const bad = `import {\n  useChat,\n  type UIMessage,\n} from "ai";`;
  assert.equal(findRuntimeImports(bad).length, 1);
});
