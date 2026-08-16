# Conceptual framing (choose the right model before building)

For open-ended or structural work — a theme, a system-wide visual change, a new
capability — the expensive failure is solving the **wrong model** well. Guard it:

## Re-frame trigger (most important)

If the user corrects the **same dimension twice**, STOP patching. Two corrections on one
axis means the _model_ is wrong, not the details. Step back, re-derive the deliverable
from the user's GOAL, and question the architecture you chose — out loud. Do not issue
another point fix or re-claim success until you've re-validated the frame.

## Explore alternatives before scaffolding

Before committing an architecture (new package / new components / a mechanism):

- Generate **2–3 conceptually distinct approaches**, not one idea's implementation.
- Score each against the real success criterion (e.g. "any unmodified screen reads as a
  blueprint, automatically") — not against ease of building.
- **Prefer a systemic / automatic solution** (a token/theme re-encoding every consumer
  gets for free) over **additive, opt-in parts** (new components someone must
  hand-place). If a "theme" only works when you drop widgets onto each screen, the model
  is wrong: a theme re-encodes the existing semantic system into another channel
  (color → pattern / density / border), it is not a kit of new parts.

## Clarifying questions must offer concepts, not parameters

When you ask the user to choose direction for net-new design, the options must include
**alternative concepts** (e.g. "theme-level translation" vs "component kit"), not just
parameters _within_ a model you already picked. A question that presupposes the
architecture hides the real decision.

## Don't manufacture false rigor

Green typecheck/lint/tests and elaborate workflows validate _conformance to a spec_ —
they say nothing about whether the spec is the right idea. Validate the **concept against
the goal** — on a real surface (see @.claude/rules/quality-gates.md, Theme-safe) —
BEFORE validating the implementation against the spec.
