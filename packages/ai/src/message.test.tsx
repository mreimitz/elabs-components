import { math } from "@streamdown/math";
import { useState } from "react";
import type { ComponentProps } from "react";
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
  // precedent a titled `@elabs-ai/components-icons` `Icon` uses
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

describe("MessageResponse plugins/components overrides (#10 — merge-not-replace semantics)", () => {
  it("merges a real `plugins.cjk` override in (append), keeps sanitisation on, and keeps the untouched `plugins.math` default alive (#10)", () => {
    // A real, discriminating lock — NOT `plugins={{}}` (that exercises zero
    // slots and passes identically under merge, replace, or a no-op; #10
    // review I3). This test supplies a genuine `cjk` plugin (one of the two
    // slots MessageResponse actually reaches — `code`/`mermaid`/`renderers` are
    // consulted only inside Streamdown's OWN default `code` renderer, which
    // `MessageResponse` always shadows) and proves BOTH halves of the
    // merge property:
    //   1. Streamdown's default rehypePlugins (raw → sanitize → harden)
    //      still hold — a <script> is stripped.
    //   2. The supplied `cjk` plugin APPENDS (its remark transformer runs)
    //      *and* the internal `math` default the consumer did NOT set
    //      SURVIVES alongside it (`$$x^2$$` renders as real KaTeX, not
    //      literal text). A REPLACE implementation
    //      (`plugins = pluginOverrides`) would drop `math` — along with
    //      `code`/`mermaid` — the moment a consumer sets `cjk`, and this
    //      assertion would fail.
    const cjkRemarkSpy = vi.fn(() => (tree: unknown) => tree);
    const customCjkPlugin: NonNullable<
      NonNullable<ComponentProps<typeof MessageResponse>["plugins"]>["cjk"]
    > = {
      name: "cjk",
      remarkPlugins: [],
      remarkPluginsAfter: [cjkRemarkSpy],
      remarkPluginsBefore: [],
      type: "cjk",
    };
    const UNSAFE_DOC = `# Note

<script>window.__pwned = true;</script>

$$x^2$$
`;
    render(<MessageResponse plugins={{ cjk: customCjkPlugin }}>{UNSAFE_DOC}</MessageResponse>);

    // (1) sanitisation still holds.
    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/pwned/);
    // (2a) the supplied `cjk` plugin appended (its transformer ran)…
    expect(cjkRemarkSpy).toHaveBeenCalled();
    // (2b) …and the internal `math` default the consumer did not set is
    // still active — real KaTeX markup, not the literal `$$x^2$$` text.
    expect(document.querySelector(".katex")).toBeInTheDocument();
  });
});

describe("MessageResponse sanitiser is not overridable (#36)", () => {
  it("ignores a caller-supplied rehypePlugins array (the sanitiser is not overridable)", () => {
    // A rehype plugin that appends a <script> AFTER the pipeline. Under the bug the
    // consumer array REPLACES [rehypeRaw, rehypeSanitize, harden], so nothing strips it.
    const injectScript = () => (tree: { children: unknown[] }) => {
      tree.children.push({
        type: "element",
        tagName: "script",
        properties: {},
        children: [{ type: "text", value: "globalThis.__pwned = true" }],
      });
    };
    const { container } = render(
      // `as any`: a JS consumer, an `any`, or a wider spread object still reaches
      // this path even after the type-level `Omit`, so the assertion must exercise
      // the RUNTIME strip, not the type. (`as never` doesn't typecheck as a JSX
      // spread — TS2698, "Spread types may only be created from object types" —
      // `any` is the cast the issue itself names as the bypass vector.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberate: proves the runtime strip, not the type
      <MessageResponse {...({ rehypePlugins: [injectScript] } as any)}>{"# hi"}</MessageResponse>,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("SUPPORTS a caller-supplied remarkPlugins array, and still sanitises what it injects", () => {
    // PR #74 review, round 1: `remarkPlugins` is NOT a sanitiser override. It runs
    // upstream of [rehypeRaw, rehypeSanitize, harden], which Streamdown derives
    // without reading it — so the prop stays supported (no `as any` below: the TYPE
    // must accept it) while its output is still sanitised. Both halves are asserted,
    // so re-adding it to the runtime strip fails, and dropping the rehype chain fails.
    const ran = vi.fn();
    const injectHostile = () => (tree: { children: unknown[] }) => {
      ran();
      tree.children.push({
        type: "html",
        value: '<script>globalThis.__pwned = true</script><img src="x" onerror="void 0">',
      });
      tree.children.push({
        type: "paragraph",
        data: { hName: "script", hChildren: [{ type: "text", value: "globalThis.__x = 1" }] },
        children: [],
      });
    };
    const { container } = render(
      <MessageResponse remarkPlugins={[injectHostile]}>{"# hi"}</MessageResponse>,
    );

    expect(ran).toHaveBeenCalled(); // the prop really reached Streamdown
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/pwned/);
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

describe("MessageResponse trusted plugin slots run after the sanitiser (#76)", () => {
  // `plugins.math.rehypePlugin` is appended to the END of Streamdown's rehype
  // pipeline, i.e. AFTER `rehype-raw` → `rehype-sanitize` → `rehype-harden`, so
  // whatever it emits is never re-sanitised. That is a deliberate, documented
  // trusted-code seam (a consumer who can supply an executable `Pluggable` can
  // already run code in their own bundle) — but until #76 it had no runtime
  // half at all, unlike `rehypePlugins`. These three tests are the runtime half:
  // it WARNS (1), it does not become noise (2), and it stays OPEN (3).
  const injectScript = () => (tree: { children: unknown[] }) => {
    tree.children.push({
      type: "element",
      tagName: "script",
      properties: {},
      children: [{ type: "text", value: "globalThis.__pwned76 = true" }],
    });
  };
  const evilMath = { ...math, rehypePlugin: injectScript };

  it("warns when a consumer replaces plugins.math.rehypePlugin", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<MessageResponse plugins={{ math: evilMath }}>{"# hi"}</MessageResponse>);
      const messages = warn.mock.calls.flat().join("\n");
      expect(messages).toMatch(/math\.rehypePlugin/);
      expect(messages).toMatch(/after/i);
    } finally {
      warn.mockRestore();
    }
  });

  it("does not warn for the default plugin set or a safe slot override", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { unmount } = render(<MessageResponse>{"# hi"}</MessageResponse>);
      unmount();
      // A `cjk` override is remark-stage only — its output is re-sanitised
      // downstream, so it is NOT a trust boundary and must stay silent. This is
      // the arm that stops the warning degrading into noise consumers learn to
      // ignore.
      const customCjkPlugin: NonNullable<
        NonNullable<ComponentProps<typeof MessageResponse>["plugins"]>["cjk"]
      > = {
        name: "cjk",
        remarkPlugins: [],
        remarkPluginsAfter: [],
        remarkPluginsBefore: [],
        type: "cjk",
      };
      render(<MessageResponse plugins={{ cjk: customCjkPlugin }}>{"# hi"}</MessageResponse>);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("documents the boundary rather than closing it (the slot stays open)", () => {
    // Counter-intuitive but load-bearing: this pins the deliberate trusted-code
    // escape hatch OPEN. A future "hardening" that strips the slot would break a
    // legitimate consumer (a real KaTeX/math plugin) silently — this fails loudly
    // instead. The defence is the warning above plus the documented boundary,
    // NOT removing the capability.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = render(
        <MessageResponse plugins={{ math: evilMath }}>{"# hi"}</MessageResponse>,
      );
      expect(container.querySelector("script")).not.toBeNull();
    } finally {
      warn.mockRestore();
    }
  });
});
