import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageShell } from "./page-shell";

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
});
