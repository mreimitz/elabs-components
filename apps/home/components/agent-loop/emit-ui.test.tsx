// Issue #557 — #emit-ui's heading level locks to h2 (peer with other top-level sections).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const emitUiSource = readFileSync(join(here, "emit-ui.tsx"), "utf8");
const agentLoopSource = readFileSync(join(here, "agent-loop.tsx"), "utf8");

describe("emit-ui.tsx — issue #557", () => {
  it("renders the emit-ui heading with level={2} to match top-level section peers", () => {
    // The heading must be h2 to be a peer of #agents, #works-with, etc.,
    // not nested under them as h3 would suggest to heading-navigation AT.
    const headingMatch = emitUiSource.match(/<Heading\s+level={(\d+)}\s+id="emit-ui-heading"/);
    expect(headingMatch).not.toBeNull();
    expect(headingMatch![1]).toBe("2");
  });

  it("keeps AgentLoopTrace's nested 'Tool calls' subsection at h3 in agent-loop.tsx", () => {
    // The "Tool calls" subsection in agent-loop.tsx should stay at h3
    // since it is genuinely nested under the emit-ui section, not a top-level peer.
    // This test ensures we don't accidentally flatten the entire hierarchy.
    expect(agentLoopSource).toContain('<h3 className="text-eyebrow text-muted-foreground">');
  });
});
