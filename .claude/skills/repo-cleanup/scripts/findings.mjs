/**
 * findings.mjs — the finding schema, its invariants, and the ranking model.
 *
 * This module exists so the rules in references/finding-model.md are ENFORCED
 * rather than merely written down. Three of them are structural and are checked
 * here, not left to discipline:
 *
 *   1. `limitations` may not be empty. A finding that claims nothing limits it
 *      must say so explicitly and take the weight of that claim.
 *   2. `confidence: confirmed` requires evidence whose measurement is not an
 *      estimate. A chars/4 token count can never be confirmed.
 *   3. Cosmetic findings can never outrank a confirmed cost/reliability finding,
 *      regardless of what the arithmetic says.
 *
 * Zero dependencies. Node >= 22.
 */

export const CATEGORIES = {
  context: "CTX",
  usage: "TOK",
  config: "CFG",
  docs: "DOC",
  repo: "REPO",
  git: "GIT",
  performance: "PERF",
};

export const SEVERITIES = ["informational", "low", "medium", "high", "critical"];
export const CONFIDENCES = ["low", "medium", "high", "confirmed"];
export const EFFORTS = ["trivial", "small", "medium", "large"];
export const RISKS = ["low", "medium", "high"];
export const FREQUENCIES = ["once", "per-release", "per-task", "per-session", "per-request"];
export const SCOPES = ["one-file", "one-area", "whole-repo", "every-session", "every-request"];
export const STATUSES = ["open", "planned", "fixed", "wont-fix", "superseded"];

const SEVERITY_WEIGHT = { informational: 0.2, low: 1, medium: 3, high: 8, critical: 20 };
const CONFIDENCE_WEIGHT = { low: 0.25, medium: 0.6, high: 0.85, confirmed: 1 };
const EFFORT_WEIGHT = { trivial: 1, small: 2, medium: 5, large: 12 };
const RISK_WEIGHT = { low: 1, medium: 2.5, high: 6 };
const FREQUENCY_WEIGHT = {
  once: 1,
  "per-release": 1.5,
  "per-task": 2.5,
  "per-session": 4,
  "per-request": 8,
};
const SCOPE_WEIGHT = {
  "one-file": 1,
  "one-area": 2,
  "whole-repo": 4,
  "every-session": 6,
  "every-request": 8,
};

/** Groups, in report order. Cosmetic is always last. */
export const GROUPS = ["quick-win", "engineering", "risky", "measurement-gap", "cosmetic"];

export const GROUP_TITLES = {
  "quick-win": "Quick wins — high impact, low effort, low risk",
  engineering: "High-impact engineering work",
  risky: "Risky changes — need a plan, a gate and a rollback",
  "measurement-gap": "Measurement gaps — what we could not determine",
  cosmetic: "Cosmetic cleanup",
};

const REQUIRED = [
  "title",
  "category",
  "severity",
  "confidence",
  "estimated_impact",
  "estimated_effort",
  "risk",
  "frequency",
  "scope",
  "summary",
  "evidence",
  "measurement_method",
  "recommended_action",
  "validation",
  "rollback",
  "limitations",
];

const ESTIMATE_MARKERS = /\b(estimate|estimated|approx|heuristic|chars\s*\/\s*4|extrapolat)/i;

/** @param {string} field @param {string} value @param {readonly string[]} allowed */
function oneOf(field, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`finding.${field}: "${value}" is not one of ${allowed.join(" | ")}`);
  }
}

/**
 * Validate and normalise a finding. Throws with a specific message — a finding
 * that cannot state its own limits is a bug in the analysis, not a formatting
 * problem to paper over.
 *
 * @param {Record<string, any>} f
 */
export function makeFinding(f) {
  for (const key of REQUIRED) {
    const v = f[key];
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (empty) throw new Error(`finding is missing required field: ${key}`);
  }

  oneOf("category", f.category, Object.keys(CATEGORIES));
  oneOf("severity", f.severity, SEVERITIES);
  oneOf("confidence", f.confidence, CONFIDENCES);
  oneOf("estimated_effort", f.estimated_effort, EFFORTS);
  oneOf("risk", f.risk, RISKS);
  oneOf("frequency", f.frequency, FREQUENCIES);
  oneOf("scope", f.scope, SCOPES);
  if (f.status !== undefined) oneOf("status", f.status, STATUSES);

  if (!Array.isArray(f.evidence) || f.evidence.length === 0) {
    throw new Error(
      "finding.evidence must be a non-empty array — a claim without evidence is a suspicion",
    );
  }
  for (const [i, e] of f.evidence.entries()) {
    if (!e || typeof e.method !== "string" || typeof e.result !== "string") {
      throw new Error(`finding.evidence[${i}] needs { method, result }`);
    }
  }

  if (typeof f.limitations !== "string" || f.limitations.trim().length < 8) {
    throw new Error(
      'finding.limitations must say what was NOT checked. Write "none — <why>" and mean it, but never leave it blank.',
    );
  }

  // Invariant 2: an estimate can never be confirmed.
  if (f.confidence === "confirmed" && ESTIMATE_MARKERS.test(String(f.measurement_method))) {
    throw new Error(
      `finding "${f.title}": confidence "confirmed" contradicts an estimated measurement_method — ` +
        'downgrade to "high" or measure it exactly',
    );
  }

  return {
    id: f.id ?? null,
    title: f.title,
    category: f.category,
    status: f.status ?? "open",
    severity: f.severity,
    confidence: f.confidence,
    estimated_impact: f.estimated_impact,
    estimated_effort: f.estimated_effort,
    risk: f.risk,
    frequency: f.frequency,
    scope: f.scope,
    summary: f.summary,
    evidence: f.evidence,
    measurement_method: f.measurement_method,
    affected_files: f.affected_files ?? [],
    recommended_action: f.recommended_action,
    validation: f.validation,
    rollback: f.rollback,
    limitations: f.limitations,
    cosmetic: f.cosmetic === true,
  };
}

/** priority = impact × confidence × frequency × scope ÷ effort ÷ risk */
export function score(f) {
  const raw =
    (SEVERITY_WEIGHT[f.severity] *
      CONFIDENCE_WEIGHT[f.confidence] *
      FREQUENCY_WEIGHT[f.frequency] *
      SCOPE_WEIGHT[f.scope]) /
    (EFFORT_WEIGHT[f.estimated_effort] * RISK_WEIGHT[f.risk]);
  return Math.round(raw * 100) / 100;
}

/** @param {ReturnType<typeof makeFinding>} f */
export function group(f) {
  if (f.confidence === "low") return "measurement-gap";
  if (f.cosmetic) return "cosmetic";
  if (f.risk === "high") return "risky";
  if (
    (f.estimated_effort === "trivial" || f.estimated_effort === "small") &&
    f.risk === "low" &&
    SEVERITY_WEIGHT[f.severity] >= SEVERITY_WEIGHT.medium
  ) {
    return "quick-win";
  }
  return "engineering";
}

/**
 * Assign stable sequential ids per category, in the order given. Existing ids
 * are preserved so a re-run does not renumber a finding the user has referenced.
 *
 * @param {ReturnType<typeof makeFinding>[]} findings
 */
export function assignIds(findings) {
  /** @type {Record<string, number>} */
  const next = {};
  for (const f of findings) {
    const prefix = CATEGORIES[f.category];
    if (f.id) {
      const n = Number.parseInt(String(f.id).split("-")[1] ?? "0", 10);
      next[prefix] = Math.max(next[prefix] ?? 0, n);
    }
  }
  for (const f of findings) {
    if (f.id) continue;
    const prefix = CATEGORIES[f.category];
    next[prefix] = (next[prefix] ?? 0) + 1;
    f.id = `${prefix}-${String(next[prefix]).padStart(3, "0")}`;
  }
  return findings;
}

/**
 * Rank. Invariant 3 is enforced structurally: cosmetic findings sort into the
 * last group and cannot be lifted out of it by a high score.
 *
 * @param {ReturnType<typeof makeFinding>[]} findings
 */
export function rank(findings) {
  const withMeta = findings.map((f) => ({ ...f, score: score(f), group: group(f) }));
  const groupIndex = (g) => GROUPS.indexOf(g);
  return withMeta.sort((a, b) => {
    if (a.group !== b.group) return groupIndex(a.group) - groupIndex(b.group);
    if (b.score !== a.score) return b.score - a.score;
    return SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity);
  });
}

/** Findings grouped in report order, empty groups omitted. */
export function byGroup(ranked) {
  /** @type {{ group: string, title: string, findings: any[] }[]} */
  const out = [];
  for (const g of GROUPS) {
    const items = ranked.filter((f) => f.group === g);
    if (items.length) out.push({ group: g, title: GROUP_TITLES[g], findings: items });
  }
  return out;
}

/**
 * Turn a script's deterministic `observations[]` into finding drafts. The model
 * completes them — this only guarantees the observation's data survives into
 * `evidence`, so no finding can be written without the number behind it.
 *
 * @param {{ code: string, statement: string, data: unknown }} obs
 * @param {string} method
 */
export function evidenceFrom(obs, method) {
  return {
    method,
    result: `${obs.code}: ${obs.statement} — ${JSON.stringify(obs.data)}`,
  };
}
