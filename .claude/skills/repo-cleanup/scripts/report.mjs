/**
 * report.mjs — render the audit report and persist evidence.
 *
 * Deterministic on purpose. Rendering a markdown document is not a task that
 * needs a language model, and doing it in code means the report's SHAPE is
 * guaranteed: "what was not verified" always precedes findings, evidence is
 * always linked rather than pasted, and every estimate keeps its label.
 *
 * The model supplies the judgement (the six executive-summary answers and the
 * findings themselves); this file supplies the structure.
 *
 * Zero dependencies. Node >= 22.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assignIds, byGroup, rank } from "./findings.mjs";
import { redact } from "./redact.mjs";

export const OUTPUT_DIR = ".repo-cleanup";

/** @param {string} root */
export function ensureOutputDir(root) {
  const dir = join(root, OUTPUT_DIR);
  mkdirSync(join(dir, "evidence"), { recursive: true });
  mkdirSync(join(dir, "plans"), { recursive: true });
  return dir;
}

/**
 * Write a raw analyzer result to evidence/. Returns the repo-relative path so
 * the report can link it instead of inlining it.
 *
 * @param {string} root @param {string} name @param {unknown} data
 */
export function writeEvidence(root, name, data) {
  const dir = ensureOutputDir(root);
  const file = `${name}.json`;
  const body = redact(JSON.stringify(data, null, 2));
  writeFileSync(join(dir, "evidence", file), `${body}\n`);
  return `${OUTPUT_DIR}/evidence/${file}`;
}

function bullet(list) {
  return list.length ? list.map((l) => `- ${l}`).join("\n") : "- _(none)_";
}

function renderFinding(f) {
  const files = f.affected_files.length
    ? f.affected_files.map((p) => `\`${p}\``).join(", ")
    : "_(none named)_";
  const evidence = f.evidence
    .map(
      (e) => `  - \`${e.method}\` → ${e.result}${e.artifact ? ` ([evidence](${e.artifact}))` : ""}`,
    )
    .join("\n");
  return `### ${f.id} — ${f.title}

| | |
| --- | --- |
| severity | **${f.severity}** |
| confidence | **${f.confidence}** |
| impact | ${f.estimated_impact} |
| effort · risk | ${f.estimated_effort} · ${f.risk} |
| frequency · scope | ${f.frequency} · ${f.scope} |
| priority score | ${f.score} |
| status | ${f.status} |

${f.summary}

**Evidence**
${evidence}

- **How it was measured:** ${f.measurement_method}
- **Affected:** ${files}
- **Recommended action:** ${f.recommended_action}
- **Validation:** ${f.validation}
- **Rollback:** ${f.rollback}
- **Limitations:** ${f.limitations}
`;
}

/**
 * @param {{
 *   root: string,
 *   mode: string,
 *   ranAt: string,
 *   stack: any,
 *   findings: any[],
 *   summary: { topProblems: string[], evidence: string[], impact: string, doFirst: string, doNotChangeYet: string, needsMeasurement: string[] },
 *   notVerified: string[],
 *   ran: { command: string, outcome: string }[],
 * }} input
 */
export function renderReport(input) {
  const ranked = rank(assignIds(input.findings));
  const groups = byGroup(ranked);
  const s = input.summary;

  const counts = ranked.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});
  const countLine =
    Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(" · ") || "no findings";

  const langs = (input.stack?.languages ?? []).map((l) => l.id).join(", ") || "none detected";

  const body = `# repo-cleanup report — ${input.mode}

_${input.ranAt} · ${input.root}_

**${ranked.length} findings** (${countLine}) · stack: ${langs} · gate: \`${
    input.stack?.gate?.effective ?? "none detected"
  }\` (${input.stack?.gate?.confidence ?? "none"})

> Token figures marked _(estimate)_ come from a \`chars / 4\` heuristic and are **not** API billing
> data. Figures read from a transcript's \`usage\` block are exact and are marked _(measured)_.

## Executive summary

**The three most important problems**
${bullet(s.topProblems)}

**The evidence for them**
${bullet(s.evidence)}

**Likely impact.** ${s.impact}

**Do this first.** ${s.doFirst}

**Do NOT change yet.** ${s.doNotChangeYet}

**Where more measurement is needed**
${bullet(s.needsMeasurement)}

## What was NOT verified

${bullet(input.notVerified)}

## Findings

${
  groups.length === 0
    ? '_No findings. That is a result, not an omission — see "What was NOT verified" above for what this run could and could not see._'
    : groups
        .map((g) => `## ${g.title}\n\n${g.findings.map(renderFinding).join("\n---\n\n")}`)
        .join("\n")
}

## Appendix — what ran

| command | outcome |
| --- | --- |
${input.ran.map((r) => `| \`${r.command}\` | ${r.outcome} |`).join("\n")}

_Raw analyzer output is under \`${OUTPUT_DIR}/evidence/\`. It is deliberately not inlined here._
`;

  return redact(body);
}

/**
 * Render and write. Returns the repo-relative report path.
 * @param {Parameters<typeof renderReport>[0]} input
 */
export function writeReport(input) {
  const dir = ensureOutputDir(input.root);
  const md = renderReport(input);
  writeFileSync(join(dir, "report.md"), md);
  return `${OUTPUT_DIR}/report.md`;
}
