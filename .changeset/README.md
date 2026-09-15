# Changesets

Every PR that changes what a consumer of `@elabs-ai/components-*` gets adds one changeset:

```bash
pnpm changeset          # pick the bump (patch / minor / major) and write one consumer-facing line
```

All distributable packages are one `fixed` group in `config.json`, so they always share a
version (lockstep). Merging to `main` opens or updates a "Version Packages" PR; merging that
PR publishes. Procedure: [`docs/RELEASING.md`](../docs/RELEASING.md).
