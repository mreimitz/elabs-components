import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogSection,
  DialogTitle,
  DialogDescription,
} from "./dialog";
import { Label } from "../label";

function Wrapper({ size }: { size?: "sm" | "lg" | "xl" | "full" }) {
  return (
    <Dialog open>
      <DialogContent size={size}>
        <DialogTitle>Test dialog</DialogTitle>
        <DialogDescription>Test description</DialogDescription>
        Content
      </DialogContent>
    </Dialog>
  );
}

describe("DialogContent size variants", () => {
  it("default (no size prop) renders max-w-lg — regression lock", () => {
    render(<Wrapper />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("max-w-lg");
  });

  it("size='lg' renders max-w-lg", () => {
    render(<Wrapper size="lg" />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("max-w-lg");
  });

  it("size='sm' renders max-w-sm", () => {
    render(<Wrapper size="sm" />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("max-w-sm");
  });

  it("size='xl' renders max-w-3xl", () => {
    render(<Wrapper size="xl" />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("max-w-3xl");
  });

  it("size='full' renders max-w-[95vw] and h-[90vh]", () => {
    render(<Wrapper size="full" />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("max-w-[95vw]");
    expect(content.className).toContain("h-[90vh]");
  });
});

describe("DialogContent grid overflow guard (regression)", () => {
  // The grid that lays out DialogContent's children must use a
  // `minmax(0,1fr)` column, not the implicit `auto` column. Without the floor,
  // a grid item's default `min-width:auto` lets a `truncate`/`nowrap` child or a
  // long unbreakable token set the column's min-content size and push the dialog
  // past its `max-w-*`. jsdom can't measure layout, so this locks the class that
  // prevents it; the visual proof is the `OverflowGuard` Storybook story.
  it("renders a minmax(0,1fr) grid column so truncate children can shrink", () => {
    render(<Wrapper />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("grid-cols-[minmax(0,1fr)]");
    expect(content.className).toContain("grid");
  });

  it("keeps the minmax column on every size variant", () => {
    for (const size of ["sm", "lg", "xl", "full"] as const) {
      const { unmount } = render(<Wrapper size={size} />);
      expect(screen.getByRole("dialog").className).toContain("grid-cols-[minmax(0,1fr)]");
      unmount();
    }
  });
});

describe("DialogContent height/scroll regime (#341)", () => {
  // jsdom does NO layout, so these are CLASS assertions and nothing more — they
  // lock the contract that produces the behaviour. The behaviour itself (header
  // and footer fixed, body scrolling, at a short viewport) is proven in the
  // `WideWithSections` / `ShortViewport` stories, which run in a real browser.
  it("caps at the viewport and scrolls itself when no DialogBody is present", () => {
    render(<Wrapper />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(content.className).toContain("overflow-y-auto");
  });

  it("hands scroll to the body via a has-[] variant (inert without one)", () => {
    render(<Wrapper />);
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("has-[[data-slot=dialog-body]]:overflow-hidden");
    expect(content.className).toContain(
      "has-[[data-slot=dialog-body]]:grid-rows-[auto_minmax(0,1fr)_auto]",
    );
  });

  it("size='full' keeps its own overflow/height after the merge", () => {
    render(<Wrapper size="full" />);
    const content = screen.getByRole("dialog");
    // tailwind-merge resolves the base `overflow-y-auto` away in favour of the
    // later variant utility, so `full` still lets its body own the scroll.
    expect(content.className).toContain("overflow-hidden");
    expect(content.className).not.toContain("overflow-y-auto");
    expect(content.className).toContain("max-h-[90vh]");
    expect(content.className).not.toContain("max-h-[calc(100dvh-2rem)]");
  });
});

describe("DialogBody", () => {
  it("declares the dialog-body slot and owns the scroll", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
          <DialogBody>Body</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    const body = screen.getByText("Body");
    expect(body.getAttribute("data-slot")).toBe("dialog-body");
    expect(body.className).toContain("overflow-y-auto");
    expect(body.className).toContain("min-h-0");
    // Scroll must not chain to the page behind the overlay.
    expect(body.className).toContain("overscroll-contain");
    // Focus-ring gutter (#425): `p-1`/`-m-1`/`scroll-p-1` reserve 4px of
    // scrollport padding so an outward `box-shadow` ring on a flush child is
    // not clipped, then pull the border box back so body content stays flush
    // with the header/footer. jsdom performs no layout and no paint, so this
    // can only assert the classes are DECLARED — it can never observe a
    // `box-shadow` actually being clipped (or not). Its job is to stop a
    // future "tidy the class string" edit from silently deleting the trio;
    // the real geometric proof is the `FocusRingClearance` story, run in a
    // real browser via `@storybook/addon-vitest`.
    expect(body.className).toContain("p-1");
    expect(body.className).toContain("-m-1");
    expect(body.className).toContain("scroll-p-1");
  });

  it("is keyboard-operable by default and lets a caller opt out", () => {
    const { rerender } = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
          <DialogBody>Body</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Body")).toHaveAttribute("tabindex", "0");

    rerender(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
          <DialogBody tabIndex={-1}>Body</DialogBody>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Body")).toHaveAttribute("tabindex", "-1");
  });
});

describe("DialogBody opening focus", () => {
  function Wrapped({ withBody }: { withBody: boolean }) {
    const fields = (
      <>
        <label htmlFor="first">First</label>
        <input id="first" />
      </>
    );
    return (
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
          {withBody ? <DialogBody>{fields}</DialogBody> : fields}
        </DialogContent>
      </Dialog>
    );
  }

  // The body takes a tab stop so it can be scrolled from the keyboard; it must
  // NOT therefore become the dialog's opening focus target — that would ring the
  // whole scroll region on open and skip the first field.
  it("skips the scroll wrapper and opens on the first real control", async () => {
    render(<Wrapped withBody />);
    const input = screen.getByLabelText("First");
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(document.activeElement).not.toBe(screen.getByText("First").closest("div"));
  });

  it("leaves a body-less dialog's focus behaviour untouched", async () => {
    render(<Wrapped withBody={false} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("First")));
  });

  // A body with nothing focusable in it must fall back to Radix, which focuses
  // the body — the right target for a text-only scroll region. Reaching past it
  // to the footer would open the dialog with the keyboard on the PRIMARY action.
  it("leaves a control-less body to Radix, which focuses the scroll region", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
          <DialogBody>Nothing focusable in here.</DialogBody>
          <button type="button">Save</button>
        </DialogContent>
      </Dialog>,
    );
    const body = screen.getByText("Nothing focusable in here.");
    await waitFor(() => expect(document.activeElement).toBe(body));
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Save" }));
  });

  // A candidate that matches the selector but cannot take focus (a `hidden` file
  // input is the everyday case) must not consume the redirect: preventing
  // Radix's default for it strands focus on the TRIGGER, outside the modal.
  // NOT assertable here — jsdom does no layout and happily focuses a `hidden`
  // input — so the lock is the `HiddenFirstControl` story, which runs in a real
  // browser under `test-storybook`.
});

describe("DialogSection", () => {
  function SectionWrapper() {
    return (
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
          <DialogSection title="Retention" description="How long runs are kept.">
            <Label htmlFor="days">Days to keep</Label>
          </DialogSection>
        </DialogContent>
      </Dialog>
    );
  }

  it("renders a real heading one level below DialogTitle", () => {
    render(<SectionWrapper />);
    const heading = screen.getByRole("heading", { name: "Retention" });
    expect(heading.tagName).toBe("H3");
    expect(heading.getAttribute("data-slot")).toBe("dialog-section-title");
  });

  it("renders the section title one type ROLE above a field label", () => {
    render(<SectionWrapper />);
    const heading = screen.getByRole("heading", { name: "Retention" });
    const label = screen.getByText("Days to keep");
    // The rungs must differ: section = `subtitle` (1rem), label = body (0.875rem).
    // jsdom applies no stylesheet, so this asserts the ROLE; the rendered pixel
    // sizes are compared with getComputedStyle in the `WideWithSections` story.
    expect(heading.className).toContain("text-subtitle");
    expect(label.className).not.toContain("text-subtitle");
  });

  it("accepts a deeper level and slots its description and actions", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
          <DialogSection
            level={4}
            title="Retention"
            description="How long runs are kept."
            actions={<button type="button">Reset</button>}
          />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("heading", { name: "Retention" }).tagName).toBe("H4");
    expect(screen.getByText("How long runs are kept.").getAttribute("data-slot")).toBe(
      "dialog-section-description",
    );
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});
