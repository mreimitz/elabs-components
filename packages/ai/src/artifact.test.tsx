/**
 * artifact.test.tsx — smoke + naming lock for the generated-artifact frame (#59).
 *
 * `Artifact` is the panel a generated document/preview lands in. Every control
 * in its header is ICON-ONLY, so the assertions that matter are accessible
 * names: `ArtifactClose` must always announce "Close", and `ArtifactAction`
 * must fall back to its tooltip text when no explicit label is given — an
 * unnamed icon button is a WCAG 4.1.2 failure and is invisible in review.
 *
 * The frame's `border` is also locked here: it reads redundant on a light theme
 * (the recess + shadow already lift it) but at high decoration/decoration the
 * shadow is zeroed and the border becomes the SOLE structural cue — the
 * canonical "redundant-on-light, sole-cue-under-decoration" KEEP (#194).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SaveIcon } from "lucide-react";
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "./artifact";

describe("Artifact — frame", () => {
  it("renders header, title, description and content together", () => {
    render(
      <Artifact>
        <ArtifactHeader>
          <ArtifactTitle>Q3 forecast</ArtifactTitle>
          <ArtifactDescription>Generated from the pipeline export</ArtifactDescription>
        </ArtifactHeader>
        <ArtifactContent>body</ArtifactContent>
      </Artifact>,
    );
    expect(screen.getByText("Q3 forecast")).toBeInTheDocument();
    expect(screen.getByText("Generated from the pipeline export")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("keeps its border (#194 — the sole structural cue once decoration zeroes the shadow)", () => {
    const { container } = render(<Artifact>x</Artifact>);
    expect(container.firstChild).toHaveClass("border");
  });

  it("merges a caller className without dropping the frame", () => {
    const { container } = render(<Artifact className="extra">x</Artifact>);
    expect(container.firstChild).toHaveClass("extra");
    expect(container.firstChild).toHaveClass("rounded-lg");
  });

  it("spreads arbitrary props onto the root (id/aria-*)", () => {
    const { container } = render(
      <Artifact id="a1" aria-label="Forecast artifact">
        x
      </Artifact>,
    );
    expect(container.firstChild).toHaveAttribute("id", "a1");
    expect(screen.getByLabelText("Forecast artifact")).toBeInTheDocument();
  });
});

describe("ArtifactClose — icon-only naming", () => {
  it('always announces "Close" even though it renders only a glyph', () => {
    render(<ArtifactClose />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("calls onClick", () => {
    const onClick = vi.fn();
    render(<ArtifactClose onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is type="button" so it cannot submit a surrounding form', () => {
    render(<ArtifactClose />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("type", "button");
  });
});

describe("ArtifactAction — icon-only naming", () => {
  it("takes its accessible name from label", () => {
    render(<ArtifactAction icon={SaveIcon} label="Save to workspace" />);
    expect(screen.getByRole("button", { name: "Save to workspace" })).toBeInTheDocument();
  });

  it("falls back to the tooltip text when no label is given (never an unnamed button)", () => {
    render(<ArtifactAction icon={SaveIcon} tooltip="Save" />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders inside a tooltip trigger without losing the name", () => {
    render(
      <ArtifactActions>
        <ArtifactAction icon={SaveIcon} tooltip="Save" label="Save to workspace" />
      </ArtifactActions>,
    );
    expect(screen.getByRole("button", { name: "Save to workspace" })).toBeInTheDocument();
  });

  it("calls onClick", () => {
    const onClick = vi.fn();
    render(<ArtifactAction icon={SaveIcon} label="Save" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
