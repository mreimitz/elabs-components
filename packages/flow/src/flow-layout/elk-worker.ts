/**
 * The elkjs web-worker entry — RM-067.
 *
 * Constructed ONLY by `layout-flow-elk.ts`, as
 * `new Worker(new URL("./elk-worker.ts", import.meta.url), { type: "module" })`. Nothing
 * imports this module, so its static edge to the engine never reaches the package barrel:
 * a `flow` consumer that never lays a graph out with ELK never downloads elkjs.
 *
 * `elk-worker.min.js` is ELK's own GWT-compiled engine. Evaluated where `document` is
 * undefined and `self` exists — a dedicated worker — it installs its message dispatcher on
 * `self`, which is exactly the protocol `elkjs/lib/elk-api.js` speaks from the main thread.
 * The import is for that side effect; the module has no exports to bind.
 */
import "elkjs/lib/elk-worker.min.js";
