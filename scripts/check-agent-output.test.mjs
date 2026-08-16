/**
 * check-agent-output.test.mjs — locks the agent-output contract gate
 * (scripts/check-agent-output.mjs). Run in CI: `node --test`.
 *
 * Hermetic: drives the PURE exports with fixture strings — never the real repo
 * files. Asserts the parsers read the source shapes, AND that drift / dishonesty
 * is flagged (the whole point of the gate: it must FAIL when the contract and the
 * components disagree).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStateToStatus, parseStatuses, diffAgentOutput } from "./check-agent-output.mjs";

const TOOL_FIXTURE = `
export const statusFromToolState = (state) => {
  switch (state) {
    case "input-streaming":
      return "pending";
    case "output-available":
      return "complete";
  }
};
export const getStatusBadge = () => null;
`;

const BADGE_FIXTURE = `export const STATUSES = ["pending", "complete"] as const;`;

const SRC_MAP = { "input-streaming": "pending", "output-available": "complete" };
const SRC_STATUSES = ["pending", "complete"];
const AI_NAMES = new Set(["Conversation", "Message", "Tool", "JSXPreview"]);

/** A matching agentOutput block (the happy path). */
function makeAgentOutput(over = {}) {
  const base = {
    paths: {
      conversation: {
        consumedBy: ["Conversation", "Message"],
        parts: [
          { kind: "text", consumedBy: ["Message"] },
          {
            kind: "tool",
            consumedBy: ["Tool"],
            stateToStatus: { ...SRC_MAP },
            statusEnum: [...SRC_STATUSES],
          },
        ],
        example: "const messages = [{ role: 'user', parts: [] }];",
      },
      jsxPreview: { component: "JSXPreview" },
    },
  };
  return { ...base, ...over };
}

function run(agentOutput) {
  return diffAgentOutput({
    agentOutput,
    aiComponentNames: AI_NAMES,
    srcStateToStatus: SRC_MAP,
    srcStatuses: SRC_STATUSES,
  });
}

// ── parsers ──────────────────────────────────────────────────────────────────

test("parseStateToStatus reads the switch cases", () => {
  assert.deepEqual(parseStateToStatus(TOOL_FIXTURE), SRC_MAP);
});

test("parseStatuses reads the STATUSES array", () => {
  assert.deepEqual(parseStatuses(BADGE_FIXTURE), SRC_STATUSES);
});

// ── clean ──────────────────────────────────────────────────────────────────

test("CLEAN: an aligned contract produces no problems", () => {
  assert.deepEqual(run(makeAgentOutput()), []);
});

// ── drift / dishonesty is flagged ────────────────────────────────────────────

test("FLAGS: stateToStatus drift from the source switch", () => {
  const ao = makeAgentOutput();
  ao.paths.conversation.parts[1].stateToStatus = { "input-streaming": "running" }; // wrong
  const problems = run(ao);
  assert.ok(
    problems.some((p) => p.includes("stateToStatus")),
    problems.join("\n"),
  );
});

test("FLAGS: statusEnum drift from STATUSES", () => {
  const ao = makeAgentOutput();
  ao.paths.conversation.parts[1].statusEnum = ["pending"]; // missing "complete"
  assert.ok(run(ao).some((p) => p.includes("statusEnum")));
});

test("FLAGS: a consumedBy name not exported by @elabs/components-ai", () => {
  const ao = makeAgentOutput();
  ao.paths.conversation.consumedBy = ["Conversation", "Nonexistent"];
  assert.ok(run(ao).some((p) => p.includes("Nonexistent")));
});

test("FLAGS: jsxPreview.component not exported by @elabs/components-ai", () => {
  const ao = makeAgentOutput();
  ao.paths.jsxPreview.component = "NotAComponent";
  assert.ok(run(ao).some((p) => p.includes("NotAComponent")));
});

test("FLAGS: a useChat( call leaking into the conversation example (D6)", () => {
  const ao = makeAgentOutput();
  ao.paths.conversation.example = "const { messages } = useChat();";
  assert.ok(run(ao).some((p) => p.includes("useChat")));
});

test("FLAGS: a missing conversation path", () => {
  assert.ok(run({ paths: {} }).some((p) => p.includes("conversation is missing")));
});
