import { describe, expect, it, vi } from "vitest";

/**
 * `mermaid` is genuinely absent from this file's module registry (deliberately
 * mocked to the shape a bundler hands back for an uninstalled optional peer —
 * see below), so this lives in its OWN file rather than a `describe` inside
 * `_lazy-mermaid.test.ts`. `vi.mock` is hoisted to the top of the file and
 * applies for the file's entire run; a second, conflicting registration for
 * the same specifier inside one file (this shape, vs. `_lazy-mermaid.test.ts`'s
 * `{ initialize, render }` shape) does not reliably scope to one `describe`
 * block — it can leak into sibling tests in the same file that expect the
 * OTHER shape, corrupting them instead of the isolated case this is meant to
 * add. See `.claude/rules/component-api.md` "Regression locks with observable
 * side effects must be verified co-resident" for the general version of this
 * lesson; a global module-mock registration is exactly such a side effect.
 *
 * Vite's production build substitutes an EMPTY module for a genuinely-absent
 * optional peer (`export default {}`) rather than rejecting the import — so
 * `loadEngine()`'s own shape guard in `_lazy-mermaid.ts`, not a `.catch()`, is
 * what has to catch this. `_lazy-mermaid.test.ts`'s own "engine call itself
 * fails" test is circular for this exact case (it rejects with the very
 * string it then asserts on); this one instead makes the RESOLVED module
 * shape wrong, the way an empty stub actually is, and checks `loadEngine`'s
 * guard converts that into the module-not-found-shaped message
 * `isModuleNotFoundMessage` recognizes.
 *
 * **Explicit scope statement (issue #94):** this test proves the LOAD-TIME
 * ERROR PATH — what happens when `import("mermaid")` resolves to an empty
 * stub — and nothing more. It does NOT prove mermaid is absent from an
 * installed consumer tree, and must never be read as though it did. For the
 * other four lazy-loaded optional peers (Rive, xterm, `@xterm/addon-fit`,
 * media-chrome), `fixtures/consumer-smoke` + `pnpm consumer:check` give an
 * end-to-end proof of genuine absence from the installed tarball. That proof
 * is currently UNWRITABLE for mermaid: two of `@elabs-ai/components-ai`'s own
 * plain dependencies (`streamdown`, `@streamdown/mermaid`) each depend on
 * mermaid directly, so mermaid is never actually absent from the installed
 * tree for this fixture to observe (see `scripts/check-optional-peer-transitives.mjs`
 * / `pnpm optional-peers:check`, which proves and tracks that residual
 * instead). Do not "fix" this gap by trying to make this file assert
 * absence — it can't, until upstream `streamdown` declares mermaid an
 * optional peer of its own.
 */
vi.mock("mermaid", () => ({ default: {} }));

describe("lazy mermaid plugin — genuinely absent optional peer (#33)", () => {
  it("throws a module-not-found-shaped message when the resolved module has no initialize/render", async () => {
    const { createLazyMermaidPlugin } = await import("./_lazy-mermaid");

    await expect(
      createLazyMermaidPlugin().getMermaid().render("d1", "graph TD; A-->B;"),
    ).rejects.toThrow(/cannot find module 'mermaid'/i);
  });
});
