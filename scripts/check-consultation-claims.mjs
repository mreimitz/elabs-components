#!/usr/bin/env node
/**
 * check-consultation-claims.mjs — a result file (or any mid-session Write/Edit)
 * may not claim a named-agent consultation/sign-off that never happened (#42).
 *
 * The gap this closes: `.claude/hooks/gate-completion-claims.sh` (the existing
 * Stop hook) has ZERO consultation-phrase coverage in its claim lexicon and only
 * ever reads the LAST assistant message's TEXT — so a false claim buried inside
 * a mid-session `Write` (a subagent's own result file, e.g.
 * `form-primitives-result.md:31-33`: "Consulted `brand-ui-design-system-architect`,
 * who confirmed…") was invisible to it, and to every other gate in the repo.
 *
 * This is a NEW sibling, not a mode of `gate-completion-claims.sh` — that hook's
 * existing shape (last-message-only, its own claim lexicon, its own
 * `stop_hook_active` loop guard) is left undisturbed per the issue's own file
 * list. `.claude/hooks/gate-consultation-claims.sh` is the thin Stop-hook
 * plumbing around this module, mirroring how
 * `.claude/hooks/gate-pr-merge-readiness.sh` wraps `check-merge-readiness.mjs`.
 *
 * Technique: reuse the transcript dispatch-evidence extraction proven in
 * `scripts/check-session-cadence.mjs`'s sibling hook
 * (`.claude/hooks/session-cadence-nudge.sh`) — a REAL `Task.subagent_type`
 * tool_use earlier in the same transcript, never a prose grep. That hook's own
 * history is the documented reason prose-grep doesn't work here either: the
 * harness injects `type:"attachment"` agent-roster lines into every session, and
 * assistant prose that MENTIONS an agent is not evidence it was dispatched.
 *
 * Deliberately narrow (the issue's own scope-discipline note): the claim regex
 * matches only named-agent consultation/sign-off phrases — "consulted
 * `brand-ui-X`", "confirmed by `brand-ui-X`", "per the architect", "architect
 * sign-off" — never general prose. This is not a lie detector; it is a check
 * that ONE specific, previously-real false-claim shape cannot recur unnoticed.
 *
 * Usage:
 *   node scripts/check-consultation-claims.mjs <transcript.jsonl>
 * Exit 0 — no unverified claim found (or the transcript could not be read).
 * Exit 1 — one or more unverified claims found; printed to stderr.
 */
import { readFileSync } from "node:fs";

/**
 * Claim phrases that name (or imply) a specific subagent consultation.
 * `named1`/`named2` capture an explicit `brand-ui-<kebab>` agent name;
 * the two architect-only phrases have no capture group because they always
 * mean the same agent (`brand-ui-design-system-architect` — the one named in
 * component-api.md's "Subpath exports" routing rule, the rule the real false
 * claim this gate was written for was trying to satisfy).
 */
const CLAIM_RE =
  /\bconsulted\s+`?(?<named1>brand-ui-[a-z-]+)`?|\bconfirmed by\s+`?(?<named2>brand-ui-[a-z-]+)`?|\bper the architect\b|\barchitect sign-?off\b/gi;

const ARCHITECT_DEFAULT = "brand-ui-design-system-architect";

/** A short, readable excerpt around a match — enough to show the reader the claim in context. */
function excerptAround(text, index, span = 60) {
  const start = Math.max(0, index - span);
  const end = Math.min(text.length, index + span);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Parse a JSONL transcript (already-parsed line objects, in transcript order)
 * into an ordered event stream: real Task dispatches, and the text bodies of
 * every Write/Edit/MultiEdit a subsequent claim could hide inside. `idx` is
 * each line's position in the transcript — order, not wall-clock time, is what
 * "earlier" means here, exactly as the transcript's own JSONL ordering encodes.
 *
 * Mirrors session-cadence-nudge.sh's noise exclusions: harness
 * `type:"attachment"` lines and `isMeta` lines are dropped, and only
 * `message.role === "assistant"` tool_use blocks are read — a `tool_result`
 * echoing a Write's own content back is not a NEW claim.
 */
export function extractEvents(lines) {
  const events = [];
  lines.forEach((line, idx) => {
    if (!line || typeof line !== "object") return;
    if ((line.type ?? "") === "attachment") return;
    if (line.isMeta) return;
    const role = line.message?.role ?? "";
    if (role !== "assistant") return;
    const content = line.message?.content;
    const blocks = Array.isArray(content) ? content : [];
    for (const b of blocks) {
      if ((b?.type ?? "") !== "tool_use") continue;
      const name = b?.name ?? "";
      if (name === "Task") {
        events.push({ idx, kind: "dispatch", agent: b?.input?.subagent_type ?? "" });
      } else if (name === "Write") {
        events.push({
          idx,
          kind: "text",
          file: b?.input?.file_path ?? "",
          text: b?.input?.content ?? "",
        });
      } else if (name === "Edit") {
        events.push({
          idx,
          kind: "text",
          file: b?.input?.file_path ?? "",
          text: b?.input?.new_string ?? "",
        });
      } else if (name === "MultiEdit") {
        const edits = Array.isArray(b?.input?.edits) ? b.input.edits : [];
        events.push({
          idx,
          kind: "text",
          file: b?.input?.file_path ?? "",
          text: edits.map((e) => e?.new_string ?? "").join("\n"),
        });
      }
    }
  });
  return events;
}

/**
 * The checker. Returns `[]` when every consultation claim in the transcript is
 * backed by a real, earlier `Task` dispatch to the named subagent; otherwise one
 * entry per unbacked claim.
 */
export function findUnverifiedConsultationClaims(lines) {
  const events = extractEvents(lines);
  const dispatches = events.filter((e) => e.kind === "dispatch");
  const wasDispatchedBefore = (idx, agent) =>
    dispatches.some((d) => d.idx < idx && d.agent === agent);

  const violations = [];
  for (const e of events) {
    if (e.kind !== "text" || !e.text) continue;
    for (const m of e.text.matchAll(CLAIM_RE)) {
      const agent = m.groups?.named1 || m.groups?.named2 || ARCHITECT_DEFAULT;
      if (!wasDispatchedBefore(e.idx, agent)) {
        violations.push({
          idx: e.idx,
          file: e.file,
          agent,
          excerpt: excerptAround(e.text, m.index ?? 0),
        });
      }
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const transcriptPath = process.argv[2];
  if (!transcriptPath) {
    // No transcript given — nothing to check. Never fails the caller for a
    // missing/optional argument; the Stop hook decides whether to invoke this
    // at all.
    process.exit(0);
  }
  let raw;
  try {
    raw = readFileSync(transcriptPath, "utf8");
  } catch {
    process.exit(0);
  }
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const violations = findUnverifiedConsultationClaims(lines);
  if (!violations.length) process.exit(0);

  for (const v of violations) {
    console.error(
      `  ${v.file || "(no file path)"}: claims consultation with \`${v.agent}\` but no prior ` +
        `Task dispatch to that subagent appears earlier in this transcript.`,
    );
    console.error(`    "${v.excerpt}"`);
  }
  process.exit(1);
}
