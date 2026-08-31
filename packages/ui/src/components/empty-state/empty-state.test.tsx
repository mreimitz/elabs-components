import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "empty-state.tsx"), "utf8");

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="Empty" description="Nothing here" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("clamps a passed icon to the fixed 40×40 slot, matching its documented behavior (#47)", () => {
    // EmptyState only ever forwards `icon` to StatePanel, whose fixed-size
    // icon slot clamps it via `[&_svg]:size-10` — it never forwards
    // `illustration`, whose slot is unclamped. Lock the REAL behavior so it
    // can't silently drift further from whatever the JSDoc claims.
    render(<EmptyState title="X" icon={<svg data-testid="passed-icon" />} />);
    const svg = screen.getByTestId("passed-icon");
    expect(svg.parentElement?.className ?? "").toContain("size-10");
  });

  it("JSDoc claims only what `icon` actually does — does not promise an unclamped illustration slot (#47)", () => {
    // #47 finding C: the JSDoc said "icon/illustration" but the component
    // only ever forwards `icon` (still clamped to 40x40). A reader passing a
    // larger illustration through `icon` expecting it to render at full size
    // would be surprised by the clamp. The doc must describe the clamp, not
    // the capability the deprecated wrapper doesn't have.
    expect(source).not.toMatch(/icon\/illustration/i);
    expect(source).toMatch(/clamp/i);
  });
});
