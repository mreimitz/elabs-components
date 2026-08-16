import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Slider, type SliderThumbProps } from "./slider";

describe("Slider", () => {
  it("forwards aria-label to the thumb (role=slider)", () => {
    render(<Slider aria-label="Volume" defaultValue={[50]} max={100} step={1} />);
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
  });

  it("forwards the top-level aria-valuetext to the thumb", () => {
    render(
      <Slider
        aria-label="Replay position"
        aria-valuetext="step 3 of 12"
        defaultValue={[3]}
        max={12}
        step={1}
      />,
    );
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "step 3 of 12");
  });

  it("forwards thumbProps.aria-valuetext to the thumb", () => {
    render(
      <Slider
        aria-label="Replay position"
        defaultValue={[3]}
        max={12}
        step={1}
        thumbProps={{ "aria-valuetext": "step 3 of 12" }}
      />,
    );
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "step 3 of 12");
  });

  it("thumbProps wins over the top-level aria-label when both are set", () => {
    render(
      <Slider
        aria-label="Root label"
        defaultValue={[3]}
        max={12}
        step={1}
        thumbProps={{ "aria-label": "Thumb label" }}
      />,
    );
    expect(screen.getByRole("slider", { name: "Thumb label" })).toBeInTheDocument();
  });

  it("does not regress existing aria-labelledby forwarding", () => {
    render(
      <>
        <label id="vol-label">Volume</label>
        <Slider aria-labelledby="vol-label" defaultValue={[50]} max={100} step={1} />
      </>,
    );
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
  });

  // Radix spreads consumer thumb props AFTER its own role/value/tabIndex, so
  // an unfiltered escape hatch lets a consumer destroy the widget.
  it("ignores thumbProps keys that would break the slider widget", () => {
    render(
      <Slider
        aria-label="Volume"
        defaultValue={[50]}
        max={100}
        step={1}
        thumbProps={{
          role: "presentation",
          "aria-valuenow": 999,
          "aria-valuemin": 999,
          "aria-valuemax": 999,
          "aria-orientation": "vertical",
          tabIndex: -1,
          id: "volume-thumb",
        }}
      />,
    );
    const thumb = screen.getByRole("slider", { name: "Volume" });
    expect(thumb).toHaveAttribute("aria-valuenow", "50");
    expect(thumb).toHaveAttribute("aria-valuemin", "0");
    expect(thumb).toHaveAttribute("aria-valuemax", "100");
    expect(thumb).toHaveAttribute("aria-orientation", "horizontal");
    expect(thumb).toHaveAttribute("tabindex", "0");
    // Non-protected keys still pass through.
    expect(thumb).toHaveAttribute("id", "volume-thumb");
  });

  // #398 — a range slider (array value) renders one thumb per value, and a
  // matching array of thumbProps gives each one its own accessible name.
  describe("range (multi-thumb) support", () => {
    it("renders one thumb per value in a range slider", () => {
      render(<Slider aria-label="Price range" defaultValue={[3, 9]} max={12} step={1} />);
      expect(screen.getAllByRole("slider")).toHaveLength(2);
    });

    it("gives each thumb its own aria-valuetext via an array of thumbProps", () => {
      render(
        <Slider
          defaultValue={[3, 9]}
          max={12}
          step={1}
          thumbProps={[
            { "aria-label": "Minimum price", "aria-valuetext": "$3" },
            { "aria-label": "Maximum price", "aria-valuetext": "$9" },
          ]}
        />,
      );
      const [low, high] = screen.getAllByRole("slider");
      expect(low).toHaveAttribute("aria-valuetext", "$3");
      expect(low).toHaveAttribute("aria-label", "Minimum price");
      expect(high).toHaveAttribute("aria-valuetext", "$9");
      expect(high).toHaveAttribute("aria-label", "Maximum price");
    });

    it("gives each thumb its own data-* attributes via an array of thumbProps", () => {
      render(
        <Slider
          aria-label="Price range"
          defaultValue={[3, 9]}
          max={12}
          step={1}
          thumbProps={[
            { "data-thumb": "min" } as SliderThumbProps,
            { "data-thumb": "max" } as SliderThumbProps,
          ]}
        />,
      );
      const [low, high] = screen.getAllByRole("slider");
      expect(low).toHaveAttribute("data-thumb", "min");
      expect(high).toHaveAttribute("data-thumb", "max");
    });

    it("still supports a single-element defaultValue with the existing object thumbProps shape", () => {
      render(
        <Slider
          aria-label="Volume"
          defaultValue={[50]}
          max={100}
          step={1}
          thumbProps={{ "aria-valuetext": "50%" }}
        />,
      );
      expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute(
        "aria-valuetext",
        "50%",
      );
    });

    it("applies PROTECTED_THUMB_KEYS stripping per-thumb in the array shape", () => {
      render(
        <Slider
          defaultValue={[3, 9]}
          max={12}
          step={1}
          thumbProps={[
            { "aria-label": "Min", role: "presentation", tabIndex: -1 },
            { "aria-label": "Max", "aria-valuenow": 999 },
          ]}
        />,
      );
      const [low, high] = screen.getAllByRole("slider");
      expect(low).toHaveAttribute("tabindex", "0");
      expect(high).toHaveAttribute("aria-valuenow", "9");
    });
  });
});
