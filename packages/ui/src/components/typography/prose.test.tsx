/**
 * prose.test.tsx — #399 class-name lock on the on-surface brand-accent rung.
 *
 * These are CLASS-NAME locks, NOT contrast proofs. The ratio itself is asserted
 * on the tokens in `packages/tokens/src/themes-contrast.test.ts`
 * (`primary-text ≥ 4.5:1 on …`, every theme × five content surfaces); what this
 * file pins is that the components that render the brand accent AS TEXT keep
 * reaching for that rung instead of sliding back onto the `--primary` FILL,
 * whose gated contract is only the WCAG 1.4.11 mark bar (3:1). The two halves
 * together are what makes #399 non-regressable: a token that clears AA nobody
 * uses fixes nothing, and a call site pointing at a token nobody gates is how
 * this shipped sub-AA in the first place.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Text } from "./typography";
import { ProseLink } from "./prose";

afterEach(cleanup);

describe("ProseLink — #399 on-surface brand-accent rung", () => {
  it("renders text-primary-text, never the text-primary fill rung", () => {
    render(<ProseLink href="https://example.com">docs</ProseLink>);

    const link = screen.getByRole("link", { name: "docs" });
    const classes = link.className.split(/\s+/);
    expect(classes).toContain("text-primary-text");
    expect(classes).not.toContain("text-primary");
  });

  it("keeps its resting underline (the non-colour cue is independent of the rung)", () => {
    render(<ProseLink href="https://example.com">docs</ProseLink>);

    const classes = screen.getByRole("link", { name: "docs" }).className.split(/\s+/);
    expect(classes).toContain("underline");
  });
});

describe("Text tone=primary — #399 on-surface brand-accent rung", () => {
  it("maps the primary tone to text-primary-text, never the fill rung", () => {
    render(<Text tone="primary">accent</Text>);

    const classes = screen.getByText("accent").className.split(/\s+/);
    expect(classes).toContain("text-primary-text");
    expect(classes).not.toContain("text-primary");
  });
});
