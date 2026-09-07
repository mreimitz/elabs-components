/**
 * filter-chip.test.tsx — smoke + count-in-accessible-name lock (#221).
 *
 * `FilterChip` composes `@elabs-ai/components-ui`'s FilterChip; the contract worth
 * locking here is specific to the count feature this wrapper adds: the
 * formatted count reaches the VISIBLE text and the chip's ACCESSIBLE NAME
 * (WCAG 2.5.3), and removing one chip never touches its siblings.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChip } from "./filter-chip";

describe("FilterChip", () => {
  it("renders the bare label with no count", () => {
    render(<FilterChip label="Status: Failed" onRemove={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Remove filter: Status: Failed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Failed")).toBeInTheDocument();
  });

  it("renders 'excluded 1,204' (locale-formatted) alongside the label", () => {
    render(
      <FilterChip label="Status: Failed" count={1204} countLabel="excluded" onRemove={vi.fn()} />,
    );
    expect(screen.getByText("Status: Failed")).toBeInTheDocument();
    expect(screen.getByText("excluded 1,204")).toBeInTheDocument();
  });

  it("folds the count into the chip's ACCESSIBLE NAME, not only its visible text", () => {
    render(
      <FilterChip label="Status: Failed" count={1204} countLabel="excluded" onRemove={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "Remove filter: Status: Failed · excluded 1,204" }),
    ).toBeInTheDocument();
  });

  it("renders a bare formatted count with no countLabel", () => {
    render(<FilterChip label="Status: Failed" count={1204} onRemove={vi.fn()} />);
    expect(screen.getByText("Status: Failed")).toBeInTheDocument();
    expect(screen.getByText("1,204")).toBeInTheDocument();
  });

  it("fires onRemove for the clicked chip only, leaving sibling chips untouched", async () => {
    const user = userEvent.setup();
    const removeFirst = vi.fn();
    const removeSecond = vi.fn();
    render(
      <>
        <FilterChip label="Status: Failed" onRemove={removeFirst} />
        <FilterChip label="Region: EU" onRemove={removeSecond} />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Remove filter: Status: Failed" }));
    expect(removeFirst).toHaveBeenCalledTimes(1);
    expect(removeSecond).not.toHaveBeenCalled();
  });

  it("merges a caller className onto the root", () => {
    render(<FilterChip label="Status: Failed" onRemove={vi.fn()} className="extra" />);
    expect(screen.getByRole("button")).toHaveClass("extra");
  });

  it("keeps the count in a non-shrinking element so truncation can only reach the label", () => {
    const { container } = render(
      <FilterChip
        label="Status: Awaiting downstream reconciliation review"
        count={1204}
        countLabel="excluded"
        onRemove={vi.fn()}
      />,
    );
    const truncating = container.querySelector('[class*="truncate"]');
    expect(truncating).not.toBeNull();
    expect(truncating).toHaveTextContent("Status: Awaiting downstream reconciliation review");
    expect(truncating?.textContent).toBe("Status: Awaiting downstream reconciliation review");

    // The count lives in its own, sibling element — never inside the truncating one.
    const count = screen.getByText("excluded 1,204");
    expect(count).not.toBe(truncating);
    expect(truncating?.contains(count)).toBe(false);
  });

  // Runtime lock (PR #408 review round 2): `Omit<BaseFilterChipProps, "trailing">`
  // only stops a `trailing` prop written as an object LITERAL — TypeScript's
  // excess-property check does not apply to a spread of an already-declared
  // variable, so a typed caller can still get `trailing` into `props` this
  // way and have it win at render. This must hold at runtime regardless of
  // what the type system caught.
  it("keeps the derived count even when a caller spreads a `trailing` override through a variable", () => {
    const hijack = { trailing: "hijacked" } as { trailing: string };
    render(
      <FilterChip
        label="Status: Failed"
        count={1204}
        countLabel="excluded"
        onRemove={vi.fn()}
        {...hijack}
      />,
    );
    expect(screen.getByText("excluded 1,204")).toBeInTheDocument();
    expect(screen.queryByText("hijacked")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: Status: Failed · excluded 1,204" }),
    ).toBeInTheDocument();
  });

  // Type-level lock, same shape as ContextRail's `children` omission
  // (context-rail.test.tsx #15): `FilterChipProps` is re-derived from the
  // base package's `BaseFilterChipProps` and must omit `trailing` alongside
  // `label`. The wrapper computes its OWN `trailing` from `count`/
  // `countLabel` and strips any caller-supplied `trailing` from `props` at
  // RUNTIME before forwarding to the base component, so a caller-supplied
  // `trailing` — whether it type-checks as an object literal (it doesn't,
  // thanks to this Omit) or slips through a spread of an already-declared
  // variable (it does; see the runtime lock above) — can never win at
  // render. Fails to typecheck the moment `trailing` is dropped from the
  // `Omit`.
  it("(type-level) does not accept a `trailing` prop", () => {
    function typeOnly() {
      return (
        <FilterChip
          label="Status: Failed"
          count={1204}
          // @ts-expect-error — `trailing` is omitted from `FilterChipProps`;
          // the wrapper derives its own `trailing` from `count`/`countLabel`
          // and must not let a caller override it.
          trailing="hijacked"
          onRemove={vi.fn()}
        />
      );
    }
    expect(typeof typeOnly).toBe("function");
  });
});
