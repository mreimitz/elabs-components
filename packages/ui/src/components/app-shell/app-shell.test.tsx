import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("forwards a ref to the root element", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AppShell ref={ref} mainId="main">
        Content
      </AppShell>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    // The forwarded node IS the shell root — the flex/overflow box that
    // establishes the fixed-height viewport, not some inner wrapper.
    expect(ref.current?.className).toContain("h-dvh");
  });
});
