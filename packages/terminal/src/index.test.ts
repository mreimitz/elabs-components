import { describe, expect, it } from "vitest";

import * as terminal from "./index";

// The barrel entry point resolves and evaluates, and actually exports the two
// real components #116 moved in — a broken `exports` map, a typo'd re-export,
// or an unresolvable module graph fails here rather than in a consumer's
// install. Per-component behaviour is covered by terminal.test.tsx and
// interactive-terminal.test.tsx.
describe("@elabs-ai/components-terminal", () => {
  it("exposes the public barrel", () => {
    expect(terminal).toBeTypeOf("object");
    expect(terminal.Terminal).toBeTypeOf("function");
    expect(terminal.InteractiveTerminal).toBeTypeOf("object"); // forwardRef exotic component
    expect(terminal.buildInteractiveTerminalTheme).toBeTypeOf("function");
  });
});
