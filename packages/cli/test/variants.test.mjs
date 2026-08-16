import { test } from "node:test";
import assert from "node:assert/strict";
import { extractVariants } from "../lib/core.mjs";

test("extractVariants expands cva variant unions + defaults (Button)", () => {
  const src = `
    export const buttonVariants = cva("base classes", {
      variants: {
        variant: { default: "a", secondary: "b", destructive: "c", outline: "d", ghost: "e", link: "f" },
        size: { sm: "x", default: "y", lg: "z", icon: "i" },
      },
      defaultVariants: { variant: "default", size: "default" },
    });
  `;
  const v = extractVariants(src).button;
  assert.ok(v, "button variants extracted");
  assert.deepEqual(v.variants.variant, [
    "default",
    "secondary",
    "destructive",
    "outline",
    "ghost",
    "link",
  ]);
  assert.ok(v.variants.size.includes("icon"), "size includes icon");
  assert.equal(v.defaultVariants.variant, "default");
  assert.equal(v.defaultVariants.size, "default");
  assert.equal(v.source, "buttonVariants");
});

test("extractVariants survives comments with quotes/braces (Card regression)", () => {
  // Mirrors cardVariants: a comment inside `variants` containing a quote and parens
  // used to corrupt the scanner and drop the `interactive` group.
  const src = `
    export const cardVariants = cva("base", {
      variants: {
        // hover-lift; neutralized under reduced-motion ("reduced != none") (shadow stays)
        interactive: { true: "t", false: "" },
      },
      defaultVariants: { interactive: false },
    });
  `;
  const v = extractVariants(src).card;
  assert.ok(v, "card variants extracted despite comments");
  assert.deepEqual(v.variants.interactive, ["true", "false"]);
  assert.equal(v.defaultVariants.interactive, "false");
});

test("extractVariants ignores cva with no variants and quoted variant keys", () => {
  assert.deepEqual(extractVariants(`export const xVariants = cva("only base");`), {});
  const v = extractVariants(`
    export const yVariants = cva("b", { variants: { "tone-x": { "a-1": "p", "b-2": "q" } } });
  `).y;
  assert.deepEqual(v.variants["tone-x"], ["a-1", "b-2"]);
});
