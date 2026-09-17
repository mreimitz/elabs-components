---
name: brand-ui-update-theme
description: Use when an existing brand-ui theme family should be improved from new material — updated brand guidelines, a new logo, product screenshots, a live site, feedback like "the green is off" or "match their new design system" — e.g. "update the qlik theme with these links", "refresh our theme from the new brand book", "/update-theme". For a brand with no theme yet, use brand-ui-create-theme.
user-invocable: true
argument-hint: "<existing family> [links, file paths, what should change]"
allowed-tools:
  - WebSearch
  - WebFetch
  - Bash(node *theme-kit.mjs *)
  - Bash(curl -sL *)
  - Bash(pnpm check *)
  - Bash(pnpm gen)
---

# brand-ui-update-theme

Enhance an existing theme family from the resources the person provides — a **per-token
diff**, each change sourced, approved before anything is edited.

**REQUIRED:** read the `brand-ui-create-theme` skill's `reference/research.md` and
`reference/proposal.md` (sibling skill directory). This skill uses the same research method,
proposal format and kit — `<kit>` is the absolute path of
`../brand-ui-create-theme/scripts/theme-kit.mjs` relative to this skill's directory.

## The contract

1. **The existing family is the baseline.** A token changes only when a source supports the
   change or the person asked for it. "Could be nicer" is not a source.
2. **Every change shows current → proposed, a source and a confidence.**
3. **Nothing in the family is edited before the person approves the diff.**
4. **The result passes `node <kit> audit`** (and in the brand-ui source repo,
   `pnpm check --rule community-themes`).

## Steps

### 1 · Read the family as it is

Locate it: `themes/<slug>/` in the brand-ui source repo, the app's theme folder otherwise.
Read every file: `<slug>-light.css` / `<slug>-dark.css`, `<slug>-fonts.css`, `theme.ts`, the
README. The README's source table is the **old ledger** — carry its rows forward, don't
re-derive what was already measured unless the new material contradicts it.

Run `node <kit> audit` on the current stylesheets first so pre-existing failures are
reported as pre-existing, not as regressions of your change.

### 2 · Research the new material

`reference/research.md`, restricted to what the person pointed at plus what it takes to
confirm it (e.g. the new guideline names a colour — check the live product uses it). New
sources get new ledger ids after the old ones.

### 3 · Decide the diff

For each token the new material touches, one of:

| Outcome                           | When                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| **change**                        | a source states a different value, or the person asked             |
| **keep, note conflict**           | the new source disagrees with a `measured` value — ask             |
| **change derived tokens with it** | a changed primary moves its hover/pressed/ring/sidebar-primary too |

Include each changed token in `proposal.json` with `"current"` set to its value in the
family today, `"mode": "update"`. Logo and font changes follow `reference/research.md` §4–5.

### 4 · Draft, audit, propose — then stop

```sh
node <kit> apply --base <family>/<slug>-light.css --name <slug>-light --scheme light \
  --proposal proposal.json --out <scratch>/<slug>-light.css
node <kit> audit <scratch>/<slug>-light.css <scratch>/<slug>-dark.css
node <kit> proposal proposal.json --draft light=<scratch>/<slug>-light.css \
  --draft dark=<scratch>/<slug>-dark.css --out <scratch>/<slug>-update.html
```

Present as `reference/proposal.md` "Presenting it" describes, leading with how many tokens
change per mode, and ask **Approve and write it / Change something / Cancel**.

### 5 · Write (only after Approve)

1. Replace the family's stylesheets with the approved drafts. With the family's own
   stylesheet as `--base`, the kit edits values in place, so its comments survive.
2. Update the README: the "reproduces" table rows and the source ledger for every changed
   value; keep untouched rows.
3. Logo or font changes: update the tokens in both modes, the fonts file and licence file.
4. Verify: `node <kit> audit …`; in the brand-ui source repo also
   `pnpm check --rule community-themes` and `pnpm gen`. Read the counts, not only the exit
   code.

## Report

How many tokens changed and the three most visible changes, in plain words; what was kept
despite new material and why; open questions; under Problems every failed source and any
pre-existing audit failure you did not fix.

## Common mistakes

| Mistake                                               | Instead                                            |
| ----------------------------------------------------- | -------------------------------------------------- |
| Re-generating the whole family from scratch           | Base the drafts on the family's own stylesheets    |
| Changing tokens the new material never mentions       | Leave them; only sourced or requested changes      |
| Changing `--primary` but not its hover/ring/sidebar   | Move the derived tokens with it, marked `derived`  |
| Dropping the old README ledger                        | Carry old rows forward; add new sources after them |
| Blaming a pre-existing contrast failure on the update | Audit the family before changing it                |
