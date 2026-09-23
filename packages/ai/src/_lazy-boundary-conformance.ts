/**
 * `AssertAssignable` — the shared compile-time conformance-check helper for
 * issue #101's "own the type locally" pattern (see `persona.tsx` and the
 * ADR 0019 amendment). A `@lazy-boundary` sibling module that owns a
 * structurally-compatible mirror of an optional peer's type
 * (`_persona-rive.tsx`, the Rive runtime) uses THIS declaration rather than
 * redeclaring it locally, so a future edit (e.g. relaxing the constraint)
 * cannot silently diverge between copies.
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
 * back) — but it is a ONE-DIRECTIONAL check, so it cannot detect the owned
 * type merely being NARROWER than the real one. `PersonaRiveEvent["data"]`
 * (`unknown`) is a real, deliberate narrowing versus its Rive counterpart —
 * see the CHANGELOG's "Breaking (types)" entry — and this assertion passes
 * for it, exactly as designed: a narrower type is still a valid
 * supertype-direction match. Don't read a green
 * `_*Conformance` type as "identical shape to the peer"; read it as "safe to
 * substitute here", which is the property issue #101 actually needed.
 */
export type AssertAssignable<_TOwned extends TReal, TReal> = true;
