import { useEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@elabs-ai/components-ui";
import { InteractiveTerminal, type InteractiveTerminalHandle } from "./interactive-terminal";

const meta = {
  title: "Terminal/InteractiveTerminal",
  component: InteractiveTerminal,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A token-themed **xterm.js** terminal — a real interactive PTY surface (ANSI " +
          "output, typed input incl. paste, resize). `Terminal` stays the presentational " +
          "read-only log; this is the wrapper for an actual running process. The " +
          "PTY/process is consumer-owned (D5) — this component only renders ANSI output " +
          "and emits `onData`/`onResize`; it never spawns anything. Press **Escape** or " +
          "**Tab**/**Shift+Tab** at any time to move focus out of the terminal — there is " +
          "no keyboard trap.",
      },
    },
  },
} satisfies Meta<typeof InteractiveTerminal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Exercises all 8 base ANSI colors + their bright variants, so a cross-theme
// audit can confirm every swatch stays legible in light/dark.
const ANSI_PALETTE =
  "\x1b[30mblack\x1b[0m \x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m \x1b[33myellow\x1b[0m " +
  "\x1b[34mblue\x1b[0m \x1b[35mmagenta\x1b[0m \x1b[36mcyan\x1b[0m \x1b[37mwhite\x1b[0m\r\n" +
  "\x1b[1;30mblack\x1b[0m \x1b[1;31mred\x1b[0m \x1b[1;32mgreen\x1b[0m \x1b[1;33myellow\x1b[0m " +
  "\x1b[1;34mblue\x1b[0m \x1b[1;35mmagenta\x1b[0m \x1b[1;36mcyan\x1b[0m \x1b[1;37mwhite\x1b[0m " +
  "(bright)\r\n";

async function waitForXtermTextarea(root: HTMLElement): Promise<HTMLTextAreaElement> {
  let textarea: HTMLTextAreaElement | null = null;
  await waitFor(
    () => {
      textarea = root.querySelector("textarea");
      if (!textarea) throw new Error("xterm textarea not mounted yet");
    },
    { timeout: 10000 },
  );
  return textarea!;
}

/**
 * A minimal fake "shell": echoes typed characters back and, on Enter, prints a
 * canned response — standing in for the real PTY a consumer (e.g. the
 * agent seam in a consuming workbench app) would drive via `onData`/`write()`.
 */
function EchoDemo() {
  const ref = useRef<InteractiveTerminalHandle>(null);
  const lineRef = useRef("");
  const lastCommandRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    ref.current?.write(ANSI_PALETTE);
    ref.current?.write("Type a command and press Enter (try “hello”).\r\n$ ");
  }, []);

  const handleData = (data: string) => {
    if (data === "\r") {
      const command = lineRef.current;
      lineRef.current = "";
      ref.current?.write("\r\n");
      if (command.trim().length > 0) {
        ref.current?.write(`\x1b[32m✓\x1b[0m ran: ${command}\r\n`);
        if (lastCommandRef.current) {
          lastCommandRef.current.textContent = `Last command: “${command}”`;
        }
      }
      ref.current?.write("$ ");
      return;
    }
    if (data === "\x7f") {
      if (lineRef.current.length > 0) {
        lineRef.current = lineRef.current.slice(0, -1);
        ref.current?.write("\b \b");
      }
      return;
    }
    lineRef.current += data;
    ref.current?.write(data);
  };

  return (
    <div className="flex h-[360px] w-full flex-col gap-2">
      <div className="min-h-0 flex-1">
        <InteractiveTerminal
          ref={ref}
          aria-label="Demo interactive shell"
          className="h-full w-full"
          onData={handleData}
        />
      </div>
      <p ref={lastCommandRef} className="text-caption text-muted-foreground" data-testid="status">
        No command run yet.
      </p>
      <Button size="sm" variant="outline" className="self-start">
        Next focusable control
      </Button>
    </div>
  );
}

export const Default: Story = {
  render: () => <EchoDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = await waitForXtermTextarea(canvasElement);

    // Type a command and press Enter — proves onData receives keystrokes and
    // that write() renders the echoed ANSI response.
    textarea.focus();
    await userEvent.keyboard("hello{enter}");
    await expect(canvas.getByTestId("status")).toHaveTextContent("Last command: “hello”");

    // No keyboard trap (#285): Tab must move focus OFF the terminal onto the
    // next control, not be swallowed as terminal input.
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: /next focusable control/i })).toHaveFocus();
  },
};

/**
 * `readOnly` degrades the terminal to the existing log use case: `write()`
 * still renders ANSI output, but stdin is disabled and no `onData` fires.
 */
export const ReadOnly: Story = {
  name: "Read-only (log)",
  parameters: {
    docs: {
      description: {
        story:
          "`readOnly` disables stdin (xterm's `disableStdin`) — `write()` still renders, " +
          "so this covers the same append-only log use case as `Terminal`, with real ANSI " +
          "cursor/color handling.",
      },
    },
  },
  render: function ReadOnlyStory() {
    const ref = useRef<InteractiveTerminalHandle>(null);

    useEffect(() => {
      ref.current?.write("$ pnpm build\r\n");
      ref.current?.write(ANSI_PALETTE);
      ref.current?.write("\x1b[32m✓\x1b[0m Build complete in 4.2s\r\n");
    }, []);

    return (
      <div className="h-[280px] w-full">
        <InteractiveTerminal ref={ref} aria-label="Build log" className="h-full w-full" readOnly />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await waitForXtermTextarea(canvasElement);
  },
};
