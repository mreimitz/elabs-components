import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmbientField } from "./ambient-field";

describe("AmbientField", () => {
  it("renders a decorative, token-coloured ground", () => {
    const { container } = render(<AmbientField className="opacity-90" />);
    const el = container.querySelector<HTMLElement>('[data-slot="ambient-field"]')!;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-drift");
    expect(el.className).toContain("opacity-90");
    expect(el.style.getPropertyValue("--ambient-a")).toBe("var(--primary)");
    expect(el.style.getPropertyValue("--ambient-b")).toBe("var(--chart-2)");
    expect(el.style.getPropertyValue("--ambient-c")).toBe("var(--surface-3)");
  });

  it("clamps alpha to 0.18 and exposes the tint API", () => {
    const { container } = render(
      <AmbientField alpha={0.5} stops={["chart-1", "chart-5"]} tint="warning" drift={false} />,
    );
    const el = container.querySelector<HTMLElement>('[data-slot="ambient-field"]')!;
    expect(el.style.getPropertyValue("--ambient-alpha")).toBe("0.18");
    expect(el.style.getPropertyValue("--ambient-c")).toBe("");
    expect(el).toHaveAttribute("data-ambient-tint", "warning");
    expect(el.style.getPropertyValue("--ambient-tint")).toBe("var(--warning)");
    expect(el).not.toHaveAttribute("data-drift");
  });
});
