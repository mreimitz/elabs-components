# Gates

Automated checks keep the repo's conventions true. Three commands cover all of them.

```bash
pnpm check        # every convention rule + the external check commands
pnpm check:test   # every rule's pass/fail fixtures + every scripts/**/*.test.mjs self-test
pnpm gen:check    # every generated artifact is fresh (pnpm gen rewrites them)
```

- `pnpm check` runs `scripts/check/rules/*.mjs` in one process against
  `scripts/check/baseline.json` (ratchets only go down; `pnpm check:update`), then spawns the
  few checks that need node_modules or their own CLI (`scripts/check/commands.mjs`) in
  parallel. `--rule <id>` / `--scope <scope>` narrow a run; `--list` prints every id.
- `pnpm check:test` proves each check still fails on a planted violation.
- `pnpm check:changed` is the fast local loop: typecheck + lint + test for changed packages.

The full rule list is the generated region of `.claude/rules/conventions.md`
(`pnpm check --list` prints the same set).

## Adding a check

A convention that reads repo files becomes a rule: follow `scripts/check/README.md`. A check
that needs node_modules, a build tool or its own CLI becomes an entry in
`scripts/check/commands.mjs`. Either way its docs line lands in conventions.md via `pnpm gen`.

## CI (`.github/workflows/ci.yml`)

Job `quality`, in order: install → typecheck → lint → format:check → `pnpm check` →
`pnpm check:test` → test → build → built-output checks (`scripts/check-css-assets.mjs`,
`scripts/check-optional-peer-types.mjs`, which read `dist/`) → `pnpm gen:check` →
`pnpm consumer:check`.

Job `storybook` (blocking, `light` and `dark`): every story as an interaction + axe test.

The pre-commit hook (`.githooks/pre-commit`) adds commit-time teeth: staged conflict
markers, dependency-field moves, registry validity, and Prettier on staged files.
