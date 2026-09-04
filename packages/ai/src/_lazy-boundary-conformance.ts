/**
 * `AssertAssignable` — the shared compile-time conformance-check helper for
 * issue #101's "own the type locally" pattern (see `persona.tsx`,
 * `audio-player.tsx`, and the ADR 0019 amendment). Every `@lazy-boundary`
 * sibling module that owns a structurally-compatible mirror of an optional
 * peer's type (`_persona-rive.tsx`, `_audio-player-media-chrome.tsx`) uses
 * THIS declaration rather than redeclaring it locally — previously the same
 * three-line type was declared verbatim in both files (round-1 validator
 * finding F5), which is exactly the kind of drift this repo's "a convention
 * ships with its teeth" rule (@.claude/rules/quality-gates.md) exists to
 * avoid: a future edit to one copy (e.g. relaxing the constraint) could
 * silently diverge from the other with no gate to catch it.
 *
 * Purely a type-level helper — no runtime value, no import of anything heavy
 * or peer-owned — so it is safe for a `@lazy-boundary` module to import it
 * statically without pulling the peer back into the entry chunk, and safe for
 * anything else in the package to import it too.
 *
 * ## What this assertion can, and cannot, prove (round-1 validator finding F4)
 *
 * `AssertAssignable<TOwned extends TReal, TReal>` only typechecks when
 * `TOwned` is assignable TO `TReal` — i.e. it proves the owned mirror is a
 * SUPERTYPE-OR-EQUAL of the real peer type (every value the real type can
 * produce is accepted by the owned type), never the reverse. That is
 * sufficient to prove the mirror is SAFE to use in place of the real type
 * wherever the real type is only ever produced (an event object Rive hands
 * back, a prop object media-chrome reads) — but it is a ONE-DIRECTIONAL
 * check, so it cannot detect the owned type merely being NARROWER than the
 * real one. `PersonaRiveEvent["data"]` (`unknown`) and the `AudioPlayer*`
 * part-prop types (ordinary HTML attributes only, no per-element instance
 * members, no `ref`) are both real, deliberate narrowings versus their real
 * peer counterparts — see the CHANGELOG's "Breaking (types)" entry — and this
 * assertion passes for both, exactly as designed: a narrower type is still a
 * valid supertype-direction match. Don't read a green
 * `_*Conformance` type as "identical shape to the peer"; read it as "safe to
 * substitute here", which is the property issue #101 actually needed.
 */
export type AssertAssignable<_TOwned extends TReal, TReal> = true;
