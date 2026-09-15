/**
 * ai-microcopy-a11y — every `aria-label` and `placeholder` in `@elabs-ai/components-ai`
 * stays translatable (ADR 0017 Stage 1). Ported from the invariant test in
 * scripts/check-microcopy.test.mjs: a screen-reader user in another locale has no
 * workaround for a hardcoded accessible name, so this is a zero rule, not a ratchet.
 * Scope matches the old test: top-level `packages/ai/src/*.tsx`, not tests/stories.
 */
import { findHardcodedMicrocopy } from "./microcopy.mjs";

const src = (body, file = "packages/ai/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "ai-microcopy-a11y",
  scope: "components",
  doc: "Every literal `aria-label` and `placeholder` in `@elabs-ai/components-ai` goes through `t()` — no baseline, no exceptions beyond `// i18n-exempt: <reason>`.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob("packages/ai/src/*.tsx", {
      ignore: "**/*.{test,stories}.tsx",
    }))
      for (const h of findHardcodedMicrocopy(ctx.readFile(file)))
        if (h.kind === "aria-label" || h.kind === "placeholder")
          out.push({ file, line: h.line, msg: `hardcoded ${h.kind} "${h.text}" — use t()` });
    return out;
  },
  fixtures: {
    pass: [
      src('<button aria-label={t("ai.x")} placeholder={t("ai.y")} />'),
      src("<span>Visible text is the microcopy ratchet’s job</span>"),
      src('<button aria-label="Next" />', "packages/ai/src/x.stories.tsx"),
      src('<button aria-label="Next" />', "packages/ai/src/nested/x.tsx"),
      src('<button aria-label="Next" />', "packages/ui/src/x.tsx"),
    ],
    fail: [src('<button aria-label="Next branch" />'), src('<input placeholder="Ask…" />')],
  },
};
