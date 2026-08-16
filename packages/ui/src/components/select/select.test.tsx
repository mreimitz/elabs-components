import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Select, SelectTrigger, SelectValue } from "./select";

const LONG_LABEL = "prod-eu-west-1 · 2026-08-01 · 12 tools";

/**
 * jsdom has no layout: every element reports `scrollWidth`/`clientWidth` 0, so
 * nothing is ever "clipped" there. Fake the one measurement the component
 * makes so the clipped branch is exercisable in a unit test; the real-layout
 * behaviour is covered by the `ClippedValueGetsTitle` Storybook story.
 */
function fakeClippedLayout() {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => 400,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 100,
  });
}

afterEach(() => {
  // Restore jsdom's own getters (they live on the Element.prototype below).
  Reflect.deleteProperty(HTMLElement.prototype, "scrollWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
});

describe("SelectTrigger", () => {
  it("sets no title while the rendered text fits (an unconditional title names the field after its own value)", async () => {
    render(
      <Select>
        <SelectTrigger aria-label="Environment">
          <SelectValue placeholder={LONG_LABEL} />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    // Let the mount effect and its observers run before asserting the absence.
    await waitFor(() => expect(trigger).toHaveAttribute("data-size", "default"));
    expect(trigger).not.toHaveAttribute("title");
  });

  it("auto-sets title from the rendered text once that text is clipped", async () => {
    fakeClippedLayout();
    render(
      <Select>
        <SelectTrigger aria-label="Environment">
          <SelectValue placeholder={LONG_LABEL} />
        </SelectTrigger>
      </Select>,
    );
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveAttribute("title", LONG_LABEL));
  });

  it("separates composed trigger content instead of concatenating it", async () => {
    fakeClippedLayout();
    render(
      <Select>
        <SelectTrigger aria-label="Environment">
          <span>Env:</span>
          <SelectValue placeholder="Staging" />
        </SelectTrigger>
      </Select>,
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveAttribute("title", "Env: Staging"),
    );
  });

  it("never overrides a caller-supplied title", async () => {
    fakeClippedLayout();
    render(
      <Select>
        <SelectTrigger title="Custom title" aria-label="Environment">
          <SelectValue placeholder="Environment" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    await waitFor(() => expect(trigger).toHaveAttribute("title", "Custom title"));
  });

  it("sets no title when autoTitle is disabled, even while clipped", async () => {
    fakeClippedLayout();
    render(
      <Select>
        <SelectTrigger autoTitle={false} aria-label="Environment">
          <SelectValue placeholder={LONG_LABEL} />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    await waitFor(() => expect(trigger).toHaveAttribute("data-size", "default"));
    expect(trigger).not.toHaveAttribute("title");
  });
});
