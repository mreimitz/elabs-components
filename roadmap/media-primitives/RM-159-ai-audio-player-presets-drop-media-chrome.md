---
id: RM-159
title: "ai `AudioPlayer*` presets over ui media + media-chrome removal"
status: planned
priority: P1
effort: M (2 days)
wave: 2
depends_on: [RM-156]
blocks: [RM-160]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/ai/src/audio-player.tsx (rewritten as presets over ui `Audio` / `MediaPlayer*`)
  - packages/ai/src/_audio-player-media-chrome.tsx (deleted)
  - packages/ai/src/audio-player.test.tsx
  - packages/ai/src/audio-player.stories.tsx
  - packages/ai/src/_lazy-boundary-conformance.ts (comments L3–6, L29–31 → Rive only)
  - packages/ai/src/_lazy-mermaid-absent.test.ts (L31–32)
  - packages/ai/src/_lazy-engine-boundary.tsx (L12)
  - packages/ai/package.json (remove media-chrome from peerDependencies ~L66, peerDependenciesMeta ~L78–80, devDependencies ~L103)
  - pnpm-lock.yaml
  - packages/ai/README.md (hand-written rows ~L96, L103, L182)
  - scripts/check/rules/eager-heavy-deps.mjs (L5 header, L26 entry, L108 doc, L185 fail fixture)
  - scripts/check-optional-peer-types.mjs (L53, L107)
  - scripts/gen-package-readmes.mjs (L69, L102)
  - docs/CONSUMING.md (L100, L529, L536–545)
  - docs/CSP-AND-NETWORK.md (L132)
  - docs/ADR/0019-lazy-engine-boundaries.md (one-line "superseded for media-chrome by ADR 0041" note at L38, L97, L129)
  - docs/ADR/0032-optional-peer-dependency-policy.md (same note at L6, L27, L129, L147, L195)
  - fixtures/consumer-smoke/src/main.tsx (comment L36–49 only; import unchanged)
  - packages/cli/lib/intent.mjs (`AudioPlayer` row ~L2375–2388 rewritten)
  - scripts/check/baseline.json (via `pnpm check:update` — the `pnpm-script-refs` key for the deleted file disappears)
  - .changeset/*.md (ai minor)
source: docs/review/2026-09-23-media-primitives-plan.md §5, §7 risk 7; ADR 0041 §2 items 5, 6, 8, §6, §7
---

# RM-159 ai `AudioPlayer*` presets, media-chrome out

## Finding

- `packages/ai/src/audio-player.tsx` L203 and the parts at L211–357 render media-chrome web components loaded through `_audio-player-media-chrome.tsx`, a lazy boundary over an optional peer with a missing-peer state (`AudioPlayerMissing`). Styling runs through `--media-*` variables, which the `AudioPlayer` intent row already lists as an anti-pattern.
- `AudioPlayerProps` (L103–144) mirrors media-chrome's controller attributes (`noHotkeys`, `keyboardControl`, `seekOffset`, `autohide*`, `breakpoints*`, …).
- media-chrome is named in `packages/ai/package.json`, `pnpm-lock.yaml`, `eager-heavy-deps.mjs`, `check-optional-peer-types.mjs`, `gen-package-readmes.mjs`, the ai README, `docs/CONSUMING.md`, `docs/CSP-AND-NETWORK.md`, ADR 0019 and ADR 0032, and the consumer-smoke fixture comment.

## Change

**Presets over ui** — each passes its existing `data-slot="audio-player*"` (ADR 0041 §7: DOM selectors unchanged, the `data-slot` ratchet stays at 0):

- `AudioPlayer` → `<Audio data-slot="audio-player" keyboardShortcuts={!noHotkeys && keyboardControl !== false}>`.
- `AudioPlayerElement` → `<MediaPlayerElement data-slot="audio-player-element" src={data ? dataUrl : src}>`; `slot="media"` dropped; the `data: SpeechResult["audio"]` → data-URL conversion stays in ai.
- `ControlBar` → `MediaPlayerControls`; `PlayButton` → `MediaPlayerPlayButton`; `SeekBackwardButton` / `SeekForwardButton` → `MediaPlayerSeekButton offset={∓seekOffset}`; `TimeDisplay` → `MediaPlayerTime mode="current"`; `DurationDisplay` → `mode="duration"`; `TimeRange` → `MediaPlayerTimeSlider`; `MuteButton` → `MediaPlayerMuteButton`; `VolumeRange` → `MediaPlayerVolumeSlider`.
- Error path: `MediaPlayerError title={t("ai.audioPlayer.renderError")}`. `AudioPlayerMissing` (not exported) deleted.

**Prop map** — every media-chrome member of `AudioPlayerProps` keeps its type, with `@deprecated` JSDoc naming the replacement:

- `noHotkeys` / `keyboardControl` → `keyboardShortcuts`; `seekOffset` → `offset`.
- Accept-and-ignore (destructured and dropped, never spread to the DOM): `autohide*`, `breakpoints*`, `defaultDuration`, `defaultStreamType`, `defaultSubtitles`, `gesturesDisabled`, `keysUsed`, `liveEdgeOffset`, `noAuto*`, `noDefaultStore`, `no*Pref`, `resolvedLang`, `userInteractive`, `mediaController`, `mediaCurrentTime`, `noTooltip`, `preventClick`.

**Removal:**

- Delete `_audio-player-media-chrome.tsx`. `_lazy-boundary-conformance.ts` comments → Rive only; `_lazy-mermaid-absent.test.ts` L31–32 and `_lazy-engine-boundary.tsx` L12 lose the media-chrome mention.
- `audio-player.test.tsx`: drop `vi.mock("./_audio-player-media-chrome")` and the missing-peer assertions; add play / seek / mute tests on per-file stubs (ADR 0041 §2 item 9). `audio-player.stories.tsx`: play functions wait on `[data-slot="audio-player-play-button"]`.
- `packages/ai/package.json`: remove media-chrome from `peerDependencies`, `peerDependenciesMeta`, `devDependencies`; update `pnpm-lock.yaml` with `pnpm install`.
- `eager-heavy-deps.mjs`: drop `"media-chrome"` (L26), the header mention (L5) and the doc (L108); the fail fixture (L185) switches to another `HEAVY_DEPS` entry.
- `check-optional-peer-types.mjs` (L53, L107), `gen-package-readmes.mjs` (L69, L102), `packages/ai/README.md`, `docs/CONSUMING.md`, `docs/CSP-AND-NETWORK.md`: remove media-chrome.
- ADR 0019 and ADR 0032: a one-line "superseded for media-chrome by ADR 0041" note at each cited line — no rewrite.
- `fixtures/consumer-smoke/src/main.tsx` comment L36–49 → "`AudioPlayer` renders real controls with zero optional peers"; the import is unchanged.
- `intent.mjs` `AudioPlayer` row: purpose "preset over ui `Audio`"; anti-pattern "`--media-*` variables are no longer honoured".
- `scripts/check/baseline.json` via `pnpm check:update`, reviewed line by line.
- Changeset (ai minor) argues **why minor, not major**: the peer was optional; no exported symbol removed; prop types stay assignable; `data-slot` selectors persist; tag names and `--media-*` were never documented API; a leftover media-chrome install is inert. Alias and ignored props go in the next major (`docs/DEPRECATION.md` §2).

## Acceptance

- `pnpm consumer:check` green: `AudioPlayer` renders real controls with zero optional peers installed.
- Every existing `audio-player*` selector still matches; existing props typecheck unchanged.
- `grep -rn media-chrome` outside `CHANGELOG.md` returns only the ADR 0019 / 0032 "superseded" notes.
- Keyboard: Space / `k`, arrows, `m` work in the ai story's play function; `noHotkeys` disables them.

## Test / gate

`pnpm --filter @elabs-ai/components-ai typecheck lint test`; `pnpm check --rule eager-heavy-deps,optional-peer-transitives,dep-direction,data-slot,pnpm-script-refs`; `pnpm check:test` (the eager-heavy-deps fixture); `pnpm gen && pnpm gen:check`; `pnpm consumer:check`; Storybook `run-story-tests` on `ai-audioplayer--*` in light and dark with the keyboard path exercised.

## Orchestrator notes

Critical-path item. Merge **before** RM-158 (both regenerate `baseline.json`). Shares `intent.mjs` with RM-158 (different rows). Put ADR 0041 checklist item (c) — keep `audio-player*` slots this minor — on the closure list; do not rename the slots here.
