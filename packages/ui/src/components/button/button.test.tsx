import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nope" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  // #194: `outline-subtle` targets `border-border`, `outline` targets the form-field
  // `border-input`. Since the ADR 0010 Amendment (2026-06-20) returned `--input` to the
  // subtle rung these two render identically by default, but the class STRINGS stay
  // distinct (a semantic seam a brand could re-separate). This locks the class target,
  // not the resting contrast.
  it("outline-subtle uses border-border, not the form-field border-input", () => {
    render(<Button variant="outline-subtle">Quiet</Button>);
    const btn = screen.getByRole("button", { name: "Quiet" });
    expect(btn.className.split(" ")).toContain("border-border");
    expect(btn.className.split(" ")).not.toContain("border-input");
  });

  it("renders as a child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/home">Home</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
  });
});
