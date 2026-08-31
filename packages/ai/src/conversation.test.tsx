/**
 * conversation.test.tsx — smoke + a11y/serialization lock for the transcript (#59).
 *
 * `Conversation` is the scroll container every chat message renders into. Two
 * things must not regress: the container keeps `role="log"` (an incrementally
 * updated region — this is what makes a streaming transcript announceable at
 * all), and `messagesToMarkdown` — the download path's serializer — flattens
 * `UIMessage.parts` correctly, since a broken export silently ships an empty or
 * mangled file rather than throwing.
 *
 * Nothing is mocked: the real `StickToBottom`-backed component is rendered.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  messagesToMarkdown,
} from "./conversation";

const messages: UIMessage[] = [
  { id: "1", role: "user", parts: [{ type: "text", text: "What changed?" }] },
  {
    id: "2",
    role: "assistant",
    parts: [
      { type: "text", text: "Three services shipped." },
      { type: "text", text: " Billing is degraded." },
    ],
  },
];

describe("Conversation — transcript region", () => {
  it('exposes the transcript as role="log" (an incrementally updated region)', () => {
    render(
      <Conversation>
        <ConversationContent>
          <p>hello</p>
        </ConversationContent>
      </Conversation>,
    );
    expect(screen.getByRole("log")).toBeInTheDocument();
  });

  it("renders its children inside the log, in order", () => {
    render(
      <Conversation>
        <ConversationContent>
          <p>first</p>
          <p>second</p>
        </ConversationContent>
      </Conversation>,
    );
    const log = screen.getByRole("log");
    expect(log).toHaveTextContent("first");
    expect(log).toHaveTextContent("second");
    const [first, second] = [screen.getByText("first"), screen.getByText("second")];
    expect(first.compareDocumentPosition(second) & 4).toBeTruthy();
  });

  it("merges a caller className without dropping the flex-fill layout", () => {
    render(
      <Conversation className="extra">
        <ConversationContent>x</ConversationContent>
      </Conversation>,
    );
    expect(screen.getByRole("log")).toHaveClass("extra");
    expect(screen.getByRole("log")).toHaveClass("flex-1");
  });
});

describe("ConversationEmptyState", () => {
  it("renders a real empty state by default, not a blank region", () => {
    render(<ConversationEmptyState />);
    expect(screen.getByRole("heading", { name: "No messages yet" })).toBeInTheDocument();
    expect(screen.getByText("Start a conversation to see messages here")).toBeInTheDocument();
  });

  it("accepts an overriding title/description", () => {
    render(<ConversationEmptyState title="Ask anything" description="Try a question." />);
    expect(screen.getByRole("heading", { name: "Ask anything" })).toBeInTheDocument();
    expect(screen.getByText("Try a question.")).toBeInTheDocument();
  });

  it("lets children replace the default anatomy entirely", () => {
    render(
      <ConversationEmptyState>
        <p>custom</p>
      </ConversationEmptyState>,
    );
    expect(screen.getByText("custom")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No messages yet" })).toBeNull();
  });

  // API lock (#72): `actions` completes the EmptyState anatomy (illustration/icon
  // + title + one sentence + one action, per .claude/rules/design-first.md) —
  // without it, ConversationEmptyState could not offer a next step at all.
  it("renders a passed actions node", () => {
    render(<ConversationEmptyState actions={<button type="button">Ask something</button>} />);
    expect(screen.getByRole("button", { name: "Ask something" })).toBeInTheDocument();
  });

  it("omits the actions wrapper entirely when no actions are passed", () => {
    const { container } = render(<ConversationEmptyState />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("messagesToMarkdown — the download serializer", () => {
  it("labels each message by role and joins every text part", () => {
    expect(messagesToMarkdown(messages)).toBe(
      "**User:** What changed?\n\n**Assistant:** Three services shipped. Billing is degraded.",
    );
  });

  it("skips non-text parts rather than emitting [object Object]", () => {
    const withTool: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [{ type: "step-start" }, { type: "text", text: "Done." }],
      },
    ];
    expect(messagesToMarkdown(withTool)).toBe("**Assistant:** Done.");
  });

  it("honours a custom formatter", () => {
    expect(messagesToMarkdown(messages, (m) => m.role)).toBe("user\n\nassistant");
  });

  it("returns an empty string for an empty transcript", () => {
    expect(messagesToMarkdown([])).toBe("");
  });
});
