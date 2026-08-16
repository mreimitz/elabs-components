/**
 * workflow-gates.mjs — read the `pnpm <gate>` set a GitHub workflow actually runs.
 *
 * Used by `check-release-gates.mjs` (the ci.yml ↔ release.yml parity gate, #103)
 * and `write-release-report.mjs` (the stored validation report, #103/#71). Both
 * need the same answer — "which gates does this ref run, following reusable
 * `workflow_call` jobs?" — so the parsing lives once.
 *
 * Deliberately a small, dependency-free line scanner rather than a YAML parser:
 * the repo ships no YAML dependency, and the shapes it must understand are
 * narrow (`run:` scalars, `run: |` blocks, `uses: ./.github/workflows/x.yml`,
 * `continue-on-error:`). It strips whole-line `#` comments first, so the prose in
 * ci.yml's extensive step comments can never be mistaken for a command.
 *
 * TWO RULES every caller must follow, because breaking either fabricates gates:
 *
 *   1. Scan COMMANDS, not raw YAML. Always go `runCommands(yaml)` first and match
 *      `pnpmGates`/`filterGates` per command. Matching the gate regexes against a
 *      whole workflow slice picks up `pnpm` mentioned in a step NAME or a header
 *      comment; `write-release-report.mjs` did exactly that and recorded
 *      `version:set` (a writer, named only in release.yml's header comment) and
 *      `uses:` (the YAML key on the line after `- name: Setup pnpm`) as gates that
 *      "passed".
 *   2. A gate name is only a gate when it is the command being RUN. The regexes
 *      are anchored to the start of a shell segment (see `pnpmInvocation`), and
 *      their inter-token whitespace class is horizontal-only (`[^\S\r\n]`) so a
 *      match cannot span a line break. Belt and braces, because the artifact this
 *      feeds is attached to every GitHub Release as proof a version was validated.
 */

/** Shell verbs that are not gates: package management, not quality checks. */
export const NON_GATE_COMMANDS = new Set([
  "install",
  "dlx",
  "exec",
  "pack",
  "publish",
  "add",
  "run",
  "store",
  "why",
]);

/** Drop whole-line `#` comments (the only comment form these workflows use in prose). */
export function stripComments(yamlText) {
  return yamlText
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

/**
 * Every `run:` command in a workflow chunk — inline scalars AND `run: |` blocks.
 * Returns the raw shell strings.
 */
export function runCommands(yamlChunk) {
  const lines = stripComments(yamlChunk).split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!m) continue;
    const [, indent, value] = m;
    if (value && !/^[|>]/.test(value.trim())) {
      out.push(value.trim());
      continue;
    }
    // Block scalar: consume the more-indented lines that follow.
    const baseIndent = indent.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      const lead = lines[j].match(/^\s*/)[0].length;
      if (lead <= baseIndent) {
        i = j - 1;
        break;
      }
      out.push(lines[j].trim());
      i = j;
    }
  }
  return out;
}

/**
 * Shell segments of one command line: `a && b ; c | d` → ["a", "b", "c", "d"].
 * The gate regexes are anchored per segment, so `pnpm <x>` only counts when it
 * is the command being RUN — never when it appears inside an argument.
 */
export function shellSegments(cmd) {
  return String(cmd).split(/&&|\|\||;|\|/);
}

/** Leading `FOO=bar ` env assignments, which still leave `pnpm` the command. */
const LEADING_ENV_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*[^\S\r\n]+)*/;

/** The segment with its leading whitespace/env prefix removed, iff it RUNS pnpm. */
function pnpmInvocation(segment) {
  const s = segment.replace(/^[^\S\r\n]+/, "").replace(LEADING_ENV_RE, "");
  return /^pnpm[^\S\r\n]/.test(s) ? s : null;
}

/**
 * Gate names invoked as `pnpm <gate>` in a chunk of shell.
 * The leading character must be alphanumeric, so `pnpm -r publish` and
 * `pnpm --filter …` (which are not root gate names) are never captured — the
 * latter is handled by `filterGates`.
 *
 * Two anti-fabrication rules, both of which the original scanner broke:
 *   - the whitespace class is horizontal-only (`[^\S\r\n]`), so a match cannot
 *     span a line break (`- name: Setup pnpm` + `uses: pnpm/action-setup@v4`
 *     used to yield a gate literally called `uses:`);
 *   - the match is ANCHORED to the start of a shell segment, so a gate named
 *     inside an argument is not an invocation — release.yml's tag-mismatch
 *     `echo "::error::… run 'pnpm version:set $tag' first"` used to record
 *     `version:set` (a WRITER) as a gate that passed.
 */
export function pnpmGates(shell) {
  const gates = new Set();
  for (const segment of shellSegments(shell)) {
    const inv = pnpmInvocation(segment);
    if (!inv) continue;
    const m = inv.match(/^pnpm[^\S\r\n]+([A-Za-z0-9][A-Za-z0-9:_-]*)/);
    if (m && !NON_GATE_COMMANDS.has(m[1])) gates.add(m[1]);
  }
  return gates;
}

/**
 * Workspace-scoped gate steps: `pnpm --filter <pkg> <script>`.
 *
 * These are blocking gate steps too — `pnpm --filter …-docs test-storybook` is
 * the interaction-test gate, blocking on PRs since #280 — but `pnpmGates` cannot
 * see them (the token after `pnpm` is `--filter`). Without them the parity gate
 * printed "all N blocking gates" while an entire blocking job was invisible.
 *
 * The identity is the command form itself (`--filter <pkg> <script>`) so it
 * renders as a real command wherever a gate name is printed: the validation
 * report's `pnpm <name>` list and the AGENTS.md contract lookup both work
 * unchanged. `exec`/`install`/… are excluded, same as for a root gate.
 */
export function filterGates(shell) {
  const gates = new Set();
  const re = /^pnpm[^\S\r\n]+--filter[^\S\r\n]+(\S+)[^\S\r\n]+([A-Za-z0-9][A-Za-z0-9:_-]*)/;
  for (const segment of shellSegments(shell)) {
    const inv = pnpmInvocation(segment);
    if (!inv) continue;
    const m = inv.match(re);
    if (m && !NON_GATE_COMMANDS.has(m[2])) gates.add(`--filter ${m[1]} ${m[2]}`);
  }
  return gates;
}

/** Split a workflow into its top-level jobs: `[{ name, body }]`. */
export function splitJobs(yamlText) {
  const text = stripComments(yamlText);
  const headerRe = /^ {2}([A-Za-z0-9_-]+):\s*$/gm;
  const heads = [...text.matchAll(headerRe)];
  const jobsIdx = text.search(/^jobs:\s*$/m);
  const jobs = [];
  for (let i = 0; i < heads.length; i++) {
    if (jobsIdx >= 0 && heads[i].index < jobsIdx) continue;
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    jobs.push({ name: heads[i][1], body: text.slice(heads[i].index, end) });
  }
  return jobs;
}

/** Local reusable-workflow targets a job calls: `uses: ./.github/workflows/x.yml`. */
export function reusableCalls(jobBody) {
  return [...jobBody.matchAll(/uses:\s*\.\/(\.github\/workflows\/[A-Za-z0-9._-]+)/g)].map(
    (m) => m[1],
  );
}

/** A job that is `continue-on-error: true` cannot fail the run — it is not a gate. */
export function isBlockingJob(jobBody) {
  return !/^\s*continue-on-error:\s*true\s*$/m.test(jobBody);
}

/**
 * The jobs a job declares as `needs:` — the ORDERING edge. All three YAML forms:
 *
 *   needs: gates
 *   needs: [gates, build]
 *   needs:
 *     - gates
 *
 * Set parity between two workflows says nothing about order: a release whose
 * publish job does not `needs:` the battery reaches the identical gate set and
 * runs it CONCURRENTLY with `pnpm -r publish`, so a red gate no longer stops the
 * release. That is why this is parsed rather than assumed.
 */
export function jobNeeds(jobBody) {
  // `needs: gates # a red gate stops the release` is the real shape in this repo,
  // and `stripComments` only drops WHOLE-line comments — so the trailing one has
  // to go, or the dependency reads as a job literally named "gates # a red …".
  const clean = (s) => s.replace(/[^\S\r\n]+#.*$/, "").trim();
  const m = stripComments(jobBody).match(/^(\s*)needs:[^\S\r\n]*(.*)$/m);
  if (!m) return [];
  const [, indent, inline] = m;
  const value = clean(inline);
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");
  if (value.startsWith("[")) {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(unquote)
      .filter(Boolean);
  }
  if (value) return [unquote(value)];
  // Block sequence on the following, more-indented lines.
  const lines = stripComments(jobBody).split("\n");
  const start = lines.findIndex((l) => /^\s*needs:[^\S\r\n]*(#.*)?$/.test(l));
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const lead = lines[i].match(/^\s*/)[0].length;
    const item = clean(lines[i]).match(/^-\s*(.+)$/);
    if (lead <= indent.length || !item) break;
    out.push(unquote(item[1]));
  }
  return out;
}

/** Is this ONE command a `pnpm … publish …` invocation? */
export function isPublishCommand(cmd) {
  for (const segment of shellSegments(cmd)) {
    const inv = pnpmInvocation(segment);
    if (inv && /(^|[^\S\r\n])publish([^\S\r\n]|$)/.test(inv)) return true;
  }
  return false;
}

/** Does this job actually publish packages (`pnpm … publish …`)? */
export function isPublishJob(jobBody) {
  return runCommands(jobBody).some(isPublishCommand);
}

/** Does this job delegate to the reusable battery at `gatesPath`? */
export function callsGatesWorkflow(jobBody, gatesPath = ".github/workflows/gates.yml") {
  return reusableCalls(jobBody).includes(gatesPath);
}

/** The default gate that proves the battery already passed on the tagged commit. */
export const VERDICT_GATE = "release-verdict:check";

/**
 * The ORDERING invariant the whole release design rests on: nothing is published
 * until the blocking battery's verdict for THIS commit has been checked.
 *
 * Until 2026-08-10 the invariant was structural — release.yml re-ran the battery
 * itself and the publish job declared `needs:` on it, so GitHub enforced the
 * order. That cost 29 of a 38-minute release re-deriving a verdict `main`'s own
 * CI was producing concurrently for the identical commit, so the release now
 * REQUIRES the verdict instead of reproducing it (see
 * `scripts/check-release-verdict.mjs`).
 *
 * Trading a `needs:` edge for a step is a real loss of enforcement — GitHub
 * guaranteed the old one, and only this assertion guarantees the new one. So the
 * position is checked, not just the presence: a verdict step that runs AFTER
 * `pnpm -r publish` is worth exactly nothing, and is the single most likely way
 * for this design to rot.
 *
 * Accepts either shape:
 *   - the gate runs as a STEP in the publishing job, before the publish step;
 *   - the gate runs in a SEPARATE job the publishing job declares `needs:` on.
 *
 * Returns `{ ok, error, publishJob, where }`. Pure — exported for the self-test.
 */
export function checkPublishRequiresVerdict(releaseYml, { verdictGate = VERDICT_GATE } = {}) {
  const jobs = splitJobs(releaseYml);
  const publishJob = jobs.find((j) => isPublishJob(j.body));
  if (!publishJob) {
    return {
      ok: false,
      publishJob: null,
      where: null,
      error:
        "no job in release.yml runs a `pnpm … publish` step — either the publish moved, or this " +
        "check has gone vacuous and would no longer notice a publish that skips the verdict",
    };
  }

  const cmds = runCommands(publishJob.body);
  const verdictAt = cmds.findIndex((c) => gatesInCommand(c).has(verdictGate));
  const publishAt = cmds.findIndex(isPublishCommand);

  if (verdictAt >= 0 && verdictAt < publishAt) {
    return { ok: true, error: null, publishJob: publishJob.name, where: "step" };
  }
  if (verdictAt >= 0) {
    return {
      ok: false,
      publishJob: publishJob.name,
      where: null,
      error:
        `\`pnpm ${verdictGate}\` runs AFTER \`pnpm -r publish\` in job \`${publishJob.name}\` — ` +
        "npm versions are immutable, so a verdict checked after the fact cannot stop anything",
    };
  }

  // The gate may legitimately live in its own job the publish depends on.
  const needs = jobNeeds(publishJob.body);
  for (const name of needs) {
    const dep = jobs.find((j) => j.name === name);
    if (dep && runCommands(dep.body).some((c) => gatesInCommand(c).has(verdictGate))) {
      return { ok: true, error: null, publishJob: publishJob.name, where: `needs: ${name}` };
    }
  }

  return {
    ok: false,
    publishJob: publishJob.name,
    where: null,
    error:
      `the publishing job \`${publishJob.name}\` never runs \`pnpm ${verdictGate}\`` +
      (needs.length ? `, nor does any job it needs (${needs.join(", ")})` : "") +
      " — so nothing checks that the blocking battery passed on the commit being published",
  };
}

/** Every gate identity a single shell command invokes (root + workspace-scoped). */
export function gatesInCommand(cmd) {
  return new Set([...pnpmGates(cmd), ...filterGates(cmd)]);
}

/**
 * Every gate step (`pnpm <gate>` and `pnpm --filter <pkg> <script>`) reachable
 * from a workflow, following local reusable workflows. Non-blocking jobs are
 * skipped unless `includeNonBlocking` is set.
 *
 * `readWorkflow(relPath)` returns the referenced workflow's text, or null.
 */
export function collectGates(
  yamlText,
  { readWorkflow = () => null, includeNonBlocking = false, seen = new Set() } = {},
) {
  const gates = new Set();
  for (const job of splitJobs(yamlText)) {
    if (!includeNonBlocking && !isBlockingJob(job.body)) continue;
    for (const cmd of runCommands(job.body)) {
      for (const g of gatesInCommand(cmd)) gates.add(g);
    }
    for (const rel of reusableCalls(job.body)) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      const text = readWorkflow(rel);
      if (!text) continue;
      for (const g of collectGates(text, { readWorkflow, includeNonBlocking, seen })) {
        gates.add(g);
      }
    }
  }
  return gates;
}

/**
 * Gates ci.yml enforces on a PR that the release tag path cannot reach.
 * Pure set difference — exported so the self-test can drive it with fixtures.
 */
export function missingFromRelease(ciGates, releaseGates) {
  return [...ciGates].filter((g) => !releaseGates.has(g)).sort();
}
