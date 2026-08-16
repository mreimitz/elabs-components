/**
 * check-charts-reuse.test.mjs — locks the #168/#169 reuse-audit gate.
 * Run in CI: `node --test scripts/check-charts-reuse.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never real files).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findChartsReuseViolations } from "./check-charts-reuse.mjs";

// Hermetic UI name set — covers the collision cases we test, plus a few extras.
const uiNames = new Set([
  "Card",
  "Button",
  "Tooltip",
  "TooltipContent",
  "Table",
  "Progress",
  "Separator",
  "ScrollArea",
]);

const isClean = (src) => findChartsReuseViolations(src, uiNames).length === 0;
const hasViolation = (src) => findChartsReuseViolations(src, uiNames).length > 0;

// ── Class 1: collision — must FLAG ───────────────────────────────────────────

test("FLAGS: export function with ui-owned name", () => {
  assert.ok(hasViolation(`export function TooltipContent() { return null; }`));
});

test("FLAGS: export const with ui-owned name", () => {
  assert.ok(hasViolation(`export const Card = () => null;`));
});

test("FLAGS: export class with ui-owned name", () => {
  assert.ok(hasViolation(`export class Button {}`));
});

test("FLAGS: export default function with ui-owned name", () => {
  assert.ok(hasViolation(`export default function Tooltip() { return null; }`));
});

test("FLAGS: export default bare identifier backed by local function", () => {
  const src = `
function Card() { return null; }
export default Card;
`;
  assert.ok(hasViolation(src));
});

// ── Class 2: @base-ui — must FLAG ────────────────────────────────────────────

test("FLAGS: import from @base-ui/react", () => {
  assert.ok(hasViolation(`import { Foo } from "@base-ui/react";`));
});

test("FLAGS: import from @base-ui/something subpackage", () => {
  assert.ok(hasViolation(`import { x } from "@base-ui/something";`));
});

test("FLAGS: type import from @base-ui/react (charts must have zero)", () => {
  assert.ok(hasViolation(`import type { Foo } from "@base-ui/react";`));
});

// ── True negatives — must NOT FLAG ───────────────────────────────────────────

test("DOES NOT FLAG: import { Card, Table, TooltipContent } from @elabs-ai/components-ui", () => {
  assert.ok(isClean(`import { Card, Table, TooltipContent } from "@elabs-ai/components-ui";`));
});

test("DOES NOT FLAG: export { Card } from @elabs-ai/components-ui (pass-through re-export)", () => {
  assert.ok(isClean(`export { Card } from "@elabs-ai/components-ui";`));
});

test("DOES NOT FLAG: import { Table as TableIcon } from lucide-react", () => {
  assert.ok(isClean(`import { Table as TableIcon } from "lucide-react";`));
});

test("DOES NOT FLAG: export function with non-ui-owned name", () => {
  assert.ok(isClean(`export function MarkerTooltipContent() { return null; }`));
});

test("DOES NOT FLAG: export function ChartTooltipContent (post-#168 name)", () => {
  assert.ok(isClean(`export function ChartTooltipContent() { return null; }`));
});

test("DOES NOT FLAG: comments mentioning old names", () => {
  // A comment containing `@base-ui Progress` must not trip the gate.
  assert.ok(isClean(`// dropped @base-ui Progress`));
  assert.ok(isClean(`/* import { Card } from "@elabs-ai/components-ui" */`));
});

test("DOES NOT FLAG: export interface with ui-owned name (type only)", () => {
  assert.ok(isClean(`export interface CardProps { className?: string; }`));
});

test("DOES NOT FLAG: export type alias with ui-owned name", () => {
  assert.ok(isClean(`export type ButtonProps = { onClick?: () => void; };`));
});

test("DOES NOT FLAG: export default bare identifier without a local declaration", () => {
  // `Card` is imported, not declared locally — no local decl → no flag.
  const src = `
import { Card } from "@elabs-ai/components-ui";
export default Card;
`;
  assert.ok(isClean(src));
});

test("does not flag unrelated modules or lookalikes", () => {
  assert.ok(isClean(`import { useSpring } from "motion/react";`));
  assert.ok(isClean(`import { cn } from "@elabs-ai/components-ui";`));
  assert.ok(isClean(`import { something } from "base-ui-lookalike";`));
});
