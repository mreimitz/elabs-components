# R1 recovery findings

Creating a diagram now distinguishes a failed write from a successful creation followed by a failed document switch. The tree refreshes after creation even if the current diagram cannot be saved; the existing edits remain open and the message names the created file. Home and sidebar use the same error contract, so retrying does not suggest another creation.

Workspace reads require the local service's positive modification timestamp and text content type. A static preview's successful HTML fallback is reported as an unavailable workspace instead of being passed to the YAML compiler.

The shared theme-transition hook now handles both fulfillment and rejection and gives each transition ownership of its attributes. A superseded transition cannot clear the next transition's direction. No global error suppression is used.

Verification: a real browser creates a disposable diagram while the original document's save is unavailable, checks the accurate message and refreshed tree, and proves unsaved text and both files are preserved. The read-client unit rejects HTML and missing/invalid timestamps. Theme-transition regressions fail on the previous implementation (overwritten attributes and an unhandled rejection), then pass with the fix; all 30 theme-switcher units and 8 Storybook browser stories pass.

The broad `check:changed` run passed 1,917 UI tests (5 skipped) and then stopped on one animation-timing assertion in the unchanged LineChart tests: an intermediate opacity had not reached its target. The same 51-test LineChart file passed in isolation both on this branch and on main. The broad dependent-package run is therefore not reported as fully green. Repository convention checks passed 98/98; the app's direct gates and independent review passed.
