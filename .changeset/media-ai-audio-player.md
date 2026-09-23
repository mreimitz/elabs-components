---
"@elabs-ai/components-ai": minor
---

Changed: `AudioPlayer*` are now thin presets over ui's `MediaPlayer*` parts — real buttons and sliders with keyboard shortcuts (Space/k, arrows, m), themed through tokens. Each preset now emits the shared `data-slot="media-player*"` of the ui part it wraps; the `audio-player*` selectors are gone — re-target any CSS or test that used them. The `--media-*` custom properties are no longer honoured.

Deprecated: the old custom-element pass-through props. `noHotkeys` and `keyboardControl` map to the new `keyboardShortcuts` prop; `seekOffset` on the seek buttons maps to `offset`. Every other one (`autohide*`, `breakpoints*`, `defaultDuration`, `defaultStreamType`, `defaultSubtitles`, `gesturesDisabled`, `keysUsed`, `liveEdgeOffset`, `noAuto*`, `noDefaultStore`, `no*Pref`, `resolvedLang`, `userInteractive`, and `mediaController`/`mediaCurrentTime`/`noTooltip`/`preventClick` on the forward seek button) is accepted and ignored, and is removed in the next major. `AudioPlayerPartProps` is deprecated too.

Removed: the optional peer `media-chrome`. A leftover install is inert — nothing imports it.

Why a minor: the peer was optional, so no consumer was required to have it; no exported symbol is removed; existing prop values still typecheck; and the custom-element tag names and `--media-*` properties were never documented API. The `data-slot` rename is the one visible break, taken now so every player in the system shares one selector family; the bump is settled by the combined release this ships in.
