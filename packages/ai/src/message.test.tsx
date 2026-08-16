import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AgentMessage,
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageHeader,
  MessageResponse,
  UserMessage,
} from "./message";

describe("Message chat-user channel (#191, research 11 §B.1)", () => {
  it("gives the user bubble the chat-user fill + foreground", () => {
    render(
      <Message from="user">
        <MessageContent data-testid="content">Hi</MessageContent>
      </Message>,
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain("group-[.is-user]:bg-chat-user");
    expect(content.className).toContain("group-[.is-user]:text-chat-user-foreground");
    expect(content.className).not.toContain("bg-secondary");
  });

  it("drops the dead is-user:dark vendored class and uses the body role", () => {
    render(
      <Message from="assistant">
        <MessageContent data-testid="content">Hello</MessageContent>
      </Message>,
    );
    const content = screen.getByTestId("content");
    expect(content.className).not.toContain("is-user:dark");
    expect(content.className).toContain("text-body");
    expect(content.className).not.toContain("text-sm");
  });
});

describe("UserMessage / AgentMessage presets (#191, research 11 §B.2)", () => {
  it("UserMessage is a Message from=user preset", () => {
    render(
      <UserMessage data-testid="msg">
        <MessageContent>Hi</MessageContent>
      </UserMessage>,
    );
    expect(screen.getByTestId("msg").className).toContain("is-user");
  });

  it("AgentMessage defaults to no rail", () => {
    render(
      <AgentMessage data-testid="msg">
        <MessageContent>Working on it.</MessageContent>
      </AgentMessage>,
    );
    const msg = screen.getByTestId("msg");
    expect(msg.className).toContain("is-assistant");
    expect(msg.className).not.toContain("border-s-primary");
  });

  it("AgentMessage emphasis=answer applies the green rail on the wrapper (not the clipped content)", () => {
    render(
      <AgentMessage data-testid="msg" emphasis="answer">
        <MessageContent data-testid="content">Done.</MessageContent>
      </AgentMessage>,
    );
    const msg = screen.getByTestId("msg");
    expect(msg.className).toContain("border-s-4");
    expect(msg.className).toContain("border-s-primary");
    expect(screen.getByTestId("content").className).not.toContain("border-s-primary");
  });
});

describe("MessageHeader / MessageAvatar slot (#191, research 11 §B.1 MSG-2)", () => {
  it("renders the identity row with the meta role", () => {
    render(
      <AgentMessage>
        <MessageHeader data-testid="header">
          <MessageAvatar name="Atlas" role="user" />
          <span>Atlas</span>
        </MessageHeader>
        <MessageContent>Hi</MessageContent>
      </AgentMessage>,
    );
    expect(screen.getByTestId("header").className).toContain("text-meta");
    // user avatar shows the text initial
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Atlas")).toBeInTheDocument();
  });
});

describe("MessageAvatar role=agent — branded Bot icon, not a text initial", () => {
  it("renders a Bot icon (svg) instead of a text initial for role=agent", () => {
    const { container } = render(
      <AgentMessage>
        <MessageHeader>
          <MessageAvatar data-testid="agent-avatar" name="Atlas" role="agent" />
        </MessageHeader>
        <MessageContent>Working.</MessageContent>
      </AgentMessage>,
    );
    const avatar = container.querySelector("[data-testid='agent-avatar']");
    expect(avatar).not.toBeNull();
    // Must NOT show the bare letter initial "A"
    expect(screen.queryByText("A")).toBeNull();
    // Must have an accessible label
    expect(avatar?.getAttribute("aria-label")).toBe("Atlas (agent)");
    // Must contain an SVG icon (the BotIcon) that is aria-hidden
    const svg = avatar?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
  });

  it("renders branded primary-green classes on the agent avatar", () => {
    const { container } = render(
      <MessageAvatar data-testid="agent-avatar" name="Atlas" role="agent" />,
    );
    const avatar = container.querySelector("[data-testid='agent-avatar']");
    expect(avatar?.className).toContain("bg-primary");
    expect(avatar?.className).toContain("text-primary-foreground");
  });

  it("uses a fallback accessible label when no name is given", () => {
    const { container } = render(<MessageAvatar data-testid="agent-avatar" role="agent" />);
    const avatar = container.querySelector("[data-testid='agent-avatar']");
    expect(avatar?.getAttribute("aria-label")).toBe("Agent");
  });

  // #386 — Radix's `Avatar.Root` renders a plain `<span>` (implicit role
  // `generic`), and ARIA PROHIBITS `aria-label` on `generic`: axe's
  // `aria-prohibited-attr` rejected it and the name was never exposed. The name
  // has to sit on an element permitted to carry one — `role="img"`, the same
  // precedent a titled `@qlik-coe-emea/qlabs-components-icons` `Icon` uses
  // (.claude/rules/icons.md). Deliberately NOT mocking `Avatar`: a stand-in that
  // happens to honour `aria-label` masks exactly this bug (#34/#46).
  it("exposes the agent avatar's name on an element allowed to carry one (role=img)", () => {
    render(<MessageAvatar name="Atlas" role="agent" />);
    expect(screen.getByRole("img", { name: "Atlas (agent)" })).toBeInTheDocument();
  });

  it("exposes the unnamed agent avatar's fallback name the same way", () => {
    render(<MessageAvatar role="agent" />);
    expect(screen.getByRole("img", { name: "Agent" })).toBeInTheDocument();
  });

  // The user branch carries no `aria-label` — its fallback initial is real text
  // content, so a bare `<span>` is legitimate there and must NOT gain a role
  // (an `img` per message would only add noise to a transcript).
  it("leaves the user avatar as a plain container with no img role", () => {
    render(<MessageAvatar name="Ada" role="user" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("MessageResponse loading (#269, loading-states.md)", () => {
  it("renders a skeleton, single live region — not Streamdown — while loading", () => {
    const { container } = render(<MessageResponse loading>{"## Hello"}</MessageResponse>);
    // No markdown content rendered yet.
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
    // Exactly one status live region for the region, not one per skeleton box.
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
    // Skeleton boxes stay decorative.
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    for (const skeleton of skeletons) {
      expect(skeleton).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("renders the real Streamdown content once loading clears", () => {
    render(<MessageResponse>{"Hello world"}</MessageResponse>);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});

describe("Message data-slot / data-role contract", () => {
  it("marks the root and its parts with kebab-case data-slots", () => {
    const { container } = render(
      <Message from="assistant">
        <MessageHeader>
          <MessageAvatar name="Ada" role="agent" />
        </MessageHeader>
        <MessageContent>Hello</MessageContent>
      </Message>,
    );

    expect(container.querySelector('[data-slot="message"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="message-header"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="message-avatar"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="message-content"]')).not.toBeNull();
  });

  it("carries data-role for both turns", () => {
    const { container } = render(
      <>
        <Message from="user">
          <MessageContent>Hi</MessageContent>
        </Message>
        <Message from="assistant">
          <MessageContent>Hello</MessageContent>
        </Message>
      </>,
    );

    expect(container.querySelector('[data-slot="message"][data-role="user"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="message"][data-role="assistant"]')).not.toBeNull();
  });

  it("gives UserMessage/AgentMessage the SAME message root slot (they are presets)", () => {
    // A consumer selector `[data-slot="message"]` must match all three entry
    // points; `data-role` is what disambiguates them.
    const { container } = render(
      <>
        <UserMessage>
          <MessageContent>Hi</MessageContent>
        </UserMessage>
        <AgentMessage>
          <MessageContent>Hello</MessageContent>
        </AgentMessage>
      </>,
    );

    expect(container.querySelectorAll('[data-slot="message"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot="message"][data-role="user"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="message"][data-role="assistant"]')).not.toBeNull();
  });

  it("keeps the is-user / is-assistant classes the group-[] selectors depend on", () => {
    // The styling regression this refactor could have caused: `data-role` is the
    // semantic twin of these classes, NOT a replacement. MessageContent's
    // `group-[.is-user]:bg-chat-user` compiles to `.group.is-user &` — drop the
    // class and the user fill silently disappears in every theme.
    const { container } = render(
      <Message from="user">
        <MessageContent>Hi</MessageContent>
      </Message>,
    );

    const root = container.querySelector('[data-slot="message"]');
    expect(root?.className).toContain("is-user");
    expect(root?.className).toContain("group");
  });

  it("lets a consumer override the slot", () => {
    const { container } = render(
      <Message data-slot="custom" from="user">
        <MessageContent>Hi</MessageContent>
      </Message>,
    );
    expect(container.querySelector('[data-slot="custom"]')).not.toBeNull();
  });
});

function BranchHarness(props: { branch?: number; onBranchChange?: (n: number) => void }) {
  return (
    <MessageBranch {...props}>
      <MessageBranchContent>
        <div key="a">Branch A</div>
        <div key="b">Branch B</div>
        <div key="c">Branch C</div>
      </MessageBranchContent>
      <MessageBranchSelector>
        <MessageBranchPrevious />
        <MessageBranchPage />
        <MessageBranchNext />
      </MessageBranchSelector>
    </MessageBranch>
  );
}

describe("MessageBranch — controlled mode (#361)", () => {
  it("is uncontrolled by default: defaultBranch + internal Next/Previous navigation are unaffected", async () => {
    const onBranchChange = vi.fn();
    const { container } = render(
      <BranchHarness onBranchChange={onBranchChange} />, // no `branch` prop
    );

    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next branch" }));

    // Internal state drove the move — MessageBranchPage reflects it directly,
    // with no external `branch` prop involved.
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(onBranchChange).toHaveBeenCalledWith(1);

    const contentDivs = container.querySelectorAll('[data-slot="message-branch-content"]');
    expect(contentDivs[1]?.className).toContain("block");
    expect(contentDivs[0]?.className).toContain("hidden");
  });

  it("follows an externally-owned `branch` prop, with no `key` remount, and still fires onBranchChange", async () => {
    const onBranchChange = vi.fn();

    function ControlledHost() {
      const [branch, setBranch] = useState(0);
      return (
        <div>
          {/* Sibling, uncontrolled local state — proves MessageBranch isn't
              being torn down and remounted via a changed `key` (the documented
              uncontrolled-only workaround this issue removes the need for). */}
          <input aria-label="sibling state" />
          <button type="button" onClick={() => setBranch(2)}>
            jump to branch 3
          </button>
          <BranchHarness
            branch={branch}
            onBranchChange={(n) => {
              setBranch(n);
              onBranchChange(n);
            }}
          />
        </div>
      );
    }

    const { container } = render(<ControlledHost />);

    await userEvent.type(screen.getByLabelText("sibling state"), "keep me");

    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "jump to branch 3" }));

    expect(screen.getByText("3 of 3")).toBeInTheDocument();
    const contentDivs = container.querySelectorAll('[data-slot="message-branch-content"]');
    expect(contentDivs[2]?.className).toContain("block");
    expect(contentDivs[0]?.className).toContain("hidden");

    // The sibling's local state survived the branch change — no remount occurred.
    expect(screen.getByLabelText("sibling state")).toHaveValue("keep me");

    // Navigating with Previous still calls the host's updater (controlled mode
    // never falls back to internal state).
    await userEvent.click(screen.getByRole("button", { name: "Previous branch" }));
    expect(onBranchChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });
});

describe("MessageActions hover-reveal pill", () => {
  it("defaults to the pre-existing inline row (no pill, no fade)", () => {
    const { container } = render(
      <Message from="assistant">
        <MessageActions>
          <MessageAction tooltip="Copy">
            <span aria-hidden="true">C</span>
          </MessageAction>
        </MessageActions>
      </Message>,
    );
    const row = container.querySelector('[data-slot="message-actions"]')!;
    // Adopting the variants must not restyle any consumer that never sets them.
    expect(row.className).not.toContain("opacity-0");
    expect(row.className).not.toContain("rounded-full");
    expect(row.className).not.toContain("shadow-ring-sm");
  });

  // The row acts on the bubble ABOVE it, so it has to travel with that bubble.
  // A user turn is `ms-auto`'d right by `Message`; a row left at the column's
  // cross-start renders under the PREVIOUS (assistant) message, where "Edit"
  // reads as editing the agent's answer. Asserting the selector, not just that
  // two class strings differ — the alignment is the whole point.
  it("follows the user bubble to the right, in both appearances", () => {
    for (const appearance of ["plain", "bar"] as const) {
      const { container, unmount } = render(
        <Message from="user">
          <MessageContent>Hi</MessageContent>
          <MessageActions appearance={appearance}>
            <MessageAction tooltip="Copy">
              <span aria-hidden="true">C</span>
            </MessageAction>
          </MessageActions>
        </Message>,
      );
      const row = container.querySelector('[data-slot="message-actions"]')!;
      // Same selector MessageContent uses for the --chat-user fill.
      expect(row.className).toContain("group-[.is-user]:ms-auto");
      unmount();
    }
  });

  it("gives the bar appearance a ring-edged pill and NO border (ADR 0020)", () => {
    const { container } = render(
      <Message from="assistant">
        <MessageActions appearance="bar">
          <MessageAction tooltip="Copy">
            <span aria-hidden="true">C</span>
          </MessageAction>
        </MessageActions>
      </Message>,
    );
    const row = container.querySelector('[data-slot="message-actions"]')!;
    expect(row.className).toContain("shadow-ring-sm");
    expect(row.className).toContain("rounded-full");
    // A floating surface takes the ring OR a border, never both — the double
    // edge is exactly what `pnpm elevation:check` exists to stop.
    expect(row.className).not.toMatch(/(^|\s)border(\s|$)/);
  });

  it("hides on hover-capable pointers only, and reveals on hover/focus/open menu", () => {
    const { container } = render(
      <Message from="assistant">
        <MessageActions reveal="hover">
          <MessageAction tooltip="Copy">
            <span aria-hidden="true">C</span>
          </MessageAction>
        </MessageActions>
      </Message>,
    );
    const row = container.querySelector('[data-slot="message-actions"]')!;
    // The resting fade-out is gated on `pointer-fine` — an unprefixed
    // `opacity-0` would strand touch users, who have no gesture that reveals it.
    expect(row.className).toContain("pointer-fine:opacity-0");
    expect(row.className).not.toMatch(/(^|\s)opacity-0(\s|$)/);
    expect(row.className).toContain("pointer-fine:group-hover:opacity-100");
    expect(row.className).toContain("pointer-fine:focus-within:opacity-100");
    expect(row.className).toContain("pointer-fine:has-[[data-state=open]]:opacity-100");
    expect(row.className).toContain("motion-reduce:transition-none");
  });

  it("keeps the controls focusable and named while faded out", async () => {
    render(
      <Message from="assistant">
        <MessageActions appearance="bar" reveal="hover">
          <MessageAction tooltip="Copy">
            <span aria-hidden="true">C</span>
          </MessageAction>
          <MessageAction tooltip="Pin">
            <span aria-hidden="true">P</span>
          </MessageAction>
        </MessageActions>
      </Message>,
    );
    // The row fades; it is never `hidden`/unmounted. Tabbing must still reach
    // both controls — that is what makes `focus-within` able to bring it back.
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Copy" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Pin" })).toHaveFocus();
  });

  it("names the group, and lets the host override the name", () => {
    const { rerender } = render(
      <Message from="assistant">
        <MessageActions>
          <MessageAction tooltip="Copy">
            <span aria-hidden="true">C</span>
          </MessageAction>
        </MessageActions>
      </Message>,
    );
    expect(screen.getByRole("group", { name: "Message actions" })).toBeInTheDocument();

    rerender(
      <Message from="assistant">
        <MessageActions label="Actions for Atlas's reply">
          <MessageAction tooltip="Copy">
            <span aria-hidden="true">C</span>
          </MessageAction>
        </MessageActions>
      </Message>,
    );
    expect(screen.getByRole("group", { name: "Actions for Atlas's reply" })).toBeInTheDocument();
  });

  it("ships no behaviour — the host owns the click and any toggle state", async () => {
    const onCopy = vi.fn();
    function Host() {
      const [pinned, setPinned] = useState(false);
      return (
        <Message from="assistant">
          <MessageActions appearance="bar" reveal="hover">
            <MessageAction onClick={onCopy} tooltip="Copy">
              <span aria-hidden="true">C</span>
            </MessageAction>
            <MessageAction
              aria-pressed={pinned}
              onClick={() => setPinned((v) => !v)}
              tooltip={pinned ? "Unpin" : "Pin"}
            >
              <span aria-hidden="true">P</span>
            </MessageAction>
          </MessageActions>
        </Message>
      );
    }
    render(<Host />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledTimes(1);

    const pin = screen.getByRole("button", { name: "Pin" });
    expect(pin).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(pin);
    expect(screen.getByRole("button", { name: "Unpin" })).toHaveAttribute("aria-pressed", "true");
  });
});
