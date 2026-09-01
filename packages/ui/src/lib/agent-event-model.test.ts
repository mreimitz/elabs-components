import { describe, expect, it } from "vitest";
import { agentEventOutcomeStatus, type AgentEventOutcome } from "./agent-event-model";

describe("agentEventOutcomeStatus", () => {
  it.each([
    ["ok", "complete"],
    ["blocked", "denied"],
    ["failed", "failed"],
  ] as [AgentEventOutcome, string][])("maps %s to the %s status", (outcome, expected) => {
    expect(agentEventOutcomeStatus(outcome)).toBe(expected);
  });
});
