# Lens switch — Technical | Visual, view-only (DG-36/37/38 slice)

maintainer 2026-09-27. Checked in Chromium through `agent-browser` at 1440×900 against the
app's Vite dev server (port 5272 for this task — see repo conventions on port ranges).
Evidence lives in `apps/diagram/.evidence/lens-switch/` (repo-root-relative, git-ignored).

Scope: DERIVE (`derive-visual.ts`), LAYOUT (`lane-layout.ts`), RENDER (`src/visual/`), SWITCH
(`shell/lens-store.ts`, `top-bar.tsx`), TRANSITION (S10, this doc's main subject), ORIENTATION
(hover "Contains: …", ⌥-click drill-down), and lens-awareness in Present/export. Explicitly
excluded from this slice: the `visual:` YAML block/materialize, style profiles/cascade/hero
vendor, the Qlik marketecture vendor look, the catalog `capability` field, inspector editing
in the visual lens, and story-step lens control.

## 1–4, 6, 7: derive / layout / render / switch / orientation / export

Built and verified in the earlier part of this task (commits `097d147f`…`c7446933`). Two real
rendering bugs were found and fixed via browser verification, not code review alone:

- **Lane titles hidden under the floating `TitleBlock`.** `VisualCanvasPane` was fitting with
  a plain `fitViewOptions={{ padding: 0.15 }}` prop that ran before nodes were measured;
  `chromeFitPadding` (the same chrome-aware fit `DiagramCanvas` already used, DG-12) now runs
  once, off `useNodesInitialized()`, with no other fit in the pane to race it.
- **Zero flows rendering despite a correct derivation.** React Flow's own edge-position lookup
  (`getEdgePosition`, xyflow error #008) needs a `<Handle>` on both ends of an edge to place it
  at all, even though `VisualFlowEdge` draws from a precomputed rect and ignores RF's computed
  position entirely. `CapabilityBoxNode` now renders two zero-size, non-connectable handles.

The switch control (`LensToggle`/`LensMenuItems`, `top-bar.tsx`) and the ⌥-click orientation
drill-down (`canvas-pane.tsx`'s `frameNodeIds`/`frameKey` effect) were both verified working
in the browser: URL hash persists `&lens=visual` across reload, the compact-menu variant
shows the same two items below 768 px, and an ⌥-click on a visual box switches to technical
framed on that box's members (`.evidence/lens-switch/build/lakehouse-orientation-altclick-1440.png`).

**Not independently re-verified this pass:** the HoverCard "Contains: …" hover interaction —
tried via several `agent-browser` hover strategies, none reliably opened
`[data-slot=hover-card-content]` in automation (a tool limitation, not a known code defect: it
is a standard Radix `HoverCard`, the same primitive used elsewhere in this codebase). Present
mode and PNG/SVG export were not re-exercised this pass; they read the same DOM the lens
toggle already switches, so nothing in this slice's code path is export-specific, but that is
an inference, not a screenshot.

**A pre-existing, out-of-scope bug found and NOT fixed:** below ~768 px viewport width (780 px
works, 760 px does not), the app's shell collapses `.react-flow`'s container to zero width
(RF error #004, blank canvas) in BOTH lenses. Reproduced on unmodified `origin/main` from a
throwaway server (port 5290, immediately stopped) — this predates the lens switch entirely,
most likely a `md:` (768 px) Tailwind-breakpoint vs. a JS `useIsMobile()` hook mismatch in the
shell, not chased further.

## 5. The transition (S10) — what changed in this pass

The original build (commit `a4954802`) shipped a plain cross-fade: two independently-fitted,
already-settled `ReactFlowProvider`s cross-faded by `opacity`. An orchestrator review
correctly rejected this against `docs/2026-09-27-style-system-concept.md` §7 ("a smooth
animated transition, never a swap" — §7 describes a MORPH: nodes fly to their box's slot and
fade, zones morph into lane panels, edges retract and redraw, one continuous camera).

This pass replaces it with `src/panes/lens-morph-overlay.tsx`, wired from
`src/panes/canvas-pane.tsx`:

- **Both panes are now always mounted** (not just while a switch is in flight), each
  continuously laid out and fitted in the background. This is what makes §7's "target layout
  computed before the animation starts" literally true — there is no fresh-mount race to lose
  the instant a switch begins, because the target pane's geometry already exists and is
  current the whole time.
- **While a normal-motion switch is in flight** (`0 < position < 1`, not reduced motion), both
  real panes are hidden (`opacity: 0`, `inert`) and `LensMorphOverlay` draws the transition
  instead: for every technical node that maps to a visual box, a ghost rectangle FLIPs
  (fixed final DOM box, `transform`/`opacity` only) from the node's on-screen rect to a slot in
  its box, fading out in the last 30 % of the gather sub-phase; each box grows from the
  centroid of its members (scale 0.6→1, opacity 0→1); each top-level zone morphs into its
  lane's rect with a cross-faded title; technical edges (straight lines between node centers)
  fade out over the first half, aggregated box→box flows fade in (dashed for non-`data`) over
  the second half. One `position` value (`shell/lens-store.ts`) drives every ghost, so
  reversing mid-flight is the same continuous read — no recompute, no jump (verified, see
  below).
- **Reduced motion is unchanged**: the original plain cross-fade, exactly as §7 asks for a
  200 ms cross-fade with no movement. `LensMorphOverlay` never mounts in that mode.

### Documented simplifications (this is not the full §7 choreography)

- **No shared camera tween.** §7 asks for "one continuous camera move for the whole
  transition." This build has none — it does not need one, because every ghost's `from`/`to`
  rect is real on-screen geometry already produced by each pane's own settled fit, so flying
  between two already-correctly-placed points already reads as continuous motion. But this is
  a documented substitution, not the same mechanism (there is no single viewport transform
  either code path shares).
- **No per-sub-phase edge choreography.** §7's Wire phase asks for `stroke-dashoffset` draw-in
  timed against Gather/Dress. This build draws technical/visual flow lines as plain straight
  segments between node/box centers with an opacity fade only (no draw-in, no bezier paths
  matching the real edges) — a scope cut for time, not a technical constraint.
  Zone-endpoint ("floating") edges are excluded from the technical ghost lines; only direct
  node-to-node technical flows are drawn.
  Member ghost "slot" positions inside a box are an approximation (a small chip near the
  box's icon row, offset by member index), not `CapabilityBoxNode`'s real measured icon
  layout.
- **Zone→lane matching is top-level-zone only.** A zone's lane is the majority lane of its
  descendant nodes' boxes (a local, self-contained re-derivation of "descendant ids", not
  `derive-visual.ts`'s own internal one, which is not exported); nested zones do not get their
  own ghost and simply fade with the rest of the hidden technical pane.
- **Always-mounting both panes** is a real (small) standing cost: the visual lens re-derives,
  re-lays-out and keeps a second `ReactFlowProvider` live in the background even when the
  person never opens it. For diagrams of this app's size (single digits to ~20 nodes) this was
  not measurably slow in testing, but it is a genuine trade-off against the prior
  mount-on-demand behaviour, made deliberately so the target layout is always current.

### Verification

- **Frame time**, measured by instrumenting `requestAnimationFrame` around a real `.click()`
  on the toggle button (in-page, not through the CLI round-trip, to avoid the CLI's own
  latency polluting the sample): a technical→visual switch on `lakehouse-aws` sampled 52
  frames over 850 ms, average delta 16.67 ms, max delta 16.8 ms — effectively a steady 60 fps
  for the whole transition, no dropped frames.
- **Interrupt/reversal**: clicked Visual, waited 150 ms (mid-gather), then clicked Technical
  again before the first tween finished. It settled cleanly back at technical (48 frames,
  max delta 16.8 ms, no console errors), with no visible jump — `position` is one continuous
  value and the plan is captured once per overlay mount, not per click.
- **Console**: no errors or warnings logged by the app across all of the above runs (`vite`
  HMR debug lines and the app's own `[DG-06]`/`[DG-11]` layout logs only).
- **Screenshots** (`.evidence/lens-switch/build/`): `morph-lakehouse-inflight.png` (mid-flight
  on `lakehouse-aws`, technical→visual — technical node ghosts still near their source
  positions, box ghosts growing, zone/lane title cross-fade visible, technical edges fading);
  `morph-inflight-1.png` and `morph-settled-technical.png` (`qlik-sense-enterprise-onprem`,
  visual→technical, mid-flight and settled); `morph-post-reversal-settled.png` (after the
  interrupt/reversal test, settled clean with no leftover ghosts). Visual-lens screenshots for
  all four bundled examples exist under the same folder
  (`lakehouse-visual-*`, `clickhouse-cloud-stack-visual-*`, `qlik-cloud-data-gateway-visual-*`,
  `qlik-sense-enterprise-onprem-visual-*`).
- **Acceptance (DG-38) as specified** ("recorded at 1440×900 on the lakehouse and the largest
  Qlik reproduction … Performance panel export attached") was not run as a DevTools Performance
  panel export; the `requestAnimationFrame`-delta measurement above is the same fact (frame
  time during the transition) gathered a different way, not the exact artifact the acceptance
  line names.

## Known gate note (not caused by this task)

`git diff --stat origin/main -- packages/` is non-empty. `git merge-base HEAD origin/main`
returns this branch's own commit exactly, proving zero divergence at the fork point;
`origin/main` has since advanced with unrelated `charts` package work. This is upstream drift,
not a change made by this task.

## Round-0 review fixes (this pass)

maintainer 2026-09-27. Two review passes (an automated verify pass and `brand-ui-reviewer`)
found 26 items against the build above. All must-fix and should-fix items are fixed; the nits
below were fixed where trivial. Checked in Chromium through `agent-browser` at 1440×900 against
the same dev server (port 5271 for this task), plus a few smaller/mobile viewport widths for the
compact-menu and resize checks specifically.

**Write-leak class (view-only must never touch the technical text), same failure shape F1
already closed for delete/drag:**

- **F5** — the direction/node-style/layout controls in edit mode stayed enabled while the
  visual lens showed, so a click there silently relayed to a pane the person could not see.
  `top-bar.tsx`'s `disabled` now also requires `lensTarget === "technical"`. Verified: every
  one of those controls reports `disabled: true` in the DOM in edit+visual mode.
- **F20** — "Collapse all zones"/"Expand all zones" acted on the technical graph's zone-fold
  state unconditionally; same fix, gated on the lens in `interaction-controls.tsx`'s
  `useAvailable`. Verified: both report `disabled: true` while the visual lens is showing.
- **F23** — document-level ⌘Z/⌘⇧Z (`state/history.ts`'s `onHistoryKeyDown`) undid/redid the
  technical text even while the visual lens showed, since the listener is global and had no
  lens gate. Now returns before `preventDefault()` unless `lensStore`'s `target` is
  `"technical"`. Verified both ways: the same synthetic keydown left the text and
  `defaultPrevented` untouched in the visual lens, and fired normally back in technical.

**A real correctness bug, not a leak — export captured the wrong pane:**

- **F2/F3** — `io/export.ts`'s `liveCanvas()` (also used by the autosave thumbnail and
  `canvasDrawn()`) picked the first `.react-flow` in the DOM, which is always the technical
  pane now that both lenses stay mounted (`data-lens-pane="technical"|"visual"`,
  `canvas-pane.tsx`) — Export while looking at the visual lens silently exported the technical
  diagram instead. `liveCanvas()` now reads `lensStore`'s settled `lens` field and scopes the
  query to that pane's `data-lens-pane`. Verified by calling `pictureOfCanvas()` directly in
  each lens: the visual-lens picture's SVG contains the lane titles ("Sources"/"Databricks
  jobs"); the technical-lens picture does not and contains "Okta" instead, at the technical
  pane's own (much wider) aspect ratio. `workspace/use-autosave.ts`'s neighbouring comment,
  which had said the technical pane "unmounts" at a settled visual lens (it never did — it is
  cross-faded via `opacity`/`inert`, same as before this slice), is corrected.

**Should-fix, visual quality:**

- **F13** — two DIFFERENT same-lane box pairs share one x column (`lane-layout.ts` lays out
  one column per lane), so their dogleg bends anchored at the identical offset and drew as one
  line. `build-visual-graph.ts` now groups same-lane flows by that shared column and steps
  each one's offset out from the last, sorted by flow id for a stable order. Verified visually
  on `lakehouse-aws` (`.evidence/lens-switch/fix-r0/07-visual-edges-fanned.png`): the Customer
  VPC lane's several same-lane connectors now sit in visibly distinct vertical bend columns.
- **F14** — `VisualCanvasPane` fit once on mount and never again; an editor-split drag or a
  window resize left the diagram at the old size's fit. Added the same `ResizeObserver` +
  "only if the view is still exactly where the last fit left it" guard the technical pane's
  own resize-refit uses. Verified: a drastic viewport resize (900×800 → 500×500) changed the
  viewport transform's scale from `1.1014` to `0.430147`.

**Nits fixed:**

- **F19** — the lens toggle's two `ToggleGroupItem`s had a tooltip-derived accessible name but
  no `aria-keyshortcuts`, unlike the edit-mode toggle's own pattern; added `aria-keyshortcuts="L"`
  to both.
- **F21** — `LensMenuItems` owned a trailing separator AND `ExportMenuItems`/`LayoutMenuItems`
  each own a leading one; in view mode (no edit-only section between them) that doubled up.
  `LensMenuItems` no longer owns a trailing separator; the edit-only block now owns its own
  leading one instead, matching the "next section owns the leading separator" convention the
  other sections already use. Verified: the compact menu's separator list in view mode has no
  two consecutive `separator` entries.
- **F22** — the box title span's own `truncate` did nothing without `min-w-0` on it and its
  flex-row parent (`conventions.md`'s truncation rule); added both, matching the member rows'
  existing pattern.
- **F24** — the visual pane set `panOnScroll`, so the same scroll gesture panned in the visual
  lens and zoomed in the technical one; removed it so both lenses share React Flow's default
  scroll-to-zoom.
- **F25** — box ids were a running counter (`box:0`, `box:1`, …), positional and so unstable
  across two derivations of a changed document; now `box:<first member's node id>` (unique
  because `grouped` partitions every node into exactly one group) and `box:aside:<lane>` for
  the one aside box per lane. Re-verified the 6 derivation-rule fixtures and all 4 bundled
  examples still pass (`#dev/lens-check`, "6 of 6 cases match" / "4 of 4 examples derive").
- **F26** — the box's root carried two different `data-slot` values by state
  (`capability-box`/`capability-box-aside`), against the one-name-per-slot convention; now one
  `data-slot="capability-box"` plus a separate `data-aside` attribute for the state.

**Not fixed — a library gap, not this app's code (per this task's own hard rule: no `packages/`
edit to chase it):**

- **HoverCard portal.** `CapabilityBoxNode`'s "Contains: …" hover card renders clipped/behind a
  neighbouring box. `packages/ui/src/components/hover-card/hover-card.tsx`'s `HoverCardContent`
  is not portaled, so a parent with its own stacking context (this button sits inside a
  `transform`-bearing ancestor during the lens cross-fade) clips it. Fixing this is a
  `packages/ui` change, out of scope for this worktree.

**Not fixed — accepted scope cut, documented above and unchanged this pass:** the full §7
shared-camera tween (a single continuous viewport transform driving both panes) is still not
implemented; the FLIP-ghost substitution this slice ships instead is unchanged and re-verified
working this pass (screenshots above).

### Frame time, re-measured after this pass's changes

Same in-page `requestAnimationFrame`-delta technique as the original build's measurement,
re-run after the F13 (edge offsets), F14 (resize observer) and the opacity-formula changes
earlier in this task (`DRESS_START`). A technical→visual switch on `lakehouse-aws`, two runs:
52 frames each, steady 16.6–16.8 ms (60 fps) for every frame **except the first**, which measured
~66.7 ms both times — one dropped-frame hitch right at click, not sustained and not at the
`DRESS_START` crossover point later in the transition. Not chased to a root cause within this
pass's time budget; the likely source is `LensMorphOverlay`'s `capturePlan()`, which now does
one extra pass of `getBoundingClientRect` reads for the fallback lane ghosts added this pass,
on top of the zone/box ghost reads it already did. Everything after that first frame is
unchanged from the original build's own measurement (16.67 ms avg / 16.8 ms max).

## Round-1 and round-2 review fixes (this pass)

maintainer 2026-09-27/28. A second orchestrator review pass found four must-fixes (M1–M4),
seven should-fixes (S1–S7) against the round-0 build, plus a verifier pass's own MF-1…5,
SF-1…6 and PRE-1. This pass (`diagram/lens-switch`, worktree build) first merged
`origin/main` (`512d76e9`) — the sibling `diagram/view-direction` slice had landed view-mode
read-only (per-viewer direction/card, never saved) in the meantime — then fixed the write-leak
and rendering items below. Checked in Chromium through `agent-browser` against a worktree dev
server (port 5351), plus source inspection where the CLI itself became unreliable (see
Problems below).

**Write-leak class, closed and proven with a real sha log
(`apps/diagram/.evidence/lens-switch/fix-r2/write-path-sha-log.md`, gitignored):**

- **MF-1** — the autosave thumbnail gated only on `position >= 1` (visual, settled), not also
  on the TECHNICAL lens being both settled and at position 0; a thumbnail could still capture
  mid-transition. Now requires `lens.lens !== "technical" || lens.position !== 0` before
  skipping — i.e. only skips when truly clear of the technical, settled state.
- **SF-1** — the top-bar Undo/Redo BUTTONS had their own `aria-disabled` logic, separate from
  the keyboard shortcut's `state/history.ts` gate; a click could still undo/redo while the
  visual lens showed. Both now share one `canUseHistory()` export, used by the keyboard
  handler AND `DocumentControls`' button `onClick`s. Verified: a direct `.click()` on the
  (visually disabled) Undo/Redo buttons in edit+visual mode left the file sha unchanged.
- **New this pass, found while closing the above** — the Inspector's `EntryForm` could still
  write a TECHNICAL node's fields while the visual lens showed, if that node had been selected
  before switching lenses (selection state persists across the lens toggle by design, since
  both panes stay mounted). Fixed via `SchemaFormProvider`'s own public `disabled` prop
  (`packages/ui`, no `packages/` edit needed) plus a guard at the top of `onChange`. Verified
  two ways: the field reports `is enabled: false` (a real user could not reach it), and a
  forced write via the CLI still left the file sha unchanged.

**Morph choreography (S10):**

- **MF-3** (partial) — the ghost overlay held full opacity from ~64% of the transition through
  settlement, then unmounted in one commit, reading as a "pop" the maintainer's ruling
  explicitly forbids. `overlayOpacity` now ramps down over the Dress sub-phase, mirroring the
  gather-in ramp. Does **not** address the separately-flagged chrome-blinking-mid-flight issue
  (SF-2) — deferred, not fixed this pass.
- **Item 2 (first-frame hitch)** — investigated the task's own hypothesis ("lens store updates
  before hash write / defer hash write"). `shell/lens-store.ts`'s `setLens` now defers the
  (cosmetic) `window.location.hash` write by one `requestAnimationFrame`, off the critical path
  that mounts `LensMorphOverlay`. Measured before/after
  (`apps/diagram/.evidence/lens-switch/fix-r2/frame-time-log.md`): **the hitch is unchanged**
  (66–117 ms across three runs, same shape as round 0's ~66.7 ms) — the hypothesis was wrong,
  or at least insufficient; `capturePlan`'s own `getBoundingClientRect` reads remain the more
  likely dominant cost, per round 0's own suspicion, not chased further. The fix is kept (a
  real, small reduction in what shares the first frame) but is **not** claimed to have solved
  the hitch. Every measured run still clears the ≥95%-of-frames-≤16.9ms bar (98.3–98.9%), and
  mid-flight reversal re-verified clean (89 frames, settles correctly, no console errors).

**Rendering (M3, M4, S2, S5, S6, S7):**

- **M3** — a flow spanning more than one lane (e.g. Sources straight to Targets) drew a
  straight line through every intervening box. `build-visual-graph.ts` now routes it through
  each lane's header gutter (`LANE_HEADER_HEIGHT`..`+LANE_PADDING`, empty in every lane
  regardless of content), staggering concurrent skip-lane flows a few px apart. Verified
  visually on `templates/qlik-cloud-customer-landscape.yaml` (a real 4-lane document, not a
  synthetic fixture): a Salesforce→tenant flow crosses two intervening lanes cleanly above
  every box's title bar (`.evidence/lens-switch/fix-r2/template-qlik-landscape-visual-light-1440.png`).
- **M4** — flow arrowheads had no explicit token colour, falling back to the SVG default
  (black in some themes, near-invisible in others). `markerEnd`/`markerStart` now carry
  `color: "var(--muted-foreground)"`.
- **S2** — two DIFFERENT cross-lane box pairs at the same y drew their flows as one shared
  line. `crossPairGroup`/`crossPairNudge` steps each pair's line out from the shared column,
  same idea as round 0's F13 same-lane fix.
- **S5** — a capability box used `zoneFill(0, owner)`, pricing it as if it sat directly on
  `--canvas` (the same root a top-level zone nests into), when it actually nests one level
  inside its (already-muted) lane panel — a customer box landed on the exact same fill as its
  lane, no visible cue. Now `zoneFill(1, owner)`, with the resulting `capped` flag threaded
  through instead of a hardcoded aside-only flag.
- **S6** — a box's accessible name had no way to convey its lane (lane panels are not tab
  stops); `CapabilityBoxData.laneTitle` is now populated and folded into the name. Verified via
  the accessibility snapshot: `"AWS account — Contains: S3 — landing, AWS Glue, S3 — curated.
Customer managed. Customer VPC. Option/Alt-click…"`.
- **S7** — a single-member box whose title IS that member's title printed the title twice
  (header + the one member row). The header now carries that member's own icon and the
  redundant row is skipped. Verified: `"Databricks jobs. Customer managed. Customer VPC."` with
  no second "Databricks jobs" line beneath it.

**F17 — `#dev/lens-check` only proved "derives, doesn't crash, deterministic," never
correctness, and only on `workspace/examples/`, never `workspace/templates/`:**

Now also globs `workspace/templates/*.yaml` (6 documents total, 4 examples + 2 templates), and
runs a new structural-invariants pass on every one of them — referential integrity (every
box's lane, every flow's endpoints, resolve to real ids), F9's actor exemption from aside
boxes, and F6/F7's kind-scoped bidirectional merge — restated as generic checks instead of
only the six hand-written synthetic fixtures. All 6 documents pass all of it
(`.evidence/lens-switch/fix-r2/dev-lens-check-structural*.png`).

### Known gaps, honestly not closed this pass

- **SF-2** (chrome blinking mid-transition) — not fixed, not re-investigated; time budget went
  to the write-leak class and the rendering should-fixes instead.
- **The first-frame stall** (item 2) — investigated and one hypothesis ruled out (see above);
  the stall itself remains.
- **Full example/template screenshot sweep** — light-theme visual-lens screenshots exist for
  all 4 examples and 1 of 2 templates; dark-theme exists only for `lakehouse-aws`. Not a
  correctness gap found, just a coverage gap against the "light+dark, every example and
  template" ask.
- **A commit-hygiene deviation**: the MF-1/SF-1/inspector fixes above were made to the working
  tree before `git commit --no-edit` closed the `origin/main` merge, so they ended up bundled
  into the merge commit (`512d76e9`) rather than their own logical commit. Not re-split (no
  history rewrites, per this task's hard rules) — disclosed here instead.
- **`agent-browser` tooling instability**: mid-pass, the CLI session queue backed up behind a
  `drag` call on a non-draggable node and had to be closed and restarted under a new session
  name. A live drag-attempt on a capability box could not be completed as a result; verified
  instead at the source (`nodesDraggable={false}` unconditionally on the entire visual pane,
  not gated by any runtime condition).

## Round 2 review fixes (this pass)

maintainer 2026-09-28. A further review pass against the round-1/round-2 build above found a
must-fix refit race, a Monaco-editable-during-visual-lens leak, an inspector lock-timing gap,
several rendering/derivation should-fixes and a set of nits. This pass fixed what it could
verify by source inspection and `pnpm run typecheck:local` alone. **No dev server or browser
was used this pass** — every item below is typecheck/lint/audit-clean, not visually or
behaviourally re-confirmed the way round 0/1/2 above were. That is a real gap, disclosed here
rather than claimed as done.

**Write-leak class:**

- Monaco stayed editable while the visual lens showed in edit mode — a keystroke there would
  have written the technical text with nothing on screen to show for it. `editor-pane.tsx` now
  passes `readOnly` to `CodeEditor` whenever the lens is not settled at technical
  (`position !== 0`).
- The Inspector's `lensLocked` gate checked `target !== "technical"`, which unlocks the instant
  a switch BACK to technical starts, before the transition settles — a keystroke mid-transition
  could still reach `EntryForm`. Changed to `position !== 0` (locked for the whole transition,
  either direction), added a native `<fieldset disabled>` around `SchemaFormRoot` as a
  second, structural guard beside the existing `disabled` prop threading, and added
  `lensLocked` to `EntryForm`'s remount key so a lock-state change cannot leave a stale,
  still-enabled form instance mounted.

**Refit race:**

- The visual pane's own resize-refit compared the current viewport against the last fit it
  performed to decide whether a person had since panned/zoomed by hand (skip the refit if so).
  That comparison raced a real pan: `VisualFit` is rewritten as `VisualFlow`, which now tracks
  "has a person actually moved the view" via `onMoveStart`'s own event argument
  (`@xyflow/react`: non-null for a real pointer/wheel gesture, `null` for a programmatic
  `fitView`) instead of re-deriving intent from viewport equality.

**Rendering / derivation:**

- Member "ghost" chips in the lens-morph overlay flew to an estimated `index * 26px` offset,
  not the member's real on-screen position — visibly wrong whenever a box's actual row height
  or content differed from the estimate. Real member rows (and the sole-member header icon)
  now carry `data-member-id`; the overlay queries the real DOM rect for each one and renders an
  icon + truncated name in place of the former anonymous square.
- A capability box's border was the one reliable separator from its lane fill, but at hairline
  weight measured as low as 2.88:1 against `--surface-muted` (`--border-strong` itself, in
  BOTH themes — not dark-only as first reported) — short of the 3:1 the rule this box relies on
  needs. Bumped to `border-2` as the best in-scope mitigation. **The root cause is a
  `packages/tokens` elevation-ladder gap** (`--card` measures only ~1.1:1 against
  `--surface-muted` in both themes, so no fill rung separates a leaf box from its lane either)
  that this app-level component cannot close under this task's "never edit `packages/`" rule —
  flagged here as an out-of-scope, cross-package finding for the maintainer.
- A single-member box whose one member's title equals the box's own title reserved a member-row
  worth of empty height it never rendered into (the header already carries that member).
  `lane-layout.ts`'s `boxHeight()` now skips the row reservation for that case.
- An unowned node (no zone, no vendor) showed no owner text but was still styled as "hosted",
  so a screen-reader user heard nothing while a sighted user saw a hosted-style border — added
  an explicit "Unowned" label wired through the same `ownerLabel` both read.
- Flow edges had no `ariaLabel`, so React Flow named them from raw internal node ids. Added a
  built label per edge (`"<from box> → <to box>, <kind> flow"`, bidirectional phrased as such).
- The lens-morph overlay's box-ghost title used different padding/layout than the real box
  header, so the two visibly doubled/misaligned during the cross-fade; matched padding, flex
  layout and border weight to the real header.

**Consciously deferred, not fixed this pass (each investigated far enough to state why):**

- **Shared camera.** §7 asks for one continuous viewport transform driving both panes; this
  build still flies independently-fitted ghosts between two independently-settled fits (the
  same documented substitution as round 0). A real fix means interpolating one camera across
  both panes' geometry, not a targeted patch — too large a rewrite to attempt without browser
  verification in this pass's remaining budget.
- **Shared edge segments across different box pairs.** The existing anti-overlap mechanisms
  (same-lane column stepping, cross-pair Y-nudge, skip-lane staggering) do not cover every
  pair-of-pairs that can share a segment; a general fix needs per-flow port/channel routing,
  not another special case bolted onto the existing ones.
- **Lane tie-break order.** Confirmed by tracing `flowRole()`/`netFlow()`: a node with exactly
  one inbound and one outbound flow of DIFFERENT kinds nets to zero on both the data-only and
  the any-kind check, landing on `defaultRole` even where a real topological order exists. A
  correct fix needs topological-rank computation over the flow graph with cycle handling —
  deferred as algorithmically risky to implement without a way to visually check the result.

**`#dev/lens-check` (was asserting too little):** now also checks that every real node lands in
exactly one box (never zero, never two — catches both a dropped node and an
overlapping-grouping-rule duplicate), and dropped internal finding-id citations from its
on-page fixture names/captions (they read as noise with no context to a later reader; the
underlying checks are unchanged).

**Comment hygiene:** every code comment this pass's own diff introduced or touched that cited
a review-round or finding id ("review round", "F17", "S6", …) was rewritten to describe what
the code does instead, per this task's hard rule that comments describe the code, not the
review that produced it. Pre-existing citations from earlier, already-merged rounds elsewhere
in this codebase (`fix-r0`, `DG-22 review`, etc.) were left untouched — a different, legitimate
provenance convention, not this rule's target.

### What this pass could not do

- **No browser verification at all.** Every fix above is typecheck-clean
  (`pnpm run typecheck:local`), lint-clean (`pnpm run lint:local`, 0 errors), and
  `brand-ui audit --strict` clean, but none was watched render, clicked, or measured for frame
  time. The refit-race fix, the member-ghost fix, and the border-contrast mitigation in
  particular are exactly the kind of change that can look right in source and still be wrong
  on screen; they need the same `agent-browser` pass rounds 0–2 above used before anyone should
  treat them as confirmed.
- **N-1 through N-4 nits** (an `aria-description` for the Alt+Enter hint, `vendorLabel`
  acronym-casing for short vendor keys, a possible `autoPanOnNodeFocus={false}` Tab-reveal
  regression, and a small `use-autosave.ts` comment overlap with the sibling
  `diagram/view-followups` branch) were not addressed this pass.
