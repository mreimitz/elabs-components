import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageShell } from "./page-shell";

/** True if any element in the tree carries a `min-h-*` utility class. */
function hasAnyMinHeightClass(root: HTMLElement): boolean {
  const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  return all.some((el) => /(^|\s)min-h-\S/.test(el.className));
}

const HEADER_VARIANTS = [undefined, "default", "toolbar"] as const;
const WIDTHS = [undefined, "md", "lg", "xl", "full"] as const;
const HEADERS = [false, true] as const;

describe("PageShell", () => {
  it("headerVariant omitted: renders the header inline with no sticky wrapper (AC2 — byte-identical default)", () => {
    render(<PageShell header={<div data-testid="hdr">H</div>}>body</PageShell>);

    const header = screen.getByTestId("hdr");
    expect(screen.queryByTestId("page-shell-toolbar-header")).toBeNull();
    expect(document.querySelector('[data-slot="page-shell-toolbar-header"]')).toBeNull();

    let node: HTMLElement | null = header;
    while (node) {
      expect(node.className).not.toMatch(/(^|\s)sticky(\s|$)/);
      node = node.parentElement;
    }
  });

  it('headerVariant="default": same as omitted — no sticky wrapper', () => {
    render(
      <PageShell header={<div data-testid="hdr">H</div>} headerVariant="default">
        body
      </PageShell>,
    );

    expect(document.querySelector('[data-slot="page-shell-toolbar-header"]')).toBeNull();
  });

  it('headerVariant="toolbar": wraps the header in a sticky, bordered, blurred bar', () => {
    render(
      <PageShell header={<div data-testid="hdr">H</div>} headerVariant="toolbar">
        body
      </PageShell>,
    );

    const wrapper = document.querySelector('[data-slot="page-shell-toolbar-header"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toContainElement(screen.getByTestId("hdr"));

    const className = (wrapper as HTMLElement).className;
    expect(className).toMatch(/(^|\s)sticky(\s|$)/);
    expect(className).toContain("top-0");
    expect(className).toContain("border-b");
    expect(className).toContain("bg-background/95");

    // Regression guard for ViewToolbar's R7 (wrap, never clip/fixed-height).
    expect(className).not.toMatch(/(^|\s)h-\d/);
    expect(className).not.toMatch(/overflow-hidden/);
  });

  it('headerVariant="toolbar" with no header prop: renders nothing, no empty sticky bar', () => {
    render(<PageShell headerVariant="toolbar">body</PageShell>);

    expect(document.querySelector('[data-slot="page-shell-toolbar-header"]')).toBeNull();
  });

  describe("component-API baseline (forwardRef, spread, data-slot)", () => {
    it("forwards a ref to the root element", () => {
      const ref = createRef<HTMLDivElement>();
      const { container } = render(<PageShell ref={ref}>body</PageShell>);

      expect(ref.current).not.toBeNull();
      expect(ref.current).toBe(container.firstElementChild);
    });

    it("spreads extra DOM props (id, data-testid, aria-label) onto the root", () => {
      render(
        <PageShell id="my-page" data-testid="ps-root" aria-label="Runs">
          body
        </PageShell>,
      );

      const root = screen.getByTestId("ps-root");
      expect(root.id).toBe("my-page");
      expect(root.getAttribute("aria-label")).toBe("Runs");
    });

    it('carries data-slot="page-shell" on the root and "page-shell-content" on the inner column', () => {
      const { container } = render(<PageShell>body</PageShell>);
      const root = container.firstElementChild as HTMLElement;

      expect(root.getAttribute("data-slot")).toBe("page-shell");
      expect(root.querySelector('[data-slot="page-shell-content"]')).not.toBeNull();
    });
  });

  describe('scroll="body" (default) — byte-identical to pre-R6, across every header/headerVariant/width combination', () => {
    for (const headerVariant of HEADER_VARIANTS) {
      for (const width of WIDTHS) {
        for (const withHeader of HEADERS) {
          const label = `header=${withHeader} headerVariant=${headerVariant ?? "(unset)"} width=${width ?? "(unset)"}`;

          it(`root class is exactly the pre-R6 literal, no min-h-* anywhere, no gutter row — ${label}`, () => {
            const { container } = render(
              <PageShell
                header={withHeader ? <div data-testid="hdr">H</div> : undefined}
                headerVariant={headerVariant}
                width={width}
              >
                body
              </PageShell>,
            );
            const root = container.firstElementChild as HTMLElement;

            // (1) The additive default: root's own class string is unchanged, whatever
            // the header/headerVariant/width combination — those axes never touch it.
            expect(root.className).toBe("w-full px-4 py-6 sm:px-6 lg:px-8");

            // (2) No min-h-* class anywhere in the tree — the gutter mechanism is
            // entirely absent, not merely invisible.
            expect(hasAnyMinHeightClass(root)).toBe(false);

            // (3) No gutter row — `headerGutter: false` must not produce the empty
            // reserved row ADR 0035 calls "the whole mechanism".
            expect(root.querySelector('[data-slot="page-shell-header"]')).toBeNull();

            // (4) The header itself renders exactly where it always did.
            if (withHeader) {
              const hdr = screen.getByTestId("hdr");
              if (headerVariant === "toolbar") {
                const toolbarWrapper = root.querySelector(
                  '[data-slot="page-shell-toolbar-header"]',
                );
                expect(toolbarWrapper).not.toBeNull();
                expect(toolbarWrapper).toContainElement(hdr);
              } else {
                expect(root.querySelector('[data-slot="page-shell-toolbar-header"]')).toBeNull();
              }
            }
          });
        }
      }
    }

    it('passing scroll="body" explicitly is identical to omitting it', () => {
      const { container: withProp } = render(<PageShell scroll="body">body</PageShell>);
      const { container: omitted } = render(<PageShell>body</PageShell>);

      expect((withProp.firstElementChild as HTMLElement).className).toBe(
        (omitted.firstElementChild as HTMLElement).className,
      );
    });
  });

  describe("scroll modes", () => {
    it('scroll="content" makes the inner column the scroll container', () => {
      const { container } = render(<PageShell scroll="content">body</PageShell>);
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain("min-h-0");
      expect(root.className).toContain("flex-1");
      expect(root.className).toContain("overflow-y-auto");
      // The base padding/width classes are still present — additive, not a replacement.
      expect(root.className).toContain("w-full");
    });

    it('scroll="fill" fills its parent and does not scroll itself', () => {
      const { container } = render(<PageShell scroll="fill">body</PageShell>);
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain("h-full");
      expect(root.className).toContain("overflow-hidden");
    });

    it("a caller className can still override a scroll-mode utility (className merges last)", () => {
      const { container } = render(
        <PageShell scroll="fill" className="overflow-visible">
          body
        </PageShell>,
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain("overflow-visible");
      expect(root.className).not.toContain("overflow-hidden");
    });

    it('scroll="content" defaults to keyboard-operable (WCAG 2.1.1 / axe scrollable-region-focusable)', () => {
      const { container } = render(<PageShell scroll="content">body</PageShell>);
      const root = container.firstElementChild as HTMLElement;
      // `getAttribute`, never the `tabIndex` IDL getter: that getter answers a
      // DEFAULT (-1 here, 0 for natively focusable elements) whether or not the
      // attribute was ever written, so `expect(root.tabIndex).toBe(-1)` and the
      // "gains no tab stop" cases below would pass on a component that emits
      // nothing at all.
      expect(root.getAttribute("tabindex")).toBe("0");
      // `classList.contains` is an EXACT token match. `toContain("focus-ring")`
      // is a substring test that `focus-ring-inset` satisfies, so it could not
      // tell the two rungs apart — it passed before this fix and would pass
      // after it, proving nothing either way.
      expect(root.classList.contains("focus-ring-inset")).toBe(true);
      // The plain rung must be ABSENT, not merely accompanied: both of its
      // layers are drawn outside the element's box, and `scroll="content"`'s
      // own doc sends callers to put this inside a `SidebarInset`, whose
      // `overflow-hidden` clips exactly that.
      expect(root.classList.contains("focus-ring")).toBe(false);
    });

    it('scroll="content" lets a caller opt out of the default tab stop', () => {
      const { container } = render(
        <PageShell scroll="content" tabIndex={-1}>
          body
        </PageShell>,
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute("tabindex")).toBe("-1");
    });

    it('scroll="fill" does not gain a default tab stop — the child scroll region owns it', () => {
      const { container } = render(<PageShell scroll="fill">body</PageShell>);
      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute("tabindex")).toBeNull();
      expect(root.classList.contains("focus-ring")).toBe(false);
      expect(root.classList.contains("focus-ring-inset")).toBe(false);
    });

    it('scroll="body" (default) gains no tabIndex attribute — byte-identical', () => {
      const { container } = render(<PageShell>body</PageShell>);
      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute("tabindex")).toBeNull();
    });
  });

  describe("headerGutter", () => {
    it("reserves a fixed header row so titles land at one coordinate, when a header is present", () => {
      render(
        <PageShell headerGutter header={<h1>Runs</h1>}>
          body
        </PageShell>,
      );
      const gutter = screen.getByText("Runs").closest('[data-slot="page-shell-header"]');
      expect(gutter).not.toBeNull();
      expect((gutter as HTMLElement).className).toContain("min-h-(--page-shell-header-gutter)");
    });

    it("renders the reserved row even when NO header is supplied — the empty row IS the mechanism (ADR 0035)", () => {
      const { container } = render(<PageShell headerGutter>body</PageShell>);
      const root = container.firstElementChild as HTMLElement;

      const gutter = root.querySelector('[data-slot="page-shell-header"]');
      expect(gutter).not.toBeNull();
      expect((gutter as HTMLElement).className).toContain("min-h-(--page-shell-header-gutter)");
      // It really is empty — no header content leaked in.
      expect((gutter as HTMLElement).textContent).toBe("");
    });

    it("declares the --page-shell-header-gutter default (--spacing(12)) on the root when on", () => {
      const { container } = render(<PageShell headerGutter>body</PageShell>);
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain("[--page-shell-header-gutter:--spacing(12)]");
    });

    it("is retunable per surface: a caller className overrides the default gutter height", () => {
      const { container } = render(
        <PageShell headerGutter className="[--page-shell-header-gutter:--spacing(16)]">
          body
        </PageShell>,
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain("[--page-shell-header-gutter:--spacing(16)]");
      expect(root.className).not.toContain("--spacing(12)");
    });

    it('composes with headerVariant="toolbar": the sticky bar nests inside the reserved row', () => {
      render(
        <PageShell headerGutter headerVariant="toolbar" header={<div data-testid="hdr">H</div>}>
          body
        </PageShell>,
      );
      const gutter = document.querySelector('[data-slot="page-shell-header"]');
      const toolbar = document.querySelector('[data-slot="page-shell-toolbar-header"]');
      expect(gutter).not.toBeNull();
      expect(toolbar).not.toBeNull();
      expect(gutter).toContainElement(toolbar as HTMLElement);
      expect(toolbar).toContainElement(screen.getByTestId("hdr"));
    });
  });
});
