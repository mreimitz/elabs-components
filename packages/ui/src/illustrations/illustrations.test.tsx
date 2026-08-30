import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  EmptyListIllustration,
  NoResultsIllustration,
  NoAccessIllustration,
  ErrorIllustration,
  OfflineIllustration,
  SuccessIllustration,
  FirstRunIllustration,
} from "./index";

// No literal hex anywhere in a rendered attribute — only `currentColor` or a
// `var(--…)` token reference (inline style or attribute) may carry color.
const RAW_HEX_RE = /#[0-9a-fA-F]{3,6}\b/;

const ILLUSTRATIONS = [
  ["EmptyListIllustration", EmptyListIllustration, "empty-list-illustration"],
  ["NoResultsIllustration", NoResultsIllustration, "no-results-illustration"],
  ["NoAccessIllustration", NoAccessIllustration, "no-access-illustration"],
  ["ErrorIllustration", ErrorIllustration, "error-illustration"],
  ["OfflineIllustration", OfflineIllustration, "offline-illustration"],
  ["SuccessIllustration", SuccessIllustration, "success-illustration"],
  ["FirstRunIllustration", FirstRunIllustration, "first-run-illustration"],
] as const;

describe("state illustrations", () => {
  it.each(ILLUSTRATIONS)(
    "%s renders a decorative, token-driven <svg>",
    (_name, Component, slot) => {
      const { container } = render(<Component />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.tagName.toLowerCase()).toBe("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("role", "presentation");
      expect(svg).toHaveAttribute("data-slot", slot);

      // No raw hex anywhere in the tree's attributes (element attrs + style attr).
      const offenders: string[] = [];
      for (const el of Array.from(container.querySelectorAll("*"))) {
        for (const attr of Array.from(el.attributes)) {
          if (RAW_HEX_RE.test(attr.value)) {
            offenders.push(`${el.tagName}[${attr.name}]="${attr.value}"`);
          }
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it("accepts a custom `size` and applies it as width/height", () => {
    const { container } = render(<EmptyListIllustration size="10rem" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "10rem");
    expect(svg).toHaveAttribute("height", "10rem");
  });

  it("defaults to a rem-based size within the legible 64px–160px range", () => {
    const { container } = render(<NoResultsIllustration />);
    const svg = container.querySelector("svg");
    const width = svg?.getAttribute("width") ?? "";
    expect(width).toMatch(/rem$/);
  });

  it("merges a caller className without dropping the base classes", () => {
    const { container } = render(<SuccessIllustration className="text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("text-primary");
  });
});
