#!/usr/bin/env node
/**
 * validate-installation.mjs — prove the skill works in THIS repo before trusting it.
 *
 * Run after copying `.claude/skills/repo-cleanup/` + `.claude/commands/repo-cleanup.md`
 * into a new repo. Exits 0 when every check passes, 1 otherwise, and prints one
 * line per check so a failure names itself.
 *
 * It also enforces the skill's own discipline: `SKILL.md` has a hard size cap,
 * because a skill that grows domain detail into its always-listed entry is the
 * anti-pattern this skill exists to find.
 *
 * Usage: node validate-installation.mjs [--root <dir>]
 * Zero dependencies. Node >= 22.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFinding } from "./findings.mjs";
import { redact } from "./redact.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILL_MD_MAX_BYTES = 6 * 1024;
const REQUIRED_NODE_MAJOR = 22;

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
  }
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --------------------------------------------------------------------------

check("node >= 22", () => {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  must(major >= REQUIRED_NODE_MAJOR, `node ${process.versions.node} < ${REQUIRED_NODE_MAJOR}`);
  return `node ${process.versions.node}`;
});

check("skill files present", () => {
  const required = [
    "SKILL.md",
    "scripts/config.mjs",
    "scripts/redact.mjs",
    "scripts/findings.mjs",
    "scripts/report.mjs",
    "scripts/baseline.mjs",
    "scripts/detect-stack.mjs",
    "scripts/context-footprint.mjs",
    "scripts/usage-forensics.mjs",
    "scripts/doc-hygiene.mjs",
    "scripts/repo-inventory.mjs",
    "scripts/measure-command.mjs",
    "references/finding-model.md",
    "references/safety-model.md",
    "references/context-budget.md",
    "references/token-forensics.md",
    "references/doc-hygiene.md",
    "references/repo-hygiene.md",
    "references/stack-adapters.md",
    "references/remediation.md",
  ];
  const missing = required.filter((f) => !existsSync(join(SKILL_DIR, f)));
  must(missing.length === 0, `missing: ${missing.join(", ")}`);
  return `${required.length} required files`;
});

check(`SKILL.md within ${SKILL_MD_MAX_BYTES} byte cap`, () => {
  const bytes = statSync(join(SKILL_DIR, "SKILL.md")).size;
  must(
    bytes <= SKILL_MD_MAX_BYTES,
    `SKILL.md is ${bytes} bytes, over the ${SKILL_MD_MAX_BYTES} cap — move detail into references/`,
  );
  return `${bytes} bytes`;
});

check("SKILL.md frontmatter has name + description", () => {
  const text = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
  must(text.startsWith("---"), "no frontmatter block");
  const end = text.indexOf("\n---", 3);
  must(end > 0, "unterminated frontmatter block");
  const block = text.slice(0, end);
  must(/\nname:\s*\S/.test(block), "frontmatter has no `name:`");
  must(/\ndescription:\s*\S/.test(block), "frontmatter has no `description:`");
  return "ok";
});

check("command router present", () => {
  // The router lives outside the skill dir; find it relative to the .claude root.
  const claudeRoot = dirname(dirname(SKILL_DIR));
  const p = join(claudeRoot, "commands", "repo-cleanup.md");
  must(existsSync(p), `expected ${p}`);
  return "commands/repo-cleanup.md";
});

check("detect-stack runs and emits valid JSON", () => {
  const out = execFileSync(process.execPath, [join(SKILL_DIR, "scripts", "detect-stack.mjs")], {
    encoding: "utf8",
    timeout: 30_000,
  });
  const json = JSON.parse(out);
  must(json.schema === "repo-cleanup/stack@1", `unexpected schema ${json.schema}`);
  must(typeof json.root === "string" && json.root.length > 0, "no root resolved");
  const langs = json.languages.map((l) => l.id).join(",") || "none";
  return `root=${json.root} languages=${langs} gate=${json.gate.confidence}`;
});

check("context-footprint runs and emits valid JSON", () => {
  const out = execFileSync(
    process.execPath,
    [join(SKILL_DIR, "scripts", "context-footprint.mjs")],
    {
      encoding: "utf8",
      timeout: 60_000,
    },
  );
  const json = JSON.parse(out);
  must(json.schema === "repo-cleanup/context-footprint@1", `unexpected schema ${json.schema}`);
  must(typeof json.totals.alwaysLoadedBytes === "number", "no totals");
  return `alwaysLoaded=${json.totals.alwaysLoadedBytes}B ~${json.totals.alwaysLoadedEstimatedTokens} tok (est)`;
});

for (const [name, script] of [
  ["doc-hygiene", "doc-hygiene.mjs"],
  ["repo-inventory", "repo-inventory.mjs"],
]) {
  check(`${name} runs and emits valid JSON`, () => {
    const out = execFileSync(process.execPath, [join(SKILL_DIR, "scripts", script)], {
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const json = JSON.parse(out);
    must(typeof json.schema === "string", "no schema field");
    return json.schema;
  });
}

check("usage-forensics runs and reports whether it resolved transcripts", () => {
  const out = execFileSync(process.execPath, [join(SKILL_DIR, "scripts", "usage-forensics.mjs")], {
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  const json = JSON.parse(out);
  must(json.schema === "repo-cleanup/usage-forensics@1", `unexpected schema ${json.schema}`);
  // `resolved: false` is a PASS. No transcripts is a supported state, and the
  // script must say so rather than emit zeros.
  return json.resolved
    ? `${json.totals.requests} requests · ${json.subagents.count} subagent sidecars · ${json.totals.subagentShareOfCacheRead}% of cache-read`
    : `resolved=false (${json.reason})`;
});

check("finding schema rejects an unfalsifiable finding", () => {
  const base = {
    title: "t",
    category: "context",
    severity: "low",
    confidence: "high",
    estimated_impact: "1 token",
    estimated_effort: "trivial",
    risk: "low",
    frequency: "once",
    scope: "one-file",
    summary: "s",
    evidence: [{ method: "m", result: "r" }],
    measurement_method: "exact byte count",
    recommended_action: "a",
    validation: "v",
    rollback: "r",
    limitations: "none — full file set scanned",
  };
  makeFinding(base); // the happy path must work
  let threwOnEmptyLimitations = false;
  try {
    makeFinding({ ...base, limitations: "" });
  } catch {
    threwOnEmptyLimitations = true;
  }
  must(threwOnEmptyLimitations, "a finding with empty limitations was accepted");

  let threwOnConfirmedEstimate = false;
  try {
    makeFinding({ ...base, confidence: "confirmed", measurement_method: "chars / 4 estimate" });
  } catch {
    threwOnConfirmedEstimate = true;
  }
  must(threwOnConfirmedEstimate, "an estimated measurement was allowed to claim `confirmed`");
  return "both invariants enforced";
});

check("redaction seam works", () => {
  // Round-trip a synthetic secret. The literal must never survive.
  const secret = "ghp_0123456789abcdefghijABCDEFGHIJ0123";
  const out = redact(`token=${secret}`);
  must(!out.includes(secret), "a synthetic token survived redaction");
  must(out.includes("[REDACTED"), "no redaction placeholder emitted");
  return "synthetic token redacted";
});

check("audit surface is read-only (no writes during detection)", () => {
  let before;
  try {
    before = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", timeout: 15_000 });
  } catch {
    return "skipped — no git available (supported, not an error)";
  }
  for (const s of [
    "detect-stack.mjs",
    "context-footprint.mjs",
    "doc-hygiene.mjs",
    "repo-inventory.mjs",
  ]) {
    execFileSync(process.execPath, [join(SKILL_DIR, "scripts", s)], {
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
  }
  const after = execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  must(before === after, "working tree changed while running read-only analyzers");
  return "working tree unchanged";
});

// --------------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  process.stdout.write(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}\n`);
}
process.stdout.write(`\n${results.length - failed}/${results.length} checks passed\n`);
process.exit(failed === 0 ? 0 : 1);
