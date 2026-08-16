#!/usr/bin/env node
// session-digest.mjs — distill a Claude Code session transcript (.jsonl) into a
// compact, chronological, *neutral* digest for objective self-review.
//
// EXTRACTION ONLY. This script makes NO judgments about quality — it faithfully
// reproduces what happened (user turns verbatim, assistant text, tool calls,
// tool errors, interruptions, compaction boundaries) so a fresh reviewer agent
// can judge it without bias and without reading a multi-MB raw transcript.
//
// Usage:
//   node .claude/scripts/session-digest.mjs [--session <id|path|current>]
//        [--dir <projectDir>] [--cwd <path>] [--out <path>]
//        [--max-bytes <n>] [--no-thinking] [--list]
//
// Defaults: target = the most-recent session whose entries match the current
// working directory; output = .claude/retros/work/<sessionId>.digest.md
//
// Exit codes: 0 ok · 2 no transcript found · 3 bad args.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = {
    session: "current",
    dir: null,
    cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    out: null,
    maxBytes: 180_000,
    thinking: true,
    list: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--session") a.session = argv[++i];
    else if (k === "--dir") a.dir = argv[++i];
    else if (k === "--cwd") a.cwd = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--max-bytes") a.maxBytes = parseInt(argv[++i], 10);
    else if (k === "--no-thinking") a.thinking = false;
    else if (k === "--list") a.list = true;
    else if (k === "--help" || k === "-h") {
      console.log(
        fs
          .readFileSync(new URL(import.meta.url))
          .toString()
          .split("\n")
          .slice(1, 20)
          .join("\n")
          .replace(/^\/\/ ?/gm, ""),
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${k}`);
      process.exit(3);
    }
  }
  return a;
}

const HOME = os.homedir();
const PROJECTS = path.join(HOME, ".claude", "projects");

// Claude Code slugifies the project path by replacing "/" and "." with "-".
const slugForCwd = (cwd) => cwd.replace(/[/.]/g, "-");

// ---------------------------------------------------------------------------
// transcript resolution
// ---------------------------------------------------------------------------
function firstEntryCwd(file) {
  // read just enough to learn the session's cwd without slurping a multi-MB file
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    for (const line of buf.subarray(0, n).toString("utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if (o.cwd) return o.cwd;
      } catch {
        /* partial last line — ignore */
      }
    }
  } catch {
    /* unreadable — ignore */
  }
  return null;
}

function candidateDirs(args) {
  if (args.dir) return [args.dir];
  const guess = path.join(PROJECTS, slugForCwd(args.cwd));
  if (fs.existsSync(guess)) return [guess];
  // fallback: scan every project dir (cwd filtering happens per-file later)
  if (!fs.existsSync(PROJECTS)) return [];
  return fs
    .readdirSync(PROJECTS)
    .map((d) => path.join(PROJECTS, d))
    .filter((d) => fs.statSync(d).isDirectory());
}

function listTranscripts(args) {
  const out = [];
  for (const dir of candidateDirs(args)) {
    let files;
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      out.push({
        id: f.replace(/\.jsonl$/, ""),
        file: full,
        mtime: st.mtimeMs,
        size: st.size,
        cwd: firstEntryCwd(full),
      });
    }
  }
  return out.sort((x, y) => y.mtime - x.mtime);
}

function findById(args, id) {
  for (const dir of candidateDirs(args)) {
    const p = path.join(dir, `${id}.jsonl`);
    if (fs.existsSync(p)) return { id, file: p };
  }
  return null;
}

// Does this transcript's recent tail contain a /session-retro invocation? Only
// the session the command is actually running inside has the retro at its end —
// a last-resort discriminator when several sessions share one cwd.
function tailHasRetro(file) {
  try {
    const lines = fs.readFileSync(file, "utf8").trimEnd().split("\n");
    return /self-review.{0,8}recap.{0,8}fix|["\s/]session-retro\b/.test(
      lines.slice(-40).join("\n"),
    );
  } catch {
    return false;
  }
}

function resolveTranscript(args) {
  // 1. explicit --session <id|path>
  if (args.session && args.session !== "current") {
    if (fs.existsSync(args.session))
      return { id: path.basename(args.session, ".jsonl"), file: args.session, by: "explicit path" };
    const hit = findById(args, args.session);
    if (hit) return { ...hit, by: "explicit id" };
    return null;
  }
  // 2. DETERMINISTIC: the session id Claude Code exports to this subprocess. This
  //    is the ONLY reliable signal when several sessions share one cwd — mtime
  //    races between concurrent sessions and silently grabs the wrong transcript.
  const envId = process.env.CLAUDE_CODE_SESSION_ID;
  if (envId) {
    const hit = findById(args, envId);
    if (hit) return { ...hit, by: "CLAUDE_CODE_SESSION_ID (exact)" };
  }
  // 3. Fallback (no env id — older CLI, or run outside a live session):
  const all = listTranscripts(args);
  if (!all.length) return null;
  const pool = all.filter((t) => t.cwd === args.cwd);
  const cands = pool.length ? pool : all;
  const retro = cands.find((t) => tailHasRetro(t.file));
  if (retro) return { ...retro, by: "retro-tail heuristic" };
  return {
    ...cands[0],
    by: "mtime heuristic (UNVERIFIED — may be a concurrent session; pass --session to be sure)",
  };
}

// ---------------------------------------------------------------------------
// content helpers
// ---------------------------------------------------------------------------
const INTERRUPT_RE = /\[Request interrupted by user[^\]]*\]/;

function textOf(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text")
      .map((b) => b.text || "")
      .join("\n");
  }
  return "";
}

function clip(s, head, tail = 0) {
  s = (s || "").trim();
  if (s.length <= head + tail + 40) return s;
  const omitted = s.length - head - tail;
  return tail > 0
    ? `${s.slice(0, head)}\n  …[${omitted} chars omitted]…\n  ${s.slice(-tail)}`
    : `${s.slice(0, head)} …[${omitted} chars omitted]`;
}

function toolPreview(name, input = {}) {
  const one = (s) => (s || "").replace(/\s+/g, " ").trim();
  switch (name) {
    case "Bash":
      return `\`${clip(one(input.command), 160)}\``;
    case "Read":
    case "Write":
    case "Edit":
    case "NotebookEdit":
      return input.file_path || "";
    case "Glob":
      return input.pattern || "";
    case "Grep":
      return `/${input.pattern || ""}/ ${input.path || ""}`.trim();
    case "Task":
    case "Agent":
      return `${input.subagent_type || "agent"} · ${one(input.description || "")}`;
    case "AskUserQuestion":
      return (input.questions || [])
        .map((q) => q.header)
        .filter(Boolean)
        .join(" | ");
    case "TodoWrite": {
      const todos = input.todos || [];
      const done = todos.filter((t) => t.status === "completed").length;
      return `${todos.length} todos (${done} done)`;
    }
    case "Skill":
      return input.skill || input.command || "";
    case "Workflow":
      return one(input.description || input.name || "");
    default: {
      const keys = Object.keys(input);
      return keys.length ? keys.join(", ") : "";
    }
  }
}

function hhmm(ts) {
  if (!ts) return "--:--";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// parse → events
// ---------------------------------------------------------------------------
// event = { pri, time, kind, text }
//   pri 0 = always keep (user turns, interruptions, tool errors, compaction)
//   pri 1 = assistant text       pri 2 = tool calls       pri 3 = thinking / ok results
function parse(file, args) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const events = [];
  const stats = {
    human: 0,
    asst: 0,
    tools: 0,
    toolErr: 0,
    interrupts: 0,
    subagents: 0,
    compactions: 0,
    toolByName: {},
    start: null,
    end: null,
  };
  let n = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.timestamp) {
      stats.start ??= o.timestamp;
      stats.end = o.timestamp;
    }
    // skip subagent sidechains in the main digest (count Task dispatches instead)
    if (o.isSidechain) continue;

    const t = o.type;
    const time = o.timestamp;

    if (t === "summary" || (t === "system" && /compact/i.test(o.subtype || o.content || ""))) {
      stats.compactions++;
      events.push({
        pri: 0,
        time,
        kind: "COMPACT",
        text: "⟂ context compacted / summarized here (detail before this point was condensed in the live session)",
      });
      continue;
    }
    if (t !== "user" && t !== "assistant") continue; // drop ai-title, attachment, queue-operation, file-history-snapshot, last-prompt

    const content = o.message?.content;

    if (t === "user") {
      const isToolResult =
        o.toolUseResult !== undefined ||
        (Array.isArray(content) && content.some((b) => b && b.type === "tool_result"));
      if (isToolResult) {
        const blocks = Array.isArray(content)
          ? content.filter((b) => b.type === "tool_result")
          : [];
        for (const b of blocks) {
          const isErr = b.is_error === true;
          const body = typeof b.content === "string" ? b.content : textOf(b.content);
          if (isErr) {
            stats.toolErr++;
            events.push({
              pri: 0,
              time,
              kind: "ERROR",
              text: `⚠️ tool error → ${clip(body, 300)}`,
            });
          } else {
            events.push({ pri: 3, time, kind: "result", text: clip(body, 140) });
          }
        }
        continue;
      }
      // genuine user/human turn
      const txt = textOf(content) || (typeof content === "string" ? content : "");
      if (INTERRUPT_RE.test(txt) || INTERRUPT_RE.test(line)) {
        stats.interrupts++;
        events.push({
          pri: 0,
          time,
          kind: "INTERRUPT",
          text: "⚠️⚠️ [Request interrupted by user] — the user stopped the agent mid-action",
        });
      }
      const clean = txt.replace(INTERRUPT_RE, "").trim();
      if (clean) {
        stats.human++;
        events.push({ pri: 0, time, kind: "USER", text: clip(clean, 2000, 400) });
      }
      continue;
    }

    if (t === "assistant") {
      const blocks = Array.isArray(content) ? content : [];
      for (const b of blocks) {
        if (b.type === "thinking" && args.thinking && (b.thinking || "").trim()) {
          events.push({ pri: 3, time, kind: "think", text: clip(b.thinking, 500) });
        } else if (b.type === "text") {
          if ((b.text || "").trim()) {
            stats.asst++;
            events.push({ pri: 1, time, kind: "ASSISTANT", text: clip(b.text, 1400, 400) });
          }
        } else if (b.type === "tool_use") {
          stats.tools++;
          stats.toolByName[b.name] = (stats.toolByName[b.name] || 0) + 1;
          if (b.name === "Task" || b.name === "Agent") stats.subagents++;
          events.push({
            pri: 2,
            time,
            kind: "tool",
            text: `🔧 ${b.name}(${toolPreview(b.name, b.input)})`,
          });
        }
      }
      continue;
    }
  }

  // number the anchorable events (USER/ASSISTANT/INTERRUPT/ERROR/COMPACT) so
  // findings can cite them; tool calls/results/thinking hang under the nearest one.
  for (const e of events) if (e.pri <= 1) e.n = ++n;

  // mark the /session-retro invocation: everything below is the retro itself, not
  // the work under review. Key off the Skill call or the skill's expanded prompt —
  // NOT a bare session-digest.mjs run (that also happens during normal work).
  const retroIdx = events.findIndex(
    (e) =>
      (e.kind === "USER" && /self-review.{0,8}recap.{0,8}fix|^\s*\/session-retro\b/.test(e.text)) ||
      (e.kind === "tool" && /Skill\(session-retro/.test(e.text)),
  );
  if (retroIdx !== -1) {
    events.splice(retroIdx, 0, {
      pri: 0,
      time: events[retroIdx].time,
      kind: "BOUNDARY",
      text: "═══════ /session-retro invoked below — these turns are the retro itself, NOT under review ═══════",
    });
  }
  return { events, stats };
}

// ---------------------------------------------------------------------------
// render within a byte budget (graceful degradation)
// ---------------------------------------------------------------------------
function renderEvent(e) {
  const tag = e.n ? `#${String(e.n).padStart(3, "0")} ` : "      ";
  const time = `[${hhmm(e.time)}]`;
  switch (e.kind) {
    case "USER":
      return `\n${tag}${time} 🧑 USER\n${indent(e.text)}\n`;
    case "INTERRUPT":
      return `\n${tag}${time} ${e.text}\n`;
    case "ASSISTANT":
      return `\n${tag}${time} 🤖 ASSISTANT\n${indent(e.text)}\n`;
    case "tool":
      return `        ${e.text}`;
    case "ERROR":
      return `\n${tag}${time} ${e.text}`;
    case "result":
      return `        ↳ ${e.text}`;
    case "think":
      return `        💭 ${indent(e.text).trim()}`;
    case "COMPACT":
      return `\n${tag}${time} ${e.text}\n`;
    case "BOUNDARY":
      return `\n\n${e.text}\n`;
    default:
      return e.text;
  }
}
const indent = (s) =>
  s
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");

function render(events, stats, meta, maxBytes) {
  const headerLines = [
    `# Session digest — ${meta.id}`,
    ``,
    `- file: \`${meta.file}\``,
    `- resolved by: ${meta.by || "?"}`,
    `- window: ${hhmm(stats.start)}–${hhmm(stats.end)}  ·  human turns: ${stats.human}  ·  assistant turns: ${stats.asst}`,
    `- tool calls: ${stats.tools}  ·  tool errors: ${stats.toolErr}  ·  interruptions: ${stats.interrupts}  ·  subagents: ${stats.subagents}  ·  compactions: ${stats.compactions}`,
    `- top tools: ${
      Object.entries(stats.toolByName)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => `${k}×${v}`)
        .join(", ") || "—"
    }`,
    ``,
    `> Neutral extraction — no judgment applied. \`#NNN\` anchors mark user/assistant turns for citation.`,
    `> ⚠️ = tool error · ⚠️⚠️ = user interruption · ⟂ = context compaction (detail lost in the live session).`,
    ``,
    `---`,
  ];
  // progressive trim: keep pri 0 always; drop 3, then 2, then nothing more
  for (const dropAt of [4, 3, 2.5, 2]) {
    const kept = events.filter((e) => e.pri < dropAt);
    let body = kept.map(renderEvent).join("\n");
    if (dropAt < 4) {
      body += `\n\n_(digest condensed to fit ${maxBytes} bytes: dropped ${dropAt <= 2 ? "thinking, tool calls & ok-results" : dropAt <= 2.5 ? "thinking & ok-results" : "thinking/ok-results"}; all user turns, interruptions and errors retained.)_`;
    }
    const full = headerLines.join("\n") + "\n" + body + "\n";
    if (Buffer.byteLength(full, "utf8") <= maxBytes || dropAt === 2) return full;
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));

if (args.list) {
  const all = listTranscripts(args);
  if (!all.length) {
    console.error("No transcripts found.");
    process.exit(2);
  }
  const envId = process.env.CLAUDE_CODE_SESSION_ID;
  for (const t of all) {
    const mark = t.id === envId ? "►" : t.cwd === args.cwd ? "*" : " ";
    console.log(
      `${mark} ${t.id}  ${(t.size / 1024 / 1024).toFixed(1)}MB  ${new Date(t.mtime).toISOString()}  ${t.cwd || "?"}`,
    );
  }
  console.log(`\n(► = current session via CLAUDE_CODE_SESSION_ID · * = matches cwd ${args.cwd})`);
  process.exit(0);
}

const target = resolveTranscript(args);
if (!target) {
  console.error(
    `No session transcript found (cwd=${args.cwd}). Try --list, --session <id>, or --dir <projectDir>.`,
  );
  process.exit(2);
}

const { events, stats } = parse(target.file, args);
const out = args.out || path.join(args.cwd, ".claude", "retros", "work", `${target.id}.digest.md`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, render(events, stats, target, args.maxBytes));

const size = fs.statSync(out).size;
const firstUser = events.find((e) => e.kind === "USER");
const preview = firstUser ? firstUser.text.replace(/\s+/g, " ").slice(0, 140) : "(no user turn)";
console.log(`✓ digest written: ${out}`);
console.log(`  session ${target.id}  ·  resolved by: ${target.by}`);
console.log(
  `  ${stats.human} human / ${stats.asst} assistant turns · ${stats.tools} tools · ${stats.interrupts} interruptions · ${stats.toolErr} errors · ${(size / 1024).toFixed(0)}KB`,
);
console.log(`  ↪ first user turn (confirm this is the right session): "${preview}…"`);
