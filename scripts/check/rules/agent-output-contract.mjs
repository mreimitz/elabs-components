/**
 * agent-output-contract — the manifest's `agentOutput` block matches the components.
 * Restored from scripts/check-agent-output.mjs (deleted in 4564b4a, recovered from 2fa2ce6).
 *
 * `agentOutput` (authored in packages/cli/lib/agent-output.mjs, emitted by `pnpm gen`)
 * documents the brand-ui-owned projection of the AI SDK message model. The components own
 * the truth: `statusFromToolState` in packages/ai/src/tool.tsx and `STATUSES` in
 * status-badge.tsx. Drift means an agent following the contract emits a state the UI
 * mis-maps. Also checks honesty: every component the block names is a real
 * `@elabs-ai/components-ai` export, and the conversation example never calls `useChat(`
 * (the agent emits DATA; the app owns the runtime — D5/D6).
 */
export const MANIFEST = "brand-ui.manifest.json";
export const TOOL_SRC = "packages/ai/src/tool.tsx";
export const BADGE_SRC = "packages/ui/src/components/status-badge/status-badge.tsx";

/** `statusFromToolState` switch → { state: status }, scoped to that function. */
export function parseStateToStatus(toolSrc) {
  const start = toolSrc.indexOf("statusFromToolState");
  let scope = toolSrc;
  if (start !== -1) {
    const next = toolSrc.indexOf("getStatusBadge", start);
    scope = toolSrc.slice(start, next === -1 ? toolSrc.length : next);
  }
  const out = {};
  for (const m of scope.matchAll(/case\s+"([^"]+)"\s*:\s*return\s+"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

export function parseStatuses(badgeSrc) {
  const m = badgeSrc.match(/export const STATUSES\s*=\s*\[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
}

const sameRecord = (a, b) => {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  return ak.length === bk.length && ak.every((k, i) => k === bk[i] && a[k] === b[k]);
};
const sameArray = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Problems (empty = clean) between the contract and the parsed source. */
export function diffAgentOutput({ agentOutput, aiComponentNames, srcStateToStatus, srcStatuses }) {
  const problems = [];
  const paths = agentOutput?.paths;
  if (!paths?.conversation)
    return ["manifest.agentOutput.paths.conversation is missing — run `pnpm gen`."];
  const conv = paths.conversation;
  const tool = (conv.parts || []).find((p) => p.kind === "tool");
  if (!tool) {
    problems.push(
      "agentOutput conversation has no `tool` part — cannot verify the status mapping.",
    );
  } else {
    if (!Object.keys(srcStateToStatus).length)
      problems.push("could not parse `statusFromToolState` from tool.tsx (source moved?).");
    else if (!sameRecord(tool.stateToStatus || {}, srcStateToStatus))
      problems.push(
        `tool \`stateToStatus\` DRIFTED from statusFromToolState (tool.tsx): contract ${JSON.stringify(tool.stateToStatus)} vs source ${JSON.stringify(srcStateToStatus)}`,
      );
    if (!srcStatuses.length)
      problems.push("could not parse `STATUSES` from status-badge.tsx (source moved?).");
    else if (!sameArray(tool.statusEnum || [], srcStatuses))
      problems.push(
        `tool \`statusEnum\` DRIFTED from STATUSES (status-badge.tsx): contract ${JSON.stringify(tool.statusEnum)} vs source ${JSON.stringify(srcStatuses)}`,
      );
  }
  const named = new Set([
    ...(conv.consumedBy || []),
    ...(conv.parts || []).flatMap((p) => p.consumedBy || []),
    ...(paths.jsxPreview?.component ? [paths.jsxPreview.component] : []),
  ]);
  for (const name of [...named].sort())
    if (!aiComponentNames.has(name))
      problems.push(
        `agentOutput names "${name}", which is NOT exported by @elabs-ai/components-ai.`,
      );
  if (typeof conv.example === "string" && /useChat\s*\(/.test(conv.example))
    problems.push(
      "conversation `example` contains `useChat(` — the agent emits DATA; the app owns the runtime (D5/D6).",
    );
  return problems;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const TOOL = `export const statusFromToolState = (state) => {
  switch (state) {
    case "input-streaming":
      return "pending";
    case "output-available":
      return "complete";
  }
};
export const getStatusBadge = () => { switch (x) { case "a": return "b"; } };
`;
const BADGE = 'export const STATUSES = ["pending", "complete"] as const;';
function fx(mutate = () => {}, { tool = TOOL, badge = BADGE } = {}) {
  const agentOutput = {
    paths: {
      conversation: {
        consumedBy: ["Conversation", "Message"],
        parts: [
          { kind: "text", consumedBy: ["Message"] },
          {
            kind: "tool",
            consumedBy: ["Tool"],
            stateToStatus: { "input-streaming": "pending", "output-available": "complete" },
            statusEnum: ["pending", "complete"],
          },
        ],
        example: "const messages = [{ role: 'user', parts: [] }];",
      },
      jsxPreview: { component: "JSXPreview" },
    },
  };
  mutate(agentOutput);
  const components = ["Conversation", "Message", "Tool", "JSXPreview"].map((name) => ({ name }));
  return {
    files: {
      [MANIFEST]: JSON.stringify({
        agentOutput,
        packages: { "@elabs-ai/components-ai": { components } },
      }),
      [TOOL_SRC]: tool,
      [BADGE_SRC]: badge,
    },
  };
}
const toolPart = (ao) => ao.paths.conversation.parts[1];

export default {
  id: "agent-output-contract",
  scope: "packages",
  doc: "The manifest's `agentOutput` contract matches `statusFromToolState` (ai `tool.tsx`) and `STATUSES` (`status-badge.tsx`), names only real `@elabs-ai/components-ai` exports, and its example never calls `useChat(`.",
  baseline: "none",
  run(ctx) {
    for (const file of [MANIFEST, TOOL_SRC, BADGE_SRC])
      if (!ctx.exists(file)) return [{ file, line: 1, msg: `agent-output: ${file} not found` }];
    let manifest;
    try {
      manifest = ctx.json(MANIFEST);
    } catch (err) {
      return [{ file: MANIFEST, line: 1, msg: `agent-output: failed to parse: ${err.message}` }];
    }
    const aiComponentNames = new Set(
      (manifest?.packages?.["@elabs-ai/components-ai"]?.components ?? []).map((c) => c.name),
    );
    return diffAgentOutput({
      agentOutput: manifest.agentOutput,
      aiComponentNames,
      srcStateToStatus: parseStateToStatus(ctx.readFile(TOOL_SRC)),
      srcStatuses: parseStatuses(ctx.readFile(BADGE_SRC)),
    }).map((msg) => ({
      file: MANIFEST,
      line: 1,
      msg: `${msg} Fix packages/cli/lib/agent-output.mjs + \`pnpm gen\`, or the source.`,
    }));
  },
  fixtures: {
    pass: [fx()],
    fail: [
      fx((ao) => (toolPart(ao).stateToStatus = { "input-streaming": "running" })),
      fx((ao) => (toolPart(ao).statusEnum = ["pending"])),
      fx((ao) => (ao.paths.conversation.consumedBy = ["Conversation", "Nonexistent"])),
      fx((ao) => (ao.paths.jsxPreview.component = "NotAComponent")),
      fx((ao) => (ao.paths.conversation.example = "const { messages } = useChat();")),
      fx((ao) => delete ao.paths.conversation),
      fx((ao) => (ao.paths.conversation.parts = [])),
      fx(() => {}, { badge: "export const OTHER = [];" }),
      fx(() => {}, { tool: 'export const statusFromToolState = (s) => s; case "x": return "y";' }),
    ],
  },
};
