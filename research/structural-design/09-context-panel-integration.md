# 09 · The `ContextPanel` + drill-in — top-down integration (refines [04](04-context-panel-and-assets.md) §1–3, §6)

> The third refinement, in the same frame as [07](07-type-system-integration.md)
> (type/size axis) and [08](08-separation-surface-system.md) (surface axis). Where
> those fixed systemic backbones, this fixes a **missing component** — the right rail
> the scenario hand-rolled as an `<aside>` (PANEL-1..5, ASSET-3/4). Routed through
> `brand-ui-design-system-architect` (a new cross-package component + a new `@qlik-coe-emea/qlabs-components-ui`
> primitive + an export-surface call). Mechanism claims verified; animation/perceptual
> claims flagged `needs-render`.

**Headline + honest caveat.** Unlike 07 (a pure-native Tailwind feature) and 08 (a
token-light convention), this **is** net-new component surface — but **almost none of
the hard machinery is new.** The collapse is the Sidebar mechanism verbatim; the frame
is flow's `InspectorPanel` generalized; the drill-in v1 is a CSS-gated `translateX`
track on the existing motion gate; the v2 is the already-designed `useViewTransition`
seam; the provider is the `SidebarProvider` shape. **The one genuinely new idea: two
views (root ↔ detail) behind one collapsing frame, lifted into a provider so an
external trigger drives it.** The design says so rather than inflating the novelty.

---

## A. How it blends in — a peer of Sidebar, a synthesis of InspectorPanel, a doc-13 compound

### A.1 The honest reuse ledger

| Concern                                                      | Reused mechanism (verified)                                                                                                                                                                   | `ContextPanel`                                              | New?                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| Open/close width animation                                   | Sidebar gap-spacer `transition-[width] duration-base ease-linear → w-0` (`sidebar.tsx:196-205`) + `fixed` container slide (`:206-219`); `duration-base` = gated `--t-base` (`themes.css:310`) | same two-element technique, `side="right"`                  | **No**                                        |
| The frame (bordered surface + header + selection-keyed body) | `InspectorPanel` `flex h-full w-72 flex-col border-s bg-surface` + header + `Reveal key=` (`inspector-panel.tsx:37-77`)                                                                       | generalized; header hosts BACK in detail                    | **No**                                        |
| Provider / lifted-state shape                                | `SidebarProvider` controlled+uncontrolled `open`, `useSidebar()` throws-outside, cookie persistence (`sidebar.tsx:51-133`)                                                                    | mirrored; adds `view`/`selectedAsset` + `openDetail`/`back` | **No**                                        |
| The motion gate                                              | `--t-*` fold in `--motion-factor` + OS backstop (`themes.css:309-312`); `useReducedMotion()`                                                                                                  | collapse + drill-in both gate via it                        | **No** (same gate, no new lever)              |
| Drill-in v2 engine                                           | `useViewTransition` design (`view-transitions/01-design.md` §2; §6.1 names the **list→detail morph as PRIMARY proof case**)                                                                   | v1 behind the seam → v2 swaps in                            | **No** (designed; this is its proving ground) |
| Mobile `Sheet` fallback                                      | Sidebar swaps to `<Sheet>` below `md` (`sidebar.tsx:164-183`); `@qlik-coe-emea/qlabs-components-ui Sheet` exists                                                                              | same, `side="right"`, below `lg`                            | **No**                                        |
| **Two-view drill-in behind one collapsing frame**            | —                                                                                                                                                                                             | the provider's `view` state + the two-pane body             | **YES — the one new idea**                    |

Structurally: **`InspectorPanel`'s frame + `SidebarProvider`'s collapse & lifted state +
a two-view body**, in `@qlik-coe-emea/qlabs-components-ai`. It blends in because it's assembled from grammar the
library already speaks. None of the three existing pieces has all three behaviours —
`InspectorPanel` has the frame but no collapse and no drill-in; `Sidebar` has the
collapse but isn't a content rail; `ChatShell.aside` is an inert `hidden lg:block` slot
(`chat-shell.tsx:38`).

### A.2 It's the place all three systemic systems land at once

`ContextPanel` **renders** the type scale (07: header `text-title` capped, labels
`text-meta`, detail markdown at a constrained rung), **uses** the surface convention
(08: sections separated by `gap` + labels not boxes; selected row `bg-surface-muted`;
grounding = the green evidence channel), and **consumes** the motion gate. That's why it
earns being a component rather than three more story patches.

---

## B. How it works — compound API + two animation mechanisms + mobile + a11y

### B.1 The compound surface

Modeled part-for-part on `SidebarProvider`/`Sidebar` (so an agent who knows Sidebar knows this):

```
ContextPanelProvider  — lifts ALL state; wraps the WORKSPACE (external trigger can drive `open`)
  useContextPanel()    — throws outside the provider (the SidebarProvider guard)
ContextPanel           — always-mounted shell; animates its OWN width like Sidebar (side="right")
ContextPanelTrigger    — toggle button (sibling of SidebarTrigger); placeable ANYWHERE in the provider
ContextPanelHeader     — title row; renders BACK when view==='detail'
ContextPanelBody       — the two-view container (root ↔ detail); owns the drill-in animation
ContextPanelSection    — a labelled root-view section (status / grounding / produced-assets)
ContextPanelDetail     — the focused single-asset view (hosts AssetPreview)
```

Provider interface (`state` / `actions` / `meta`, doc-13 lifted state):

```ts
state: {
  open: boolean;
  view: "root" | "detail";
  selectedAsset: ContextAsset | null;
}
actions: {
  toggle();
  setOpen(open);
  openDetail(asset);
  back();
}
meta: {
  isMobile;
  openMobile;
  setOpenMobile;
} // drives the Sheet fallback
```

`ContextAsset = { id; name; path?; type: "markdown"|"code"|"sql"|"csv"|"image"; content? }`
— exported, so tree + preview share one type and an agent reads a closed `type` enum.
Provider props mirror `SidebarProvider` (controlled+uncontrolled `open`/`onOpenChange`/
`defaultOpen`; plus `view`/`selectedAsset` controllable), `isControlled = prop !==
undefined` never flips. Persistence reuses the cookie pattern.

**Why a provider, not props:** the external trigger requirement is the whole reason —
the app-header `PanelRight` toggle (`agentic-workspace.stories.tsx:1015-1023`) lives
**outside** the panel's frame but must drive `open`. That is the doc-13 motivation;
today the scenario hand-wires `railOpen` `useState` (`:961`) + a conditional mount
(`:1100`) — the provider replaces both.

### B.2 Animation 1 — COLLAPSE (open/close width): CSS-gated, mirror Sidebar (fixes complaint 1)

The defect was never "the rail can't animate" — it's the **conditional mount**
(`{railOpen ? … : null}`, `:1100`); you can't tween the width of a node not in the DOM.
`ContextPanel` is **always mounted** and tweens two elements with the Sidebar technique:
a gap-spacer `transition-[width] duration-base ease-linear` collapsing to `w-0`, and a
sliding container `transition-[right,width] duration-base`. `duration-base` = gated
`--t-base` → honours reduced-motion **for free, no `BrandMotionConfig`** (pure CSS, like
Sidebar). `--context-panel-width` defaults to `20rem` (today's `w-80`).

> ⚠️ **The fixed-vs-flex container coupling (Risk G.3).** Sidebar's container is
> viewport-`fixed`; the rail must bound to the **shell**, not the viewport. Resolution:
> `ContextPanel` is a **flex sibling** (like `Sidebar` is a peer of `SidebarInset`); the
> gap-spacer reserves/releases the inline width while the inner panel is `absolute
inset-y-0 end-0` within a `relative` parent the panel owns — not viewport-`fixed`.
> The one deliberate Sidebar divergence; **needs-render**.

### B.3 Animation 2 — DRILL-IN (root ↔ detail): v1 CSS track behind a v2 VT seam (fixes complaint 2)

The focused asset stays **inside the rail width** (never a Dialog/Sheet overlay) — the
[04](04-context-panel-and-assets.md) §3 "two-view morph, not a modal."

**v1 (ship now) — a CSS-gated two-pane `translateX` track.** Both panes mounted,
`overflow-hidden`, transform-only (GPU):

```tsx
<div className="relative flex-1 overflow-hidden">
  <div
    className="flex h-full w-[200%] transition-transform duration-base ease-standard motion-reduce:transition-none"
    style={{ transform: view === "detail" ? "translateX(-50%)" : "translateX(0)" }}
  >
    <div className="h-full w-1/2 overflow-y-auto" aria-hidden={view === "detail"}>
      {root}
    </div>
    <div className="h-full w-1/2 overflow-y-auto" aria-hidden={view === "root"}>
      {detail}
    </div>
  </div>
</div>
```

- **Why CSS over `AnimatePresence`** (the verified, load-bearing reason): **`@qlik-coe-emea/qlabs-components-ui`
  has no `motion` dependency** (only `@qlik-coe-emea/qlabs-components-ai` does). The shared collapse base belongs
  in `@qlik-coe-emea/qlabs-components-ui` (decisions 1+3, dep graph), so the base must stay motion-free. Even in
  `@qlik-coe-emea/qlabs-components-ai`, `AnimatePresence` would need a `BrandMotionConfig` wrap (PANEL-5) for no
  continuity win on a horizontal slide. The CSS track gates via `duration-base` (= the
  `--duration-base` "dropdown/tabs" band — a navigation gesture, not a hover) **plus**
  an explicit `motion-reduce:` neutralizer.
- **v2 (later) — swap to `useViewTransition`, internal-only.** The drill-in is the VT
  design's **named primary proof case** (`01-design.md` §6.1). When VT-01 ships,
  `openDetail`/`back` call `vt.run({ name: vtName(\`asset-${id}\`), recipe:
  "nav-forward"|"nav-back", mutate })`. The v1 actions are **already shaped as
`mutate`-callbacks** and the panes carry stable `data-vt-pane="root|detail"`identities, so v2 is an **internal swap** (the`01-design.md` §7 engine-seam) — no
public-API or visual-grammar change. v1 is a faithful gated stand-in (`nav-forward`/
`nav-back`_are_ horizontal slides); v2 upgrades quality (true cross-snapshot morph).
This reconciles with`01-design.md`§4: drill-in is the **VT bucket** (continuity
across a view swap), not CSS-Radix-state and not motion.dev — v1 just stands in until
the proof case is built. **VT-01 is therefore NOT a blocker —`ContextPanel` justifies it.\*\*

> **needs-render:** prototype the track across six themes **and** `data-motion-pref=reduced`
> — confirm it gates to instant and reads as continuity, not a flash (`01-design.md` §10).

### B.4 Mobile — degrade to `Sheet side="right"` below `lg`, same `open`

Reuse the Sidebar pattern (`sidebar.tsx:164-183`): below `lg`, render a `@qlik-coe-emea/qlabs-components-ui`
`<Sheet side="right">` driven by `meta.openMobile`, so the **same `open` semantics** hold
(trigger toggles the sheet on mobile, the inline collapse on desktop). Today the rail is
`hidden … lg:flex` — it just **vanishes** (PANEL-4). The drill-in track works identically
inside the Sheet. Strictly better, reuses a shipped primitive.

### B.5 The drill-in a11y spec (the part most often botched)

A view change within a region = **"tab-panel swap," not "dialog."**

- **Announce, don't steal focus mid-animation:** `ContextPanelBody` is `role="region"`
  `aria-label` with a visually-hidden `aria-live="polite"` node announcing the target
  ("Showing board-note.md" / "Back to context").
- **Focus on `openDetail`:** move focus to the **detail heading** (or the BACK button),
  `tabIndex={-1}` + `.focus()` **after** `mutate`, in a `requestAnimationFrame` so it
  lands post-swap. (VT guardrail §8: focus management **independent of** the animation —
  never gate it on `transition.finished`.)
- **Focus on `back`:** **restore focus to the triggering row** — the provider stashes the
  triggering asset id; `back` refocuses the `ProducedAssetTree` row via a ref map.
- **BACK button:** real `<button type="button" aria-label="Back to context">` (text
  "Back" + `ChevronLeft`, icon `aria-hidden`), in `ContextPanelHeader`, only when
  `view==='detail'`. Not `<a>`, not a breadcrumb (one level).
- **Off-screen pane:** `aria-hidden` **+ `inert`** (so Tab can't land in the invisible
  pane during the slide). **Collapsed container:** `inert` too (Sidebar gets this free via
  `hidden`; the right rail must do it explicitly).
- **Trigger:** `aria-expanded={open}` + `aria-controls` + `aria-label`.
- All a11y behaviour runs **regardless of** the motion gate (it's correctness, not decoration).

> **needs-render:** axe + keyboard pass (`run-story-tests`) — focus lands on detail
> heading on drill-in, returns to the row on back, off-screen pane not Tab-reachable, the
> live region announces; six themes for BACK-button + label contrast.

---

## C. How users work with it

### C.1 Per user type

| User         | Reach-for                                            | Why                                                                                                                            |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Import       | `ContextPanelProvider` + parts                       | collapse + drill-in + a11y baked in; can't re-acquire the conditional-mount bug                                                |
| Copy-own     | a `context-panel` registry block composing the parts | a team tweaks the sections; the mechanism stays in the package                                                                 |
| Coding agent | the parts via MCP                                    | closed enums (`view`, `ContextAsset.type`); picks `openDetail`/`back` by name — can't hand-roll an `<aside>` or a mount toggle |
| Theme-author | nothing panel-specific                               | it renders tokens + the type scale + the surface convention; re-theming the rail = re-theming `--surface`/`--text-*` (07/08)   |

### C.2 The provider-hoisting story (external trigger drives `open`)

The provider wraps the **whole workspace**; the trigger is a sibling in the app header;
the panel is a sibling of the chat. No prop-drilling, no page-level `useState`:

```tsx
<ContextPanelProvider defaultOpen>
  <SidebarProvider defaultOpen>
    <WorkspaceSidebar … />
    <SidebarInset>
      <header> <SidebarTrigger /> … <ContextPanelTrigger /> </header>  {/* trigger drives open via context */}
      <ChatShell composer={…}><Conversation>…</Conversation></ChatShell>
    </SidebarInset>
    <ContextPanel>                                                     {/* always-mounted sibling; animates its width */}
      <ContextPanelHeader title="Context" />
      <ContextPanelBody
        root={<>
          <ContextPanelSection label="Status"><ContextUsage … /></ContextPanelSection>
          <ContextPanelSection label="Grounding"><SourceList … /></ContextPanelSection>
          <ContextPanelSection label="Produced assets">
            <ProducedAssetTree assets={ASSETS} onSelect={openDetail} />
          </ContextPanelSection>
        </>}
        detail={<ContextPanelDetail><AssetPreview asset={selectedAsset} /></ContextPanelDetail>}
      />
    </ContextPanel>
  </SidebarProvider>
</ContextPanelProvider>
```

`root`/`detail` are `ReactNode` **slot props** (children-over-render-props,
`component-api.md`). `ProducedAssetTree`/`AssetPreview`/`SourceList`/`ContextUsage` are
the [04](04-context-panel-and-assets.md) §4–6 siblings — separately built; `ContextPanel`
is the frame that hosts them.

### C.3 ChatShell integration — stay generic; panel is a sibling

`ChatShell` does **NOT** get a ContextPanel-aware slot. The trigger lives in the _app
header_ (outside `ChatShell`), so `ChatShell` can't own the state. `ContextPanel` is a
sibling of `ChatShell` exactly as `Sidebar` is a peer of `SidebarInset` under a shared
provider. `ChatShell.aside` stays as the low-ceremony **static-rail** slot (non-breaking)
for chats that don't want collapse/drill-in. One line into `ai-chat-components.md`:
_"static rail → `ChatShell.aside`; animated/collapsible/drill-in rail → compose
`ContextPanelProvider` + `ContextPanel` as a sibling of `ChatShell`."_

### C.4 The scenario rewrite

`ContextRail()` (~100 lines, `:487-589`) collapses to composition: the `useState` +
`setAsset` → provider `selectedAsset`/`openDetail`; the `hidden … lg:flex` `<aside>` →
`<ContextPanel>`; the `{railOpen ? … : null}` mount (`:1100`) → an always-mounted
`<ContextPanel>`; the page-level `railOpen` (`:961`) is **deleted**; the header toggle
(`:1015-1023`) → `<ContextPanelTrigger>`. The three sections → `ContextPanelSection`s in
`root`; the `Artifact` preview → `ContextPanelDetail` in `detail`, reached by clicking a
row (the drill-in) instead of stacked permanently below the tree.

---

## D. Blend-in migration — non-breaking, InspectorPanel convergence sequenced

| Step                                                            | Change                                                                                                                                                                                           | Breaking?       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 0 — land the shared primitive                                   | extract `useCollapsiblePanel` to `@qlik-coe-emea/qlabs-components-ui`; **re-point Sidebar onto it, byte-identical output** (only the source moves); gated by Sidebar story-tests + a visual diff | No              |
| 1 — build `ContextPanel` (`@qlik-coe-emea/qlabs-components-ai`) | new component on step-0; v1 CSS drill-in behind the VT seam; new `ContextAsset`; barrel export                                                                                                   | No              |
| 2 — adopt in the scenario                                       | rewrite `ContextRail` → composed `ContextPanel` (C.4)                                                                                                                                            | No (story only) |
| 3 — InspectorPanel convergence                                  | re-point flow's `InspectorPanel` onto the same `@qlik-coe-emea/qlabs-components-ui` collapse + frame base; keeps its single-view API, **gains collapse**                                         | No              |

**InspectorPanel convergence (decision 3):** `@qlik-coe-emea/qlabs-components-ai` and `@qlik-coe-emea/qlabs-components-flow` are siblings
(can't import each other), so the shared base lives in `@qlik-coe-emea/qlabs-components-ui` (`ui → flow`,
`ui → ai`): `useCollapsiblePanel` + an optional thin `CollapsiblePanelFrame` (the
`border-s` + `bg-surface` + header + close shell, `inspector-panel.tsx:37-62`
generalized). `InspectorPanel` stays single-view; drill-in is `ContextPanel`-only. This
is the WP-13 fix ([04](04-context-panel-and-assets.md) §2): one collapse implementation,
not three forks (Sidebar / ContextPanel / InspectorPanel).

---

## E. The decisions — resolved

1. **Shared collapse primitive → extract `useCollapsiblePanel` to `@qlik-coe-emea/qlabs-components-ui` NOW;
   re-point Sidebar byte-identically; build `ContextPanel` on it.** Not "roll its own +
   file a follow-up" (knowingly ships a third fork; the follow-up decays —
   `enforcement-over-reminders`). Risk to the stable Sidebar is **bounded**: a mechanism
   move with identical rendered output (the class fragments don't change, only their
   source), gated by Sidebar's story-tests + a visual diff. The primitive is a **hook**
   returning the `data-state`/`data-side` + the two class fragments, so Sidebar's JSX is
   untouched. Lives in `@qlik-coe-emea/qlabs-components-ui` (**motion-free, CSS-gated**).
2. **Drill-in v1 → CSS two-pane `translateX` track, behind the `useViewTransition`
   seam.** Not `AnimatePresence` (`@qlik-coe-emea/qlabs-components-ui` has no `motion` dep — the shared base must
   stay motion-free; and it'd need a `BrandMotionConfig` wrap for no win). Not
   wait-for-VT (VT-01 unbuilt — would block the fix). Actions shaped as `mutate`-callbacks
   → v2 swap is internal (`01-design.md` §7). **VT-01 is NOT a dependency; `ContextPanel`
   is its proof case** (`01-design.md` §6.1).
3. **InspectorPanel → converge on a shared `@qlik-coe-emea/qlabs-components-ui` base; drill-in is
   `ContextPanel`-only.** Respects the sibling boundary; `InspectorPanel` gains collapse,
   keeps its API. Sequenced as step 3.
4. **Provider + ChatShell → `ContextPanelProvider` wraps the workspace; `ChatShell` stays
   generic; panel is a sibling.** The external trigger needs the provider above the app
   header (doc-13). `ChatShell.aside` stays as the static-rail slot (non-breaking).
5. **Mobile → `@qlik-coe-emea/qlabs-components-ui Sheet side="right"` below `lg`, same `open`** (the Sidebar
   pattern). Strictly better than `hidden lg:flex`.
6. **A11y → the §B.5 tab-panel-swap spec** (announce + focus-to-detail-heading on
   `openDetail` + focus-restore-to-row on `back` + `inert` off-screen panes/collapsed
   container + `aria-expanded` trigger; all independent of the motion gate).
7. **Export → barrel from `@qlik-coe-emea/qlabs-components-ai`, NOT a subpath.** The subpath gate needs a
   materially lighter dep tree **and** a consumer needing the leaf without the trunk —
   neither holds (`ContextPanel` pulls the same `@qlik-coe-emea/qlabs-components-ui`+`@qlik-coe-emea/qlabs-components-tokens`+`motion`
   trunk; no consumer needs it without the rest of `@qlik-coe-emea/qlabs-components-ai`). A subpath would fragment
   the surface (`component-api.md`).

---

## F. Governance / dependencies — what must exist first

**Hard dependency:** `useCollapsiblePanel` in `@qlik-coe-emea/qlabs-components-ui` (decision 1) — **lands first**
(step 0); both `ContextPanel` and the Sidebar re-point need it. Architect-gated.

**Soft dependencies (frame ships first, content upgrades when they land):**

- the branded markdown renderer + `AssetPreview` ([04](04-context-panel-and-assets.md) §5)
  = the **detail** content — `ContextPanel` can ship with a placeholder (`Artifact` +
  `CodeBlock`) and adopt the renderer later;
- `ProducedAssetTree` / `SourceList` ([04](04-context-panel-and-assets.md) §4,§6) = the
  **root** content — ships with `FileTree`/`Sources`, upgrades later.

**NOT a dependency: VT-01.** v1 ships the full drill-in on a CSS track; VT is the v2
quality upgrade behind the seam. Building `ContextPanel` _justifies_ VT-01 (its proof
case) — the dependency runs the other way. This is the key de-risking.

**New gate (enforcement-over-reminders):** `check-collapse-fork.mjs` (warn-only,
self-tested) flags a new always-mounted `transition-[width]` + `data-state=collapsed`
panel in `packages/*/src` that doesn't call `useCollapsiblePanel` — so a fourth fork
can't appear. Self-test plants a hand-rolled `transition-[width] … w-0` (must flag) + a
`useCollapsiblePanel` consumer (must not). The structural analogue of 07/08's gates.

---

## G. Risks / needs-render — adversarial

1. **Drill-in inside a collapsing width — do the two animations fight? (the sharpest
   question.)** They're **orthogonal axes on different elements**: collapse tweens the
   container **width** (gap-spacer + container `right`); drill-in tweens a **child's
   `translateX`** in an `overflow-hidden` body. Different property, different element. The
   one hazard is drilling _while_ collapsing — _mitigation:_ `openDetail`/`back` are
   no-ops (or auto-`setOpen(true)`) when `!open`, and v2's `useViewTransition`
   single-flights. **needs-render:** trigger a drill-in mid-collapse and confirm coherence.
2. **The constrained heading inside `w-80`** ([04](04-context-panel-and-assets.md) §5).
   `ContextPanelDetail` must cap markdown headings at `text-subtitle`/`text-title` (07),
   not `display`/editor-prose `text-2xl`, or it re-creates "biggest text on screen."
   **needs-render** in the rail width, six themes.
3. **The fixed-vs-flex container coupling (§B.2).** A wrong `relative` ancestor makes the
   panel escape the shell. **needs-render** inside `ChatShell` + at the page root.
4. **Focus-trap / lost-focus on the slide.** Off-screen pane must be `inert` (not just
   `aria-hidden`); focus-move on `openDetail` must fire **after** `mutate` (rAF); collapsed
   container must be `inert`. **needs-render:** keyboard pass via `run-story-tests`.
5. **VT support / reduced-motion (v2).** Same-document VT is Chromium 111+/FF 144+/Safari
   18.2+; below that `run()` degrades to instant `mutate()`. Because **v1 is CSS**, support
   is a non-issue for shipping. Under reduced-motion both are instant — confirm the a11y
   behaviours still run.
6. **Over-built vs "just fix the mount"?** The minimum fix for complaint 1 alone is a
   2-line story patch (always-mount + `transition-[width]`) — but it leaves the bug to
   re-acquire everywhere, does nothing for the drill-in (complaint 2), and doesn't unify
   the three collapse forks. The component is justified by complaints 1 **and** 2 **and**
   the convergence — three problems. De-risked by being assembled from existing mechanisms
   (§A.1) and by the §F sequencing (frame ships before renderer/tree/VT). _Not over-built;
   not big-bang._

---

## Net: what this adds vs [04](04-context-panel-and-assets.md)

- **Collapse decided: extract `useCollapsiblePanel` to `@qlik-coe-emea/qlabs-components-ui` + re-point Sidebar
  byte-identically** (04 left it "architect call").
- **Drill-in v1 decided: CSS `translateX` track over `AnimatePresence`** (on the verified
  "@qlik-coe-emea/qlabs-components-ui has no motion dep / keep the base motion-free" argument), with the explicit
  `mutate`-callback seam to v2 `useViewTransition`.
- **ChatShell stays generic; panel is a sibling under a workspace-wrapping provider**
  (the doc-13 external-trigger story, made concrete).
- **InspectorPanel convergence sequenced** (shared `@qlik-coe-emea/qlabs-components-ui` base; drill-in
  `ContextPanel`-only; respects the sibling boundary).
- **A full drill-in a11y spec** (tab-panel-swap, not dialog).
- **Barrel export, not a subpath** (resolved against the subpath gate).
- **A fork-prevention lint** (`check-collapse-fork.mjs`).
- **The dependency direction with VT-01 clarified: NOT a blocker — `ContextPanel` is its
  proof case.**

Supersedes the `ContextPanel`/drill-in specifics in
[04 §1–3, §6](04-context-panel-and-assets.md); [04](04-context-panel-and-assets.md)
remains the authority for the asset-content siblings (`ProducedAssetTree`,
`AssetPreview`, the branded markdown renderer, §4–5), which `ContextPanel` hosts but does
not own.
