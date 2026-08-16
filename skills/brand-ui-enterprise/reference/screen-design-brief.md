# Screen design brief — the design-first ritual

The fix for a different failure mode than object modeling: screens built
**function-first**, visual design treated as styling applied afterward, components
assembled because they exist rather than chosen ("list + card slop"), no references
looked at, no illustration/motion/voice pass, states retrofitted instead of designed.
Run this checklist before scaffolding **any** net-new screen, page, or major surface —
it is the per-screen gate step 4 of the main procedure requires before composing from
`@elabs-ai/components-*`.

## 1 · Intent, in one sentence

Who opens this screen, and what do they leave with — an answer, a decision, a
completed task? "A list of orders" is not an intent; "Tells ops which orders need
action today" is. Write the sentence before anything else; if you can't, the screen
isn't defined yet.

## 2 · References, proactively

Name 2–3 comparable products (or comparable screens elsewhere in the same app) and
what they do that this screen should match or beat. Look first — don't wait to be
handed a link.

## 3 · 2–3 distinct concepts, not one composition

Generate 2–3 **conceptually different** approaches to the screen (e.g. "reading desk"
vs "mission control" vs "guided wizard") — not three arrangements of the same idea.
Score each against the intent sentence, not against ease of building. State a
recommendation and why before building anything.

## 4 · Mock the recommended concept before wiring real data

Render the chosen concept as a story (or an equivalent throwaway preview) before it
becomes a real route/page. Confirm hierarchy and spacing read right before the state
grid and real data land on top of it — a mock is far cheaper to redo than wired code.

## 5 · Design the full state grid WITH the happy path

Every screen ships five states, designed together, never retrofitted: **Ready ·
Loading · Empty · Error · First-run**.

- **Loading** → a layout-shaped skeleton (`Skeleton`), never a spinner over blank
  space.
- **Empty** → `StatePanel`/`EmptyState` (icon + title + one sentence + one action),
  never a blank region or a dashed box.
- **Error** → `StatePanel`/`ErrorState` (what happened + how to fix it), never a raw
  stack trace, and only for a terminal, settled failure — not while data is still
  loading.
- **First-run** → a purposeful onboarding moment, not the empty state relabeled.

See `principles.md`'s state row (default · hover · focus · active · disabled ·
loading · empty · error) for the full per-control version of the same idea.

## 6 · The non-component layers

Decide on purpose, out loud, for each before calling the screen done:

- **Illustration** — does this moment (empty/first-run/success) deserve one, or is
  text enough? Don't force one; reach for restraint over decoration.
- **Motion** — what state change must be _felt_ (a save landing, a row appearing)?
  Keep it fast (roughly under 200ms) and safe for reduced-motion preferences.
- **Voice/microcopy** — is the copy fix-oriented and specific, or a generic
  "Something went wrong"? Specific copy is part of the design, not a later pass.
- **Information hierarchy** — what reads first on the screen — is that actually the
  highest-value region for the task? → `information-priority-and-emphasis.md`.

## 7 · Close with a review, not a compile

A screen is not done at green typecheck. Route it through `brand-ui-audit` (scored
UX/a11y review, register = product/professional) and confirm keyboard operability,
visible focus, and labels before calling it shipped.

## Patterns over instances

If a layout/anatomy repeats a second time (a second banner, a second page scaffold,
a second list-row shape), stop and name the pattern instead of hand-rolling a third
copy — reuse or extend what already exists.

---

Component lists and prop budgets belong at the **end** of this ritual (step 4/§4 of
the main procedure, and `brand-ui docs`) — never the start. A brief that opens with
"use Card, Badge, Table" instead of the intent sentence in §1 will get you a
competent-looking screen that solves the wrong problem.
