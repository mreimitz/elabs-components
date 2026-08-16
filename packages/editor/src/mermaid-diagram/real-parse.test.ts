/**
 * Regression proof against the REAL mermaid parser (no mocks): the exact
 * failure pattern from the workbench live audit (`graph` as a node id) fails
 * as-is and parses after remediation.
 */
import { describe, expect, it } from "vitest";

import { offendingToken, remediateReservedIds } from "./remediate";

const REAL_WORLD = `flowchart TD
  graph[Microsoft Graph: Outlook, Calendar, Teams, Attachments]
  web[Approved web URLs and bounded small-site crawls]
  postgres[(Postgres + pgvector: source of truth)]
  graph -->|delta sync, MSAL device-code auth| worker
  web -->|approved crawl jobs| worker
  worker --> graph
  subgraph host["Local host - all exposed ports bind to 127.0.0.1"]
    langflow_port["localhost:7860"]
  end
  admin -. later .-> review`;

describe("real mermaid parser", () => {
  it("fails on the raw source, parses after remediation", async () => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });

    let firstError: Error | null = null;
    try {
      await mermaid.parse(REAL_WORLD);
    } catch (err) {
      firstError = err as Error;
    }
    expect(firstError, "raw source should fail (reserved id)").not.toBeNull();

    const token = offendingToken(firstError!.message);
    expect(token).toBe("graph");

    const fixed = remediateReservedIds(REAL_WORLD, token!);
    expect(fixed).not.toBeNull();
    await expect(mermaid.parse(fixed!)).resolves.toBeTruthy();
  }, 30_000);
});
