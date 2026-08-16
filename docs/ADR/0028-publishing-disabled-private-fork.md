# ADR 0028 — Publishing is disabled (private fork, no registry, no remote)

> **Superseded.** The fork now has a remote, is going public, and publishes
> `@elabs-ai/*` to npmjs.org. See [ADR 0030](./0030-public-npm-distribution.md) for
> what holds today. The reasoning below is kept as the record of why the
> machinery was left dormant rather than deleted — which is what made re-enabling
> it a configuration change instead of a rebuild.

- **Status:** Superseded by [ADR 0030](./0030-public-npm-distribution.md) (2026-08-17)
- **Date:** 2026-08-16
- **Supersedes:** ADR [0016](./0016-distribution-via-github-packages.md)

## Context

This repository is a **private fork**. It has no git remote, no `.github/`
workflows, and no scoped registry mapping in `.npmrc`. Every package is consumed
from the workspace (`workspace:*`), never installed from a registry.

ADR 0016 built a real publishing pipeline on GitHub Packages, and the machinery
it introduced is still here: `publishConfig.exports`, the version-lockstep gate,
the consumer install smoke test, the release scripts. What is gone is the
_target_ — there is nothing to publish to and nothing to publish from.

That mismatch was not harmless. Three gates in the battery asserted publish
readiness against a registry the repo is not configured for, so they reported
blockers for a publish nobody can perform. A gate that is red for a reason no one
can act on is worse than no gate: it trains people to skim past red.

## Decision

**Publishing is off, and the gates that depend on it skip rather than fail.**

1. **No registry.** `.npmrc` declares no scoped registry. `publishConfig.registry`
   is removed from every package. `REGISTRY_URL` in `packages/cli/lib/engine.mjs`
   is `null`, so a scaffolded standalone app is handed the local-tarball recipe
   instead of an install line it could never run.
2. **No repo identity.** The `repository` field is removed from every package
   manifest, and `registry.json`'s `homepage` is omitted — a URL that resolves to
   nothing is worse than an absent one, which is exactly what the validator's
   placeholder rule already says. `homepage` is now **optional; validated when
   present**.
3. **Gates skip on a missing target, they do not fail.**
   - `pnpm publish-ready:check` reads the publish target **from `.npmrc`** rather
     than hard-coding it, and skips when no scope mapping exists.
   - `pnpm release-gates:check` skips when there is no `.github/workflows`.
   - Neither gate's rules were deleted. Both remain fully wired and self-tested.

**Re-enabling publishing is one line plus a remote:** add
`@<scope>:registry=<url>` to `.npmrc`, restore `repository` +
`publishConfig.registry`, set `REGISTRY_URL`, and the whole preflight battery
comes back on by itself. That is the property this decision is designed to keep.

## Alternatives considered

| Option                                    | Why not                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Delete the publishing machinery**       | Irreversible, and a fork may well publish later under its own scope. Skipping keeps every rule and self-test intact at no runtime cost.               |
| **Leave the gates red**                   | Ten red gates that no one can fix is how a battery stops being read. Honest dormancy beats permanent noise.                                           |
| **Point everything at a placeholder URL** | Mints URLs that resolve to nothing — the precise failure `validate-registry.mjs`'s placeholder rule exists to catch. Absent is truthful; fake is not. |

## Consequences

**Better.** The battery is honest: a red gate means something actionable. Nothing
in the repo claims a registry, an org, or a remote that does not exist.

**Worse.** A standalone (outside-monorepo) scaffold can no longer `pnpm add` the
packages; it consumes local tarballs from `pnpm -r pack`. That is a real
regression in convenience, and it is the direct cost of having no registry.

**Watch for.** `publish-ready:check` and `release-gates:check` now have a
**skip** path, so a green run does not prove the publish rules hold — only that
they were not applicable. When a registry returns, confirm both gates actually
report rather than skip before trusting the first release.

## References

- ADR [0016](./0016-distribution-via-github-packages.md) — the superseded
  publishing decision and the scope rename it forced
- `docs/CONSUMING.md` — how packages are consumed without a registry
- `scripts/check-publish-ready.mjs` · `scripts/check-release-gates.mjs`
