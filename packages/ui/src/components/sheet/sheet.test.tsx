import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";

describe("SheetContent overflow", () => {
  it("scrolls tall content instead of overflowing the fixed panel", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
            <SheetDescription>Description</SheetDescription>
          </SheetHeader>
          Body
        </SheetContent>
      </Sheet>,
    );
    const content = screen.getByRole("dialog");
    // Without `overflow-y-auto`, content taller than the panel overflows the
    // fixed-position box and its bottom half is unreachable.
    expect(content.className).toContain("overflow-y-auto");
  });

  it("caps top/bottom sheets at a viewport-relative height so the scroll rule engages", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
            <SheetDescription>Description</SheetDescription>
          </SheetHeader>
          Body
        </SheetContent>
      </Sheet>,
    );
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("max-h-[90dvh]");
  });
});
