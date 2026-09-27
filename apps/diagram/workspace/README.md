# Atlas workspace

This folder is Atlas's document store (plan `docs/2026-09-27-atlas-v2-plan.md`, V5/V6). The
app reads and writes it through the dev server's `/api/workspace/*` middleware
(`server/workspace-plugin.mjs`, built on `server/workspace-fs.mjs`); there is no other
backend. Everything here is plain YAML, versioned by Git like the rest of the repo.

## What lives here

- `components/` — reusable sub-diagrams. Any diagram becomes a component by moving it here.
- `examples/` — the four v1 example diagrams (moved from `src/examples/` in DG-21).
- Any other folder you create — free-form folders of diagrams (`customers/acme/…`).
- `<name>.thumb.png` beside a diagram — its thumbnail, written by the app after a clean
  autosave (a 480×270 PNG, light theme, about 25 KB). Versioned with the diagram.

## The two rules

1. **`components/` is the only root `use:` resolves from.** `use: components/<path>` in a
   diagram points at `components/<path>.yaml`; nothing outside `components/` can be
   referenced.
2. **`_trash/` is where deleted files go, and it is git-ignored.** Deleting a diagram or a
   folder moves it to `_trash/<timestamp>-<name>`; nothing is ever removed from disk by the
   app. Empty `_trash/` yourself when you are sure.

## How saving works

The file is the truth: the app autosaves the editor text 800 ms after the last change, even
when it does not compile. An edit made in another editor (or by an LLM session through the
MCP server) reloads in the open tab. Versions come from `git log` for the file.
