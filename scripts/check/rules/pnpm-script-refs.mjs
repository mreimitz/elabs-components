/**
 * pnpm-script-refs — a `pnpm <script>` named in code, config or docs must exist.
 * The governance simplification folded ~200 npm scripts into `check`, `check:test`
 * and `gen`; fix-it messages kept printing the old names (`run pnpm manifest`), a
 * dead end for a human or agent following them. A name with a `:` (or one of the
 * removed bare names) must be a script in the root or any workspace package.json.
 * Dated records (ADRs, rules history, reviews, changelogs) are exempt.
 */

/** Bare (colon-less) script names that used to exist; other bare words are prose ("pnpm reads"). */
const REMOVED_BARE = new Set(["manifest", "gates", "agent-docs", "inventory", "llms", "context"]);

const EXEMPT = [
  /(^|\/)node_modules\//,
  /^docs\/(ADR|rules-history|decisions|superpowers|review)\//,
  /(^|\/)CHANGELOG[^/]*$/,
  /^LEDGER\.md$/,
  /^\.changeset\//,
  /^brand-ui\.manifest\.json$/,
];

const TEXT_EXT = /\.(m?js|cjs|tsx?|mdx?|ya?ml|json|sh)$|(^|\/)pre-commit$/;

const REF_RE = /\bpnpm (?:run )?([a-z][a-z0-9-]*(?::[a-z0-9-]+)*)/g;

export function workspaceScripts(ctx) {
  const names = new Set(Object.keys(ctx.json("package.json").scripts ?? {}));
  for (const rel of ctx.glob(["packages/*/package.json", "apps/*/package.json"])) {
    for (const k of Object.keys(ctx.json(rel).scripts ?? {})) names.add(k);
  }
  return names;
}

export function findDeadRefs(text, scripts) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const [, name] of lines[i].matchAll(REF_RE)) {
      if (!name.includes(":") && !REMOVED_BARE.has(name)) continue;
      if (!scripts.has(name)) hits.push({ line: i + 1, name });
    }
  }
  return hits;
}

const pkg = (scripts) => JSON.stringify({ scripts });

export default {
  id: "pnpm-script-refs",
  scope: "repo",
  doc: "A `pnpm <script>` named in code, config or docs must be a real script (root or workspace package); dated records are exempt.",
  baseline: "per-file",
  run(ctx) {
    const scripts = workspaceScripts(ctx);
    const out = [];
    for (const rel of ctx.gitFiles()) {
      if (!TEXT_EXT.test(rel) || EXEMPT.some((re) => re.test(rel))) continue;
      let text;
      try {
        text = ctx.readFile(rel);
      } catch {
        continue;
      }
      for (const { line, name } of findDeadRefs(text, scripts))
        out.push({
          file: rel,
          line,
          msg: `\`pnpm ${name}\` is not a script — use \`pnpm check --rule <id>\`, \`pnpm check:test\` or \`pnpm gen\``,
        });
    }
    return out;
  },
  fixtures: {
    pass: [
      {
        files: {
          "package.json": pkg({ check: "x", "gen:check": "x" }),
          "packages/tokens/package.json": pkg({ "tokens:build": "x" }),
          "scripts/a.mjs":
            "// run `pnpm gen:check`, then `pnpm --filter t tokens:build`; pnpm reads the lockfile",
          "packages/ui/README.md": "pnpm tokens:build",
          "docs/ADR/0001-x.md": "pnpm gates:selftests",
        },
      },
    ],
    fail: [
      {
        files: {
          "package.json": pkg({ gen: "x" }),
          "scripts/check/rules/x.mjs": "msg: 'manifest missing — run `pnpm manifest`'",
        },
      },
      {
        files: {
          "package.json": pkg({ check: "x" }),
          ".claude/commands/release.md": "Run pnpm css-assets:check first.",
        },
      },
    ],
  },
};
