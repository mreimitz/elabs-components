# Paused surfaces (kept as source, excluded from everything)

Some parts of this repo are **experimental and on hold**. A paused surface is
**not deleted** — the source stays exactly where it is, unmodified — but nothing
in the repo _enumerates_ it any more: no test, no gate, no story, no doc, no app,
no release.

This is a maintainer decision, not a technical one. **Un-pausing is the
maintainer's call and nobody else's** — do not "helpfully" restore a paused
surface because a gate would be simpler, a sweep would be more complete, or the
code looks abandoned. It is paused on purpose.

## What is paused right now

| Surface                       | Kind    | Paused     | Why                                                                           |
| ----------------------------- | ------- | ---------- | ----------------------------------------------------------------------------- |
| `blueprint` theme             | theme   | 2026-08-09 | Experimental / testing theme. Kept in `themes.css`, out of `BUILT_IN_THEMES`. |
| `@elabs/components-blueprint` | package | 2026-08-09 | Drawing furniture for that theme — frozen with it.                            |

**The decoration dial is NOT paused.** `--decoration` (0–10), `decoration.css`,
`DecorationProvider`/`useDecoration`, `data-decoration`, and the
`decoration:check` / `decoration-collapse:check` gates all stay fully live and
enforced. The dial is hue-independent and orthogonal to color — it rides
`light` and `dark` exactly as designed
(@.claude/rules/blueprint-decoration.md). Only the navy `blueprint` _theme_ and
its furniture _package_ are on hold.

## The rule

For anything in the table above:

1. **Never enumerate it.** It is absent from `BUILT_IN_THEMES`, `BUILT_IN_THEME_META`, every
   `describe.each` / theme loop, every gate's theme list, every Storybook
   toolbar, every "sweep across the themes" instruction.
2. **Never test or validate it.** No unit test, no contrast test, no story, no
   `test-storybook` run, no a11y pass, no visual sweep asserts anything about it.
   A red result from a paused surface is not a finding — it is out of scope.
3. **Never release it.** A paused package is `private: true` and is not built,
   packed, published, version-bumped or mentioned in release notes. A paused
   theme is not part of any release claim.
4. **Never update it.** Do not refactor, re-token, re-format, migrate, or fix
   lint/a11y/contrast findings inside a paused surface — not even as drive-by
   cleanup while working nearby, and not to make an unrelated gate pass. If a
   repo-wide codemod would touch it, exclude it.
5. **Do not delete it.** Pause is reversible by design. The CSS block, the
   package directory and its git history stay.
6. **Two themes is the correct count.** The theme sweep is `light` +
   `dark` — write "both themes". Any doc still claiming the older,
   higher count fails `pnpm docs:check`, which derives the number from `BUILT_IN_THEMES`.

## Where "paused" is declared (one place each)

- **Themes** — `PAUSED_THEMES` in `packages/tokens/src/theme-types.ts`. That
  array is the single source of truth for TypeScript **and** for every `.mjs`
  gate, which read it through `scripts/lib/paused-surfaces.mjs`. It is also
  re-exported from `@elabs/components-tokens` (`PAUSED_THEMES`,
  `isPausedThemeName`) so a consumer can see what is on hold.
- **Packages** — `PAUSED_PACKAGES` in `scripts/lib/paused-surfaces.mjs`, plus
  `private: true` in the package's own `package.json`.

**Never hard-code the literal `"blueprint"` in a filter.** Import
`isPausedTheme` / `withoutPausedThemes` / `PAUSED_PACKAGES` instead. A
hand-copied list is what makes un-pausing a scavenger hunt; a single source
makes it a one-line edit.

## Un-pausing (when the maintainer says so)

1. Move the name out of `PAUSED_THEMES` into `BUILT_IN_THEMES` and restore its
   `BUILT_IN_THEME_META` entry (the entry's former contents are recorded in a comment
   right where it was removed).
2. For a package: drop `private: true`, restore its `build` / `test` /
   `typecheck` / `lint` scripts, re-add it to the Storybook stories glob and to
   any consumer that used it, remove it from `PAUSED_PACKAGES`.
3. Run the full battery. Every gate re-enumerates it automatically — that is the
   point of the single source of truth.

## Enforce (a convention ships with its teeth)

`pnpm paused:check` (`scripts/check-paused-surfaces.mjs`, self-tested via
`pnpm paused:check:test`, blocking in `gates.yml`) fails when:

- a paused theme name reappears in `BUILT_IN_THEMES`, `BUILT_IN_THEME_META`, the Storybook theme
  globals, a `*.stories.tsx` theme arg, a playbook/template, or a fixture app;
- a paused theme's `[data-theme="…"]` block has been **deleted** from
  `themes.css` (pause ≠ delete — the source must survive);
- a paused package is not `private: true`, still declares a `build`/`test`/
  `typecheck`/`lint` script, is depended on by any app/fixture/package, or its
  stories are still inside the Storybook glob;
- a shipped doc still claims the pre-pause theme count, or names a paused theme
  in a sweep instruction (`globals=theme:<paused>`); this arm overlaps
  `pnpm docs:check`, which derives the count from `BUILT_IN_THEMES` on its own.

The gate deliberately does **not** scan `packages/blueprint/**` itself, `CHANGELOG.md`,
`docs/ADR/**` or `research/**` — a paused surface's own source, the historical
record and past decisions legitimately keep the name.

See @.claude/rules/quality-gates.md ("Enforcement over reminders").
