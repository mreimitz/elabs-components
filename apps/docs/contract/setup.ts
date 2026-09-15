// Not generated (the "contract" vitest project's one hand-written file).
//
// Loads the real token + Tailwind stylesheet for the "contract" browser
// project (scripts/gen-contract-tests.mjs), so axe's color-contrast checks and
// the horizontal-overflow check run against genuine computed styles — the
// same stylesheet Storybook's own preview loads, minus the toolbar/decorator
// machinery this suite doesn't need (it sets `data-theme` itself per test).
import "../.storybook/preview.css";

// Tells React's `act()` (used by the generated mount helper) that this browser
// environment is a deliberate test harness — otherwise React 19 logs "The
// current testing environment is not configured to support act(...)" on every
// mount/unmount, which is just noise here (there is no other test framework
// wiring this flag for us, unlike jsdom + `@testing-library/react`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- global flag, no type in `lib.dom`
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
