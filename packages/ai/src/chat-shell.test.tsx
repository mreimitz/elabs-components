/**
 * chat-shell.test.tsx — smoke + layout-contract lock for the chat frame (#59).
 *
 * ChatShell is the outermost container of every chat surface in the library, and
 * until #59 it had no test at all — its only coverage was inside stories. The
 * contract worth locking is structural: the four slots render where the caller
 * expects them and in transcript order; an unsupplied slot is OMITTED rather
 * than rendered empty (an empty header would still reserve its 3rem row); and
 * the `bare` variant's edge scrims are inert — `aria-hidden` AND
 * `pointer-events-none`, or an immersive pane would silently eat taps at the top
 * and bottom of its own transcript.
 *
 * Nothing here is mocked: the assertions run against the real component as it
 * ships (the #34/#46 lesson — a stand-in that happens to honour an aria
 * attribute proves nothing about the shipped surface).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatShell } from "./chat-shell";

describe("ChatShell — slots", () => {
  it("renders the transcript children", () => {
    render(
      <ChatShell>
        <p>transcript</p>
      </ChatShell>,
    );
    expect(screen.getByText("transcript")).toBeInTheDocument();
  });

  it("renders header, transcript, composer and aside together", () => {
    render(
      <ChatShell
        header={<h2>Assistant</h2>}
        composer={<textarea aria-label="Message" />}
        aside={<nav aria-label="Sources" />}
      >
        <p>transcript</p>
      </ChatShell>,
    );
    expect(screen.getByRole("heading", { name: "Assistant" })).toBeInTheDocument();
    expect(screen.getByText("transcript")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sources" })).toBeInTheDocument();
  });

  it("puts the composer AFTER the transcript in DOM order (tab order follows reading order)", () => {
    render(
      <ChatShell composer={<textarea aria-label="Message" />}>
        <p>transcript</p>
      </ChatShell>,
    );
    const transcript = screen.getByText("transcript");
    const composer = screen.getByRole("textbox", { name: "Message" });
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(transcript.compareDocumentPosition(composer) & 4).toBeTruthy();
  });

  it("omits the header row entirely when no header is supplied", () => {
    const { container } = render(<ChatShell>t</ChatShell>);
    // An empty header would still occupy its fixed h-12 row.
    expect(container.querySelector(".h-12")).toBeNull();
  });

  it("omits the aside rail entirely when no aside is supplied", () => {
    const { container } = render(<ChatShell>t</ChatShell>);
    expect(container.querySelector(".w-80")).toBeNull();
  });
});

describe("ChatShell — variants", () => {
  it("frames itself as a card by default", () => {
    const { container } = render(<ChatShell>t</ChatShell>);
    expect(container.firstChild).toHaveClass("rounded-xl");
    expect(container.firstChild).toHaveClass("border");
  });

  it("drops the frame in the bare variant (no second box inside a bounded region)", () => {
    const { container } = render(<ChatShell variant="bare">t</ChatShell>);
    expect(container.firstChild).not.toHaveClass("rounded-xl");
    expect(container.firstChild).not.toHaveClass("border");
  });

  it("drops the header/composer dividers in the bare variant", () => {
    const { container } = render(
      <ChatShell variant="bare" header={<span>h</span>} composer={<span>c</span>}>
        t
      </ChatShell>,
    );
    expect(container.querySelector(".border-b")).toBeNull();
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("makes the bare variant's edge scrims inert (aria-hidden AND pointer-events-none)", () => {
    const { container } = render(<ChatShell variant="bare">t</ChatShell>);
    const scrims = container.querySelectorAll("[aria-hidden='true']");
    expect(scrims).toHaveLength(2);
    for (const scrim of scrims) expect(scrim).toHaveClass("pointer-events-none");
  });

  it("renders no scrims in the card variant (there is a real divider instead)", () => {
    const { container } = render(<ChatShell>t</ChatShell>);
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
  });
});

describe("ChatShell — composability", () => {
  it("merges a caller className without dropping the fill-parent layout", () => {
    const { container } = render(<ChatShell className="extra">t</ChatShell>);
    expect(container.firstChild).toHaveClass("extra");
    expect(container.firstChild).toHaveClass("h-full");
  });
});
