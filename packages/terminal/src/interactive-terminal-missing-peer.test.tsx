/**
 * Issue #33 — `@xterm/xterm`/`@xterm/addon-fit` are OPTIONAL peers of
 * `@elabs-ai/components-terminal`, reached only through the dynamic
 * `import("./_interactive-terminal-xterm")` inside `InteractiveTerminal`'s
 * mount effect (ADR 0019). A consumer who skips those peers must get a
 * graceful, actionable panel — never a crash or an unhandled rejection.
 *
 * Separate file from `interactive-terminal.test.tsx`: that file globally
 * mocks `@xterm/xterm`/`@xterm/addon-fit` (the REAL engine) to exercise the
 * happy path; this file mocks the LOCAL lazy-boundary module
 * (`./_interactive-terminal-xterm`) to REJECT, simulating the peer being
 * absent (a `Cannot find module` style failure), without touching the
 * engine mocks the sibling file relies on.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Vitest wraps a `vi.mock` factory that itself THROWS or REJECTS with its own
// "there was an error when mocking a module" diagnostic (a genuine Vitest
// behavior, not something under this component's control), which would mask
// the message this test needs to see. So the factory succeeds — the module
// resolves fine — and the simulated "peer not installed" failure instead comes
// from `loadXTermEngine()` itself rejecting, which is a plain thrown error
// inside the mount effect's `.then()` chain and therefore reaches the
// component's own `.catch()` unmodified, exactly as a real missing-peer
// rejection would (see `_interactive-terminal-xterm.ts`'s own guard, which
// throws this same message when the dynamic `import("@xterm/xterm")` it
// awaits resolves to a peer-less stub).
vi.mock("./_interactive-terminal-xterm", () => ({
  loadXTermEngine: () => Promise.reject(new Error("Cannot find module '@xterm/xterm'")),
}));

import { InteractiveTerminal } from "./interactive-terminal";

afterEach(cleanup);

const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

describe("InteractiveTerminal — missing optional peer (#33)", () => {
  it("renders an actionable panel instead of crashing or going blank", async () => {
    render(<InteractiveTerminal aria-label="Terminal" />);
    await flush();

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    // Names the exact packages to install (issue #33's acceptance criterion).
    expect(screen.getByText(/@xterm\/xterm/)).toBeInTheDocument();
    expect(screen.getByText(/@xterm\/addon-fit/)).toBeInTheDocument();
    // Not the destructive/retry treatment — a missing peer is a capability
    // gap (.claude/rules/viewer-components.md), not a failure to retry.
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});
