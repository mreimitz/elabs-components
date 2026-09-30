# Layout v2 review — final recheck

Final status: all established P1 findings below are closed after recheck; remaining P2 limitations are recorded at the end.

The initial review history follows. Read-only review of the uncommitted layout-v2 implementation. The projection keeps substantially more source meaning and the complete-view crossfade avoids invented intermediate routes. The implementation is not yet ready for final sign-off: explicit start alignment did not work in an actual ELK fixture, and deployment overviews rendered primary labels below 8 screen pixels. Root and visual worker are addressing findings; this report records the reviewed snapshot, not subsequent fixes.

Both supplied light and dark captures show the same geometry/readability problems. Answers overview is readable at 12.63 screen pixels but retains several anonymous parallel connectors after authored labels are suppressed. No theme-specific contrast failure was established.

Provisional score: 16/24 — accessibility 2, states 3, theming/tokens 3, hierarchy 2, visual anti-patterns 3, taste 3. Runtime keyboard and mobile testing were not independently performed, so this is not an accessibility certification.

## P1 — Explicit start alignment is ignored

`apps/diagram/src/layout/run-elk.ts`, the `intent.align === "start"` option block: setting `elk.layered.nodePlacement.bk.fixedAlignment=LEFTUP` does not align compound branch starts.

Actual ELK reproduction: LR parent `p`, `arrangement:parallel`, `align:start`; branch `a` contains `a1 -> a2`, branch `b` contains `b1`; leaves 120×80. Result: a x=16 width=304; b x=92 width=152. Both start and center produce the same coordinates. Expected b x=16. Current technical-composition tests assert order only, missing the explicit alignment contract.

Fix layout constraints or defer the unsupported field; add an unequal-width parallel-branch assertion. Preserve existing semantic canvas/type tokens; this is a geometry contract issue.

## P1 — Deployment overview remains unreadable

Evidence supplied by visual worker: `/tmp/diagram-layout-visual-browser/results.json` and corresponding light/dark pipeline and landscape captures. Pipeline title text 6.509 screen pixels with bounds 1024×1400; landscape 7.172 pixels with bounds 1298×1064. Answers reaches 12.629 pixels.

`apps/diagram/src/visual/lane-layout.ts:137` makes every incident relationship increase box height by 32 units when any relationship has a label; stacking several such boxes in one target lane forces fit-to-height. Compact widths do not solve the height constraint.

Rebalance deployment composition and local routing before enlarging fonts. Keep `text-caption`/`text-meta` semantics but enforce a measurable screen-space readability target for reference fixtures. Do not report an all-fixture readability pass from the Answers result alone.

## P1 — Empty explicit boundary loses its ownership

A valid authored box `{id: boundary, lane: targets, title: Owned boundary, boundary: z, members: []}` for `{id:z,owner:saas}` produced `owner:unowned`. `resolve-visual.ts` originally inspected only members; a subsequent attempted change to pass the boundary ID still starts ownership traversal at `entry.parent`, ignoring the zone's own ownership. Provider metadata has the same empty-member issue.

Root has acknowledged and is fixing. Add an owned top-level and nested boundary regression, deriving metadata from the zone itself before ancestors. Preserve owner-driven semantic zone fills and profile role tokens.

## P1 — Suppressed labels leave redundant anonymous arrows

Answers light screenshot shows four arrows between assistant and explainable answers, unlike the supplied simple visual reference. `resolve-visual.ts:509` overrides labels on each semantic source flow without regrouping the resulting displayed connectors. Answers explicitly sets pair labels to empty, so the distinctions are no longer visible.

Bundle explicitly annotated identical display relationships while retaining all source relationships and IDs for inspection. Preserve different direction/kind semantics. Root has acknowledged this change.

## P2 — Remove stale morph implementation comments

`capability-box-node.tsx` still describes member rows flying into a ghost overlay, although this implementation removes the geometric overlay. Comments should describe current drill-down/membership behavior.

## Protect

- All original relationship records retained for drill-down.
- Exact boundary endpoints, avoiding arbitrary child endpoints.
- Both inactive panes are inert during transition; technical mutations lock immediately.
- Independent cameras and cancellation on document changes.
- Theme-aware semantic typography and foreground tokens.

## Verification

- Scoped visual audit: 0 blocking, 0 advisory.
- App typecheck passed.
- App lint: 0 errors, 11 warnings.
- Focused technical composition, visual core/layout and lens transition tests: 42 passed.
- Independently ran the unequal-branch actual-ELK reproduction and boundary ownership reproduction.
- Reviewed supplied light Answers and dark pipeline screenshots and numeric results for both themes.
- Did not independently run browser motion benchmarks, mobile, full keyboard/axe or full suite. Browser benchmarks deliberately left to the transition worker to avoid competing CPU load.

## Recheck 1

Closed start-alignment, boundary-ownership/provider, and redundant annotated-arrow findings after fixes. Current focused technical and projection tests: 32 passed.

Independent nested-constraint stress fixture: parent parallel/start, both child compounds sequence/start, unequal leaf sizes, four real flows (two internal, one cross-branch, one external), LR and TB. Both remain on ELK with exact leading-border alignment. Every real edge has routed sections; cross-branch lifting targets the child compounds and external lifting targets the parent as expected. This supplements the committed fixed-port endpoint tests. No new port-safety defect established.

Deployment readability remains open pending fresh browser evidence. Prior numeric captures are an identified failing baseline, not a claim about newer in-flight fixes.

## Final recheck — all established must-fixes closed

Independently inspected all six final captures (Answers, Talend pipeline, customer landscape; light and dark) under `/tmp/diagram-layout-visual-final`. Primary labels are now readable: supplied browser measurements are Answers 12.70px, Talend 12.39px and landscape 12.66px at 1440×900. All six reported geometry checks are zero. The simple Answers process no longer draws duplicate anonymous arrows. Deployment summaries improve fit while retaining technical membership and source relationship provenance.

Reviewed control box height correction: control relationships use bottom ports, so reserving side-port rows unnecessarily inflated height; removing that allocation is consistent with the renderer. Current visual-layout unit checks independently rerun: 11 passed.

Final bounded score: 20/24 — accessibility 3, states 3, theming/tokens 4, hierarchy 3, visual anti-patterns 4, taste 3. Both themes retain clear primary hierarchy; no new theme-dependent issue established. This score covers the reviewed desktop screenshots and code, not untested full accessibility/mobile behavior.

Remaining P2 limitations:

- Some deployment relationship labels still truncate (`Repl…`, `Publ…`, `Analytics…`). Primary box-title readability passed; this is not a claim that every relationship label is fully visible. Prefer complete short labels and a route label budget that fits `text-meta`, retaining full relationship details for inspection.
- The Talend rightmost control route runs behind the fixed minimap. Graph-bound containment checks do not detect overlay occlusion; an overlay-aware viewport/routing check would improve this.
- The original stale-morph-comment cleanup suggestion is nonblocking.

No independently established P1 remains in the current reviewed scope. Full app keyboard/axe, mobile and animation benchmarks remain outside this review; transition evidence belongs to its dedicated worker.

## Route polish recheck — P2 label and minimap findings closed

Inspected updated Talend dark and customer landscape light desktop captures under `/tmp/diagram-layout-routes-final`. Previously abbreviated relationship labels are now complete in these fixtures, and Talend control paths approach the targets from the left instead of disappearing behind the minimap. Reviewed the corridor budgeting and receiver-side bend changes; local lane-pair route indices replace unrelated global route indices. No new defect established. Independently reran visual-layout tests: 13 passed, including added routing cases.

These two P2 findings are closed for the reviewed reference fixtures. The new automated no-ellipsis browser assertion is being run by the root agent; this review does not claim its result before completion. The screenshots establish the fix visually for the cited desktop cases. Arbitrary user graphs and all browser scales are not exhaustively proven. Existing full-accessibility and independent mobile-testing limitations remain as stated above.

The stale member-ghost comments were replaced with current membership/drill-down descriptions during final integration.

## Physical-corridor routing recheck

Reviewed the final physical-gutter allocation in `visualGutterTracks`, its shared layout budget, and `trackX` consumption. Different endpoint pairs now reserve distinct stable tracks in the actual corridor they share; layout and route construction use the same allocation. Adjacent, skipping, same-lane and control routes participate. Sorted flow IDs preserve declaration-order stability.

Independently reran visual-layout tests: 14 passed. The added actual derived ClickHouse fixture asserts no geometry issues and identical routes when flow declarations are reversed. Inspected the updated Talend dark screenshot under `/tmp/diagram-layout-physical-tracks`; complete labels, distinct route columns, and minimap clearance remain intact. No new must-fix established in this bounded change. No competing browser process was started during root browser recovery.
