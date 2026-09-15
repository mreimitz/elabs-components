/**
 * commands.mjs — checks that cannot be runner rules, run by `pnpm check` as child processes.
 *
 * A rule reads repo files through `ctx`. These need something a rule must not touch:
 * node_modules (module resolution), an in-package build tool, or a script with its own CLI.
 * `run.mjs` spawns them in parallel after the rules when no `--rule`/`--scope` filter is
 * given (or when `--rule <id>` names one), and reports them in the same ✔/✖ style.
 *
 * `cmd` is argv, run from the repo root; a leading "node" means the current Node binary.
 *
 * Deliberately NOT here (CI runs them elsewhere):
 *   - scripts/check-css-assets.mjs, scripts/check-optional-peer-types.mjs — read the BUILT
 *     dist/ (a missing dist is skipped, so running them before a build proves nothing):
 *     CI runs both right after `pnpm build`.
 *   - scripts/check-conflict-markers.mjs — its full-tree scan IS the `conflict-markers`
 *     rule; the script stays for the pre-commit hook's `--staged` mode.
 *   - scripts/check-package-json-dep-moves.mjs — reads the git index (pre-commit only).
 */

/** @type {{ id: string, cmd: string[], doc: string }[]} */
export const COMMANDS = [
  {
    id: "registry-validate",
    cmd: ["node", "scripts/validate-registry.mjs"],
    doc: "Keep `registry/registry.json` a valid shadcn registry: unique named items, valid types, real https homepage, every listed file on disk.",
  },
  {
    id: "token-contract",
    cmd: ["node", "packages/tokens/scripts/gen-theme-token-names.mjs", "--check"],
    doc: "Keep the shipped theme token contract (`THEME_TOKEN_NAMES`) in sync with the theme stylesheets.",
  },
  {
    id: "tokens-fresh",
    cmd: ["node", "scripts/check-tokens-fresh.mjs"],
    doc: "Author token values in the DTCG source (`packages/tokens/tokens/`); the generated theme stylesheets must match a fresh `tokens:build`.",
  },
  {
    id: "tt-aliases-resolve",
    cmd: ["node", "scripts/check-tt-aliases.mjs"],
    doc: "The Trusted-Types alias snippet in docs/CSP-AND-NETWORK.md must resolve (in node_modules) to each package's DOM-free build.",
  },
  {
    id: "version-sync",
    cmd: ["node", "scripts/sync-version-extras.mjs", "--check"],
    doc: "Keep the root, plugin manifests and MCP `SERVER_INFO` versions equal to the fixed package group's version.",
  },
];
