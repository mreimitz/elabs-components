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
